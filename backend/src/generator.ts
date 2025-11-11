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

function sanitizeTypeForMermaid(type: any): string {
  if (!type) return 'UNKNOWN';
  let s = String(type).trim();
  s = s.replace(/[(),]/g, '_').replace(/\s+/g, '_');
  s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  if (s.length > 40) s = s.slice(0, 40);
  return s.toUpperCase();
}

/* =========================================================
   🧩 1. Mapping Matrix (Existing)
   ========================================================= */
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

/* =========================================================
   🧱 2. ERD Generator (Existing)
   ========================================================= */
export function generateMermaidERD(ast: NormalizedAST, outDir: string) {
  const erdDir = path.resolve(outDir);
  fs.mkdirSync(erdDir, { recursive: true });

  function sanitizeTypeForMermaid(type: any): string {
    if (!type) return 'unknown';
    let s = String(type).trim();
    s = s.replace(/[(),]/g, '_').replace(/\s+/g, '_');
    s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    return s.toLowerCase();
  }

  const groups: Record<string, any[]> = {};
  for (const key of Object.keys(ast.targets || {})) {
    const t = ast.targets[key];
    const groupKey = `${t.db}.${t.schema}`;
    groups[groupKey] = groups[groupKey] || [];
    groups[groupKey].push(t);
  }

  for (const groupKey of Object.keys(groups)) {
    const lines: string[] = ['erDiagram'];
    for (const t of groups[groupKey]) {
      const tableName = t.table.replace(/[^A-Za-z0-9_]/g, '_');
      lines.push(`  ${tableName} {`);
      for (const colName of Object.keys(t.columns || {})) {
        const col = t.columns[colName] || {};
        const type = sanitizeTypeForMermaid(col.type || 'unknown');
        const flags: string[] = [];
        if (col.pk) flags.push('PK');
        if (col.not_null) flags.push('NOT_NULL');
        const flagStr = flags.length ? ' ' + flags.join(' ') : '';
        lines.push(`    ${type} ${colName}${flagStr}`.trimEnd());
      }
      lines.push('  }');
      lines.push('');
    }
    const filename = `erd_${groupKey.replace(/\./g, '_')}.mmd`;
    const outPath = path.join(erdDir, filename);
    fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  }
}

/* =========================================================
   🔗 3. NEW: Data Lineage Graph Generator
   ========================================================= */
export function generateLineageGraph(ast: NormalizedAST, outDir: string) {
  const lineageDir = path.resolve(outDir);
  ensureDir(lineageDir);

  const nodes: Record<string, any> = {};
  const edges: any[] = [];

  for (const mapping of ast.mappings || []) {
    const { from, target } = mapping;
    if (!from || !target) continue;

    // Create source node
    const srcId = from.source_id
      ? `${from.source_id}${from.path ? '.' + from.path : ''}`
      : 'unknown_source';
    nodes[srcId] = {
      id: srcId,
      label: srcId,
      type: 'source'
    };

    // Create target node
    const tgtId = `${target.db}.${target.schema}.${target.table}.${target.column}`;
    nodes[tgtId] = {
      id: tgtId,
      label: tgtId,
      type: 'target'
    };

    // Create edge
    edges.push({
      id: `${srcId}->${tgtId}`,
      source: srcId,
      target: tgtId,
      transform: from.transform || null
    });
  }

  const graph = {
    project: ast.project,
    generated_at: new Date().toISOString(),
    nodes: Object.values(nodes),
    edges
  };

  const outPath = path.join(lineageDir, 'lineage.json');
  fs.writeFileSync(outPath, JSON.stringify(graph, null, 2), 'utf8');
  console.log(`✅ Lineage graph written to ${outPath}`);
}
