"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeMappingCSV = writeMappingCSV;
exports.generateMermaidERD = generateMermaidERD;
exports.generateLineageJSON = generateLineageJSON;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function ensureDir(dirPath) {
    fs_1.default.mkdirSync(dirPath, { recursive: true });
}
function csvEscape(value) {
    if (value === null || value === undefined)
        return '';
    const s = String(value);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}
function sanitizeTypeForMermaid(rawType) {
    if (!rawType)
        return 'unknown';
    let s = String(rawType).trim();
    // replace parentheses, commas, spaces with underscores; remove non-alnum/_ characters
    s = s.replace(/\(/g, '_').replace(/\)/g, '').replace(/,+/g, '_');
    s = s.replace(/[^A-Za-z0-9_]/g, '_');
    s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    // keep lowercase to be consistent
    return s.toLowerCase();
}
function sanitizeName(raw) {
    return String(raw || '').trim().replace(/[^A-Za-z0-9_]/g, '_');
}
function writeMappingCSV(ast, outDir) {
    const artifactsDir = path_1.default.resolve(outDir);
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
    const rows = [header.join(',')];
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
    const csvPath = path_1.default.join(artifactsDir, 'mapping_matrix.csv');
    fs_1.default.writeFileSync(csvPath, rows.join('\n'), 'utf8');
}
function generateMermaidERD(ast, erdDir) {
    if (!ast || !ast.targets)
        return [];
    fs_1.default.mkdirSync(erdDir, { recursive: true });
    const written = [];
    // group tables by db.schema
    const tablesBySchema = {};
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
        // Build erDiagram content
        const erLines = ['erDiagram'];
        for (const t of tables) {
            const tableName = sanitizeName(t.table);
            erLines.push(`  ${tableName} {`);
            for (const colNameRaw of Object.keys(t.columns || {})) {
                const col = t.columns[colNameRaw];
                const colName = sanitizeName(colNameRaw);
                const ty = sanitizeTypeForMermaid(col.type || col.type?.toString?.() || '');
                const flags = [];
                if (col.pk)
                    flags.push('PK');
                if (col.fk)
                    flags.push('FK');
                if (col.not_null)
                    flags.push('NOT_NULL');
                if (col.unique)
                    flags.push('UNIQUE');
                const flagStr = flags.length ? ' ' + flags.join(' ') : '';
                // Format: columnName TYPE FLAGS
                erLines.push(`    ${colName} ${ty}${flagStr}`);
            }
            erLines.push('  }');
            erLines.push('');
        }
        const erContent = erLines.join('\n') + '\n';
        const erName = `erd_${db}_${schema}.mmd`;
        fs_1.default.writeFileSync(path_1.default.join(erdDir, erName), erContent, 'utf8');
        written.push({ name: erName, content: erContent });
        // Build classDiagram content (fallback)
        const classLines = ['classDiagram'];
        for (const t of tables) {
            const tableName = sanitizeName(t.table);
            classLines.push(`  class ${tableName} {`);
            for (const colNameRaw of Object.keys(t.columns || {})) {
                const col = t.columns[colNameRaw];
                const colName = sanitizeName(colNameRaw);
                const ty = sanitizeTypeForMermaid(col.type || '');
                // class diagram expects "+ name : type"
                classLines.push(`    + ${colName} : ${ty}`);
            }
            classLines.push('  }');
            classLines.push('');
        }
        const classContent = classLines.join('\n') + '\n';
        const className = `class_${db}_${schema}.mmd`;
        fs_1.default.writeFileSync(path_1.default.join(erdDir, className), classContent, 'utf8');
        written.push({ name: className, content: classContent });
    }
    return written;
}
function generateLineageJSON(ast, outDir) {
    fs_1.default.mkdirSync(outDir, { recursive: true });
    const nodes = [];
    const edges = [];
    const tableEdgesMap = {}; // "srcId|tgtKey" -> set(columns)
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
                tableEdgesMap[tableEdgeKey] = tableEdgesMap[tableEdgeKey] || new Set();
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
            tableEdgesMap[tableEdgeKey] = tableEdgesMap[tableEdgeKey] || new Set();
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
            tableEdgesMap[tableEdgeKey] = tableEdgesMap[tableEdgeKey] || new Set();
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
            tableEdgesMap[tableEdgeKey] = tableEdgesMap[tableEdgeKey] || new Set();
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
    fs_1.default.writeFileSync(path_1.default.join(outDir, 'lineage.json'), JSON.stringify(out, null, 2), 'utf8');
    return out;
}
