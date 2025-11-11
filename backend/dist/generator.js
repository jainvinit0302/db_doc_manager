"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeMappingCSV = writeMappingCSV;
exports.generateMermaidERD = generateMermaidERD;
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
function sanitizeTypeForMermaid(type) {
    if (!type)
        return 'UNKNOWN';
    let s = String(type).trim();
    // replace parentheses, commas, spaces with underscores
    s = s.replace(/[(),]/g, '_').replace(/\s+/g, '_');
    // collapse multiple underscores
    s = s.replace(/_+/g, '_');
    // remove leading/trailing underscores
    s = s.replace(/^_+|_+$/g, '');
    // optionally limit length
    if (s.length > 40)
        s = s.slice(0, 40);
    // uppercase for consistency
    return s.toUpperCase();
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
function generateMermaidERD(ast, outDir) {
    const erdDir = path_1.default.resolve(outDir);
    fs_1.default.mkdirSync(erdDir, { recursive: true });
    function sanitizeTypeForMermaid(type) {
        if (!type)
            return 'unknown';
        let s = String(type).trim();
        s = s.replace(/[(),]/g, '_').replace(/\s+/g, '_');
        s = s.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
        return s.toLowerCase();
    }
    const groups = {};
    for (const key of Object.keys(ast.targets || {})) {
        const t = ast.targets[key];
        const groupKey = `${t.db}.${t.schema}`;
        groups[groupKey] = groups[groupKey] || [];
        groups[groupKey].push(t);
    }
    for (const groupKey of Object.keys(groups)) {
        const lines = ['erDiagram'];
        for (const t of groups[groupKey]) {
            const tableName = t.table.replace(/[^A-Za-z0-9_]/g, '_');
            lines.push(`  ${tableName} {`);
            for (const colName of Object.keys(t.columns || {})) {
                const col = t.columns[colName] || {};
                const type = sanitizeTypeForMermaid(col.type || 'unknown');
                const flags = [];
                if (col.pk)
                    flags.push('PK');
                if (col.not_null)
                    flags.push('NOT_NULL');
                const flagStr = flags.length ? ' ' + flags.join(' ') : '';
                // type first (Mermaid standard): "type name [FLAGS]"
                lines.push(`    ${type} ${colName}${flagStr}`.trimEnd());
            }
            lines.push('  }');
            lines.push(''); // blank line between tables
        }
        const filename = `erd_${groupKey.replace(/\./g, '_')}.mmd`;
        const outPath = path_1.default.join(erdDir, filename);
        fs_1.default.writeFileSync(outPath, lines.join('\n'), 'utf8');
    }
}
