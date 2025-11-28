// backend/src/generator.ts
import fs from 'fs';
import path from 'path';
import { NormalizedAST } from './parser';

/** Helper utilities */
function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function csvEscape(value: any): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function sanitizeName(raw: string): string {
  return String(raw || '').trim().replace(/[^A-Za-z0-9_]/g, '_');
}

function sanitizeTypeForMermaid(rawType: string | undefined | null): string {
  if (!rawType) return 'unknown';
  let s = String(rawType).trim();
  s = s.replace(/\(/g, '_').replace(/\)/g, '').replace(/,+/g, '_');
  s = s.replace(/[^A-Za-z0-9_]/g, '_');
  s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  return s.toLowerCase();
}

/** Write mapping CSV */
export function writeMappingCSV(ast: NormalizedAST, outDir: string) {
  const artifactsDir = path.resolve(outDir);
  ensureDir(artifactsDir);

  const header = [
    'target_db', 'target_schema', 'target_table', 'target_column', 'target_type',
    'source_id', 'source_path', 'transform', 'default', 'mapping_rule', 'notes'
  ];
  const rows: string[] = [header.join(',')];

  for (const m of ast.mappings || []) {
    const t = m.target || {};
    const db = t.db || '';
    const schema = t.schema || '';
    const table = t.table || '';
    const column = t.column || m.rawTarget || '';
    let targetType = '';
    if (t.db && t.schema && t.table && t.column && ast.targets) {
      const key = `${t.db}.${t.schema}.${t.table}`;
      const tgt = ast.targets[key];
      if (tgt && tgt.columns && tgt.columns[t.column]) {
        targetType = tgt.columns[t.column].type || '';
      }
    }
    const from = m.from || {};
    const row = [
      csvEscape(db), csvEscape(schema), csvEscape(table), csvEscape(column), csvEscape(targetType),
      csvEscape(from.source_id || ''), csvEscape(from.path || ''), csvEscape(from.transform || ''),
      csvEscape(from.default || ''), csvEscape(from.rule || ''), csvEscape(m.notes || '')
    ].join(',');
    rows.push(row);
  }

  const csvPath = path.join(artifactsDir, 'mapping_matrix.csv');
  fs.writeFileSync(csvPath, rows.join('\n'), 'utf8');
}

/** Generate Mermaid ERDs */
export function generateMermaidERD(ast: any, erdDir: string) {
  if (!ast || !ast.targets) return [];
  ensureDir(erdDir);

  const written: Array<{ name: string; content: string }> = [];

  // Build a lookup from simple table name -> full target keys
  const simpleNameIndex: Record<string, string[]> = {};
  for (const tk of Object.keys(ast.targets || {})) {
    const t = ast.targets[tk];
    const simple = String(t.table || '').trim();
    if (!simple) continue;
    simpleNameIndex[simple] = simpleNameIndex[simple] || [];
    simpleNameIndex[simple].push(tk);
  }

  // Group tables by db+schema for per‑schema files
  const tablesBySchema: Record<string, any[]> = {};
  for (const tkey of Object.keys(ast.targets || {})) {
    const t = ast.targets[tkey];
    const schemaKey = `${t.db}__${t.schema}`; // __ to avoid dots
    tablesBySchema[schemaKey] = tablesBySchema[schemaKey] || [];
    tablesBySchema[schemaKey].push(t);
  }

  // Helper to emit a single ER diagram (tables + relationships)
  function emitER(tables: any[], fileName: string, prepend: boolean = false) {
    const erLines: string[] = ['erDiagram'];
    const relLines: string[] = [];

    // Table definitions
    for (const t of tables) {
      const tableName = sanitizeName(t.table);
      erLines.push('');
      erLines.push(`  ${tableName} {`);
      for (const colNameRaw of Object.keys(t.columns || {})) {
        const col = t.columns[colNameRaw];
        const colName = sanitizeName(colNameRaw);
        const ty = sanitizeTypeForMermaid(col.type || '');
        erLines.push(`    ${colName} ${ty}`);
      }
      erLines.push('  }');
      erLines.push('');
    }

    // Relationships (explicit FK first)
    for (const t of tables) {
      const child = sanitizeName(t.table);
      for (const colNameRaw of Object.keys(t.columns || {})) {
        const col = t.columns[colNameRaw];
        if (col && col.fk) {
          const fkObj = typeof col.fk === 'string' ? { table: col.fk } : col.fk || {};
          let fkTable = fkObj.table || fkObj.table_name || fkObj.ref || null;
          let fkColumn = fkObj.column || fkObj.col || null;
          if (!fkTable && typeof fkObj === 'string') fkTable = fkObj;
          if (!fkTable) {
            const maybe = String(fkObj).trim();
            if (maybe.includes('.')) {
              const parts = maybe.split('.');
              fkTable = parts[parts.length - 2] || parts[0];
              fkColumn = fkColumn || parts[parts.length - 1];
            }
          }
          if (fkTable) {
            const candidates = simpleNameIndex[String(fkTable).trim()] || [];
            let parentKey: string | null = null;
            if (candidates.length === 1) parentKey = candidates[0];
            else if (candidates.length > 1) {
              const schema = t.schema || '';
              const db = t.db || '';
              const prefer = candidates.find(c => c.includes(`.${schema}.`) || c.includes(`${db}.${schema}.`));
              parentKey = prefer || candidates[0];
            }
            const parentName = parentKey ? sanitizeName(parentKey.split('.').pop() as string) : sanitizeName(fkTable);
            const label = sanitizeName(fkColumn || 'fk');
            relLines.push(`  ${parentName} ||--o{ ${child} : "${label}"`);
          }
        }
      }
    }

    // Auto‑inference for _id columns without explicit FK
    for (const t of tables) {
      const child = sanitizeName(t.table);
      const schema = t.schema || 'public';
      const db = t.db || 'default';
      for (const colNameRaw of Object.keys(t.columns || {})) {
        const col = t.columns[colNameRaw];
        if (col && col.fk) continue; // already handled
        if (!colNameRaw.toLowerCase().endsWith('_id')) continue;
        const base = colNameRaw.substring(0, colNameRaw.length - 3);
        if (!base) continue;
        const candidatesToCheck = [base, `dim_${base}`, `${base}s`, `dim_${base}s`];
        let parentKey: string | null = null;
        let matchedSimple: string | null = null;
        for (const cand of candidatesToCheck) {
          const found = simpleNameIndex[cand];
          if (found && found.length > 0) {
            matchedSimple = cand;
            if (found.length === 1) parentKey = found[0];
            else {
              const prefer = found.find(c => c.includes(`.${schema}.`) || c.includes(`${db}.${schema}.`));
              parentKey = prefer || found[0];
            }
            break;
          }
        }
        if (parentKey && matchedSimple) {
          const parentName = sanitizeName(parentKey.split('.').pop() as string);
          if (parentName !== child) {
            const label = sanitizeName(colNameRaw);
            relLines.push(`  ${parentName} ||--o{ ${child} : "${label}"`);
          }
        }
      }
    }

    if (relLines.length) {
      erLines.push('');
      erLines.push('  %% Relationships');
      erLines.push(...relLines);
      erLines.push('');
    }

    const content = erLines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
    const outPath = path.join(erdDir, fileName);
    fs.writeFileSync(outPath, content, 'utf8');
    if (prepend) written.unshift({ name: fileName, content });
    else written.push({ name: fileName, content });
  }

  // Emit per‑schema files
  for (const schemaKey of Object.keys(tablesBySchema)) {
    const parts = schemaKey.split('__');
    const db = parts[0];
    const schema = parts[1] || 'public';
    const tables = tablesBySchema[schemaKey];
    const fileName = `erd_${db}_${schema}.mmd`;
    emitER(tables, fileName);
  }

  // Emit global ERD (all tables)
  const allTables: any[] = [];
  for (const schemaKey of Object.keys(tablesBySchema)) {
    allTables.push(...tablesBySchema[schemaKey]);
  }
  if (allTables.length) {
    emitER(allTables, 'erd_all.mmd', true);
  }

  return written;
}

/** Generate lineage JSON (unchanged) */
export function generateLineageJSON(ast: any, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });
  const nodes: any[] = [];
  const edges: any[] = [];
  const tableEdgesMap: Record<string, Set<string>> = {};

  for (const sid of Object.keys(ast.sources || {})) {
    const s = ast.sources[sid];
    const srcNodeId = `src:${sid}`;
    nodes.push({ id: srcNodeId, type: 'source', label: `${sid}`, meta: { ...s } });
  }

  for (const tgtKey of Object.keys(ast.targets || {})) {
    const t = ast.targets[tgtKey];
    const tableNodeId = `t:${t.db}.${t.schema}.${t.table}`;
    nodes.push({ id: tableNodeId, type: 'table', label: `${t.db}.${t.schema}.${t.table}`, meta: { db: t.db, schema: t.schema, table: t.table } });
    for (const colName of Object.keys(t.columns || {})) {
      const colNodeId = `t:${t.db}.${t.schema}.${t.table}.${colName}`;
      nodes.push({ id: colNodeId, type: 'column', label: colName, meta: { ...t.columns[colName], table: `${t.db}.${t.schema}.${t.table}` } });
    }
  }

  let edgeCounter = 1;
  const makeEdgeId = () => `e${edgeCounter++}`;

  for (const m of ast.mappings || []) {
    const tg = m.target || {};
    const from = m.from || {};
    const targetCol = tg.column || null;

    if (targetCol === '*' && from.fields && typeof from.fields === 'object') {
      for (const targetColName of Object.keys(from.fields)) {
        const srcSpec = from.fields[targetColName];
        const srcNodeId = `src:${from.source_id}:${String(srcSpec)}`;
        if (!nodes.find(n => n.id === srcNodeId)) {
          nodes.push({ id: srcNodeId, type: 'source_column', label: String(srcSpec), meta: { source_id: from.source_id, path: srcSpec } });
        }
        const tgtColNode = `t:${tg.db}.${tg.schema}.${tg.table}.${targetColName}`;
        edges.push({ id: makeEdgeId(), source: srcNodeId, target: tgtColNode, type: 'column_lineage', meta: { transform: from.transform || null, rule: from.rule || null, raw: m.rawTarget || null } });
        const tableEdgeKey = `src:${from.source_id}|t:${tg.db}.${tg.schema}.${tg.table}`;
        tableEdgesMap[tableEdgeKey] = tableEdgesMap[tableEdgeKey] || new Set<string>();
        tableEdgesMap[tableEdgeKey].add(targetColName);
      }
      continue;
    }

    if (from.source_id && from.path && targetCol) {
      const srcNodeId = `src:${from.source_id}:${from.path}`;
      if (!nodes.find(n => n.id === srcNodeId)) {
        nodes.push({ id: srcNodeId, type: 'source_column', label: from.path, meta: { source_id: from.source_id, path: from.path } });
      }
      const tgtColNode = `t:${tg.db}.${tg.schema}.${tg.table}.${targetCol}`;
      edges.push({ id: makeEdgeId(), source: srcNodeId, target: tgtColNode, type: 'column_lineage', meta: { transform: from.transform || null, rule: from.rule || null, raw: m.rawTarget || null } });
      const tableEdgeKey = `src:${from.source_id}|t:${tg.db}.${tg.schema}.${tg.table}`;
      tableEdgesMap[tableEdgeKey] = tableEdgesMap[tableEdgeKey] || new Set<string>();
      tableEdgesMap[tableEdgeKey].add(targetCol);
      continue;
    }

    // rule‑only mappings
    if (m.from && m.from.rule && targetCol) {
      const srcNodeId = `rule:${m.from.rule}`;
      if (!nodes.find(n => n.id === srcNodeId)) {
        nodes.push({ id: srcNodeId, type: 'rule', label: String(m.from.rule), meta: { rule: m.from.rule } });
      }
      const tgtColNode = `t:${tg.db}.${tg.schema}.${tg.table}.${targetCol}`;
      edges.push({ id: makeEdgeId(), source: srcNodeId, target: tgtColNode, type: 'column_lineage', meta: { rule: m.from.rule } });
      const tableEdgeKey = `rule:${m.from.rule}|t:${tg.db}.${tg.schema}.${tg.table}`;
      tableEdgesMap[tableEdgeKey] = tableEdgesMap[tableEdgeKey] || new Set<string>();
      tableEdgesMap[tableEdgeKey].add(targetCol);
      continue;
    }

    // fallback – unknown source
    const srcNodeId = `src:${from.source_id || 'unknown'}:${from.path || 'unknown'}`;
    if (!nodes.find(n => n.id === srcNodeId)) {
      nodes.push({ id: srcNodeId, type: 'source_column', label: from.path || 'unknown', meta: { source_id: from.source_id, path: from.path } });
    }
    if (targetCol) {
      const tgtColNode = `t:${tg.db}.${tg.schema}.${tg.table}.${targetCol}`;
      edges.push({ id: makeEdgeId(), source: srcNodeId, target: tgtColNode, type: 'column_lineage', meta: { raw: m.rawTarget || null } });
      const tableEdgeKey = `src:${from.source_id}|t:${tg.db}.${tg.schema}.${tg.table}`;
      tableEdgesMap[tableEdgeKey] = tableEdgesMap[tableEdgeKey] || new Set<string>();
      tableEdgesMap[tableEdgeKey].add(targetCol);
    }
  }

  const table_edges: any[] = [];
  let teCounter = 1;
  for (const k of Object.keys(tableEdgesMap)) {
    const [srcIdPart, tgtPart] = k.split('|');
    const cols = Array.from(tableEdgesMap[k]);
    table_edges.push({ id: `te${teCounter++}`, source: srcIdPart, target: tgtPart, meta: { columns: cols } });
  }

  const out = { nodes, edges, table_edges };
  fs.writeFileSync(path.join(outDir, 'lineage.json'), JSON.stringify(out, null, 2), 'utf8');
  return out;
}