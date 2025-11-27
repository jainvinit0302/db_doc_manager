import fs from 'fs';
import path from 'path';
import { NormalizedAST } from './parser';

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

function sanitizeTypeForMermaid(rawType: string | undefined | null) {
  if (!rawType) return 'unknown';
  let s = String(rawType).trim();
  // replace parentheses, commas, spaces with underscores; remove non-alnum/_ characters
  s = s.replace(/\(/g, '_').replace(/\)/g, '').replace(/,+/g, '_');
  s = s.replace(/[^A-Za-z0-9_]/g, '_');
  s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  // keep lowercase to be consistent
  return s.toLowerCase();
}

function sanitizeName(raw: string) {
  return String(raw || '').trim().replace(/[^A-Za-z0-9_]/g, '_');
}

export function writeMappingCSV(ast: NormalizedAST, outDir: string) {
  const artifactsDir = path.resolve(outDir);
  ensureDir(artifactsDir);

  const header = [
    'target_db',
    'target_schema',
    'target_table',
    'target_column',
    'target_type',
    'source_id',
    'source_path',
    'transform',
    'default',
    'mapping_rule',
    'notes'
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
      csvEscape(db),
      csvEscape(schema),
      csvEscape(table),
      csvEscape(column),
      csvEscape(targetType),
      csvEscape(from.source_id || ''),
      csvEscape(from.path || ''),
      csvEscape(from.transform || ''),
      csvEscape(from.default || ''),
      csvEscape(from.rule || ''),
      csvEscape(m.notes || '')
    ].join(',');

    rows.push(row);
  }

  const csvPath = path.join(artifactsDir, 'mapping_matrix.csv');
  fs.writeFileSync(csvPath, rows.join('\n'), 'utf8');
}

export function generateMermaidERD(ast: any, erdDir: string) {
  if (!ast || !ast.targets) return [];
  fs.mkdirSync(erdDir, { recursive: true });

  const written: Array<{ name: string; content: string }> = [];

  // build a quick lookup from simple table name -> full target key(s)
  // e.g., dim_product -> [ "dw.mart.dim_product", ... ]
  const simpleNameIndex: Record<string, string[]> = {};
  for (const tk of Object.keys(ast.targets || {})) {
    const t = ast.targets[tk];
    const simple = String(t.table || '').trim();
    if (!simple) continue;
    simpleNameIndex[simple] = simpleNameIndex[simple] || [];
    simpleNameIndex[simple].push(tk); // full key
  }

  // group tables by db.schema
  const tablesBySchema: Record<string, any[]> = {};
  for (const tkey of Object.keys(ast.targets || {})) {
    const t = ast.targets[tkey];
    const schemaKey = `${t.db}__${t.schema}`; // use __ to avoid dots in filename
    tablesBySchema[schemaKey] = tablesBySchema[schemaKey] || [];
    tablesBySchema[schemaKey].push(t);
  }

  for (const schemaKey of Object.keys(tablesBySchema)) {
    const parts = schemaKey.split('__');
    const db = parts[0];
    const schema = parts[1] || 'public';
    const tables = tablesBySchema[schemaKey];

    // Build erDiagram content (including FK edges after tables)
    const erLines: string[] = ['erDiagram'];

    // collect rel lines separately
    const relLines: string[] = [];

    for (const t of tables) {
      const tableName = sanitizeName(t.table);

      // start table block
      erLines.push('');
      erLines.push(`  ${tableName} {`);

      for (const colNameRaw of Object.keys(t.columns || {})) {
        const col = t.columns[colNameRaw];

        // sanitize column name and type
        const colName = sanitizeName(colNameRaw);
        // keep simple type token for erDiagram (avoid parentheses/flags that can break parser)
        const ty = sanitizeTypeForMermaid(col.type || '');

        // IMPORTANT: do NOT append PK/FK/NOT_NULL/UNIQUE tokens here for erDiagram
        // (these tokens have caused parse errors in mermaid's erDiagram grammar)
        erLines.push(`    ${colName} ${ty}`);
      }

      // close table block and add an explicit blank line after it
      erLines.push('  }');
      erLines.push('');
    }

    // Create FK relationships (unchanged logic but emit after a blank line)
    for (const t of tables) {
      const childTableName = sanitizeName(t.table);
      for (const colNameRaw of Object.keys(t.columns || {})) {
        const col = t.columns[colNameRaw];
        if (col && col.fk) {
          const fkObj = typeof col.fk === 'string' ? { table: col.fk } : col.fk || {};
          let fkTableSimple = fkObj.table || fkObj.table_name || fkObj.ref || null;
          let fkColumn = fkObj.column || fkObj.col || null;

          if (!fkTableSimple) {
            const maybe = String(fkObj).trim();
            if (maybe && maybe.includes('.')) {
              const parts = maybe.split('.');
              fkTableSimple = parts[parts.length - 2] || parts[0];
              fkColumn = fkColumn || parts[parts.length - 1];
            }
          }

          let parentFullKey: string | null = null;
          if (fkTableSimple) {
            const candidates = simpleNameIndex[String(fkTableSimple).trim()] || [];
            if (candidates.length === 1) {
              parentFullKey = candidates[0];
            } else if (candidates.length > 1) {
              const prefer = candidates.find(c => c.includes(`.${schema}.`) || c.includes(`${db}.${schema}.`));
              parentFullKey = prefer || candidates[0];
            }
          }

          if (parentFullKey) {
            const parentParts = parentFullKey.split('.');
            const parentTableSimple = parentParts[parentParts.length - 1] || fkTableSimple;
            const parentTableName = sanitizeName(parentTableSimple);
            const left = parentTableName;
            const right = childTableName;
            // Simplified label: just the FK column name
            const label = sanitizeName(fkColumn || 'fk');
            relLines.push(`  ${left} ||--o{ ${right} : "${label}"`);
          } else {
            const left = sanitizeName(fkTableSimple || 'unknown_parent');
            const right = childTableName;
            // Simplified label: just the FK column name
            const label = sanitizeName(fkColumn || 'fk');
            relLines.push(`  ${left} ||--o{ ${right} : "${label}"`);
          }
        }
      }
    }

    // append relationships with a blank line separator
    if (relLines.length) {
      erLines.push('');
      erLines.push('  %% Relationships');
      for (const rl of relLines) erLines.push(rl);
      erLines.push('');
    }

    const erContent = erLines.join('\n').replace(/\n{3,}/g, '\n\n') + '\n';
    const erName = `erd_${db}_${schema}.mmd`;
    fs.writeFileSync(path.join(erdDir, erName), erContent, 'utf8');
    written.push({ name: erName, content: erContent });
  }

  return written;
}

export function generateLineageJSON(ast: any, outDir: string) {
  fs.mkdirSync(outDir, { recursive: true });

  const nodes: any[] = [];
  const edges: any[] = [];
  const tableEdgesMap: Record<string, Set<string>> = {}; // "srcId|tgtKey" -> set(columns)

  // 1) Add source nodes and source-column nodes (if mappings reference JSONPath -> create nodes per path)
  for (const sid of Object.keys(ast.sources || {})) {
    const s = ast.sources[sid];
    const srcNodeId = `src:${sid}`;
    nodes.push({ id: srcNodeId, type: 'source', label: `${sid}`, meta: { ...s } });

    // We don't pre-create all source-field nodes. We'll create source-field nodes per mapping usage.
  }

  // 2) Add table and column nodes for targets
  for (const tgtKey of Object.keys(ast.targets || {})) {
    const t = ast.targets[tgtKey];
    const tableNodeId = `t:${t.db}.${t.schema}.${t.table}`;
    nodes.push({ id: tableNodeId, type: 'table', label: `${t.db}.${t.schema}.${t.table}`, meta: { db: t.db, schema: t.schema, table: t.table } });

    for (const colName of Object.keys(t.columns || {})) {
      const col = t.columns[colName];
      const colNodeId = `t:${t.db}.${t.schema}.${t.table}.${colName}`;
      nodes.push({ id: colNodeId, type: 'column', label: colName, meta: { ...col, table: `${t.db}.${t.schema}.${t.table}` } });
    }
  }

  // 3) Walk mappings to produce edges (and create source-field nodes)
  let edgeCounter = 1;
  const makeEdgeId = () => `e${edgeCounter++}`;

  for (const m of ast.mappings || []) {
    // target: object or raw. We normalized earlier; target should be { db,schema,table,column? } else skip
    const tg = m.target || {};
    const from = m.from || {};
    const targetTableKey = tg.db && tg.schema && tg.table ? `${tg.db}.${tg.schema}.${tg.table}` : null;
    const targetCol = tg.column || null;

    // For wildcard/array explosion with 'fields' mapping
    if (targetCol === '*' && from.fields && typeof from.fields === 'object') {
      for (const targetColName of Object.keys(from.fields)) {
        const srcSpec = from.fields[targetColName]; // could be JSONPath or $index
        const srcNodeId = `src:${from.source_id}:${String(srcSpec)}`;
        // create source column node if not exists
        if (!nodes.find(n => n.id === srcNodeId)) {
          nodes.push({ id: srcNodeId, type: 'source_column', label: String(srcSpec), meta: { source_id: from.source_id, path: srcSpec } });
        }

        // create edge to target column
        const tgtColNode = `t:${tg.db}.${tg.schema}.${tg.table}.${targetColName}`;
        edges.push({ id: makeEdgeId(), source: srcNodeId, target: tgtColNode, type: 'column_lineage', meta: { transform: from.transform || null, rule: from.rule || null, raw: m.rawTarget || null } });

        // table-level aggregator
        const tableEdgeKey = `src:${from.source_id}|t:${tg.db}.${tg.schema}.${tg.table}`;
        tableEdgesMap[tableEdgeKey] = tableEdgesMap[tableEdgeKey] || new Set<string>();
        tableEdgesMap[tableEdgeKey].add(targetColName);
      }
      continue;
    }

    // normal single-column mapping
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

    // generated surrogate keys: rule-based (e.g., sequence) -> create special node and table-level edge
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

    // other cases — create a 'unknown' mapping edge with raw info
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
  } // mappings

  // 4) produce table-level edges array from tableEdgesMap
  const table_edges = [];
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