"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDbdocFiles = loadDbdocFiles;
exports.validateStructure = validateStructure;
exports.normalize = normalize;
// backend/src/parser.ts
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Use require for glob to avoid ESM/CommonJS mismatch at runtime
const glob = require('glob');
const js_yaml_1 = __importDefault(require("js-yaml"));
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
/**
 * Robust JSON Schema loader
 */
const schemaPath = path_1.default.join(__dirname, '..', 'schemas', 'dbdoc.json');
let schema = null;
try {
    if (!fs_1.default.existsSync(schemaPath)) {
        throw new Error(`Schema file not found at: ${schemaPath}`);
    }
    const rawSchema = fs_1.default.readFileSync(schemaPath, 'utf8');
    if (!rawSchema || rawSchema.trim().length === 0) {
        throw new Error(`Schema file is empty: ${schemaPath}`);
    }
    try {
        schema = JSON.parse(rawSchema);
    }
    catch (parseErr) {
        throw new Error(`Failed to parse JSON schema at ${schemaPath}: ${parseErr.message}`);
    }
}
catch (err) {
    console.error('Error loading JSON Schema for DBDoc DSL:');
    console.error(String(err.message || err));
    // Exit immediately because parser can't function without schema
    process.exit(2);
}
/**
 * AJV setup with formats
 */
const ajv = new ajv_1.default({ allErrors: true, allowUnionTypes: true });
(0, ajv_formats_1.default)(ajv);
const validateSchema = ajv.compile(schema);
/**
 * Load .dbdoc files (yaml/json) from a directory.
 * Returns an array of LoadResult. If none found, returns [] (caller handles).
 */
function loadDbdocFiles(dir = '.dbdoc') {
    // Resolve dir relative to current working directory
    const resolvedPath = path_1.default.isAbsolute(dir) ? dir : path_1.default.resolve(process.cwd(), dir);
    // If path doesn't exist -> return []
    if (!fs_1.default.existsSync(resolvedPath)) {
        return [];
    }
    const stat = fs_1.default.statSync(resolvedPath);
    // Helper: check allowed extensions
    const allowedExt = (name) => {
        const n = name.toLowerCase();
        return n.endsWith('.yml') || n.endsWith('.yaml') || n.endsWith('.dbdoc') || n.endsWith('.json');
    };
    // If the path is a single file and matches extension -> return that file
    if (stat.isFile()) {
        if (!allowedExt(resolvedPath)) {
            return [];
        }
        const raw = fs_1.default.readFileSync(resolvedPath, 'utf8');
        let parsed;
        try {
            parsed = js_yaml_1.default.load(raw);
        }
        catch (err) {
            throw new Error(`YAML parse error in ${resolvedPath}: ${String(err.message || err)}`);
        }
        return [{ path: resolvedPath, raw, parsed }];
    }
    // Otherwise it's a directory — walk recursively
    const results = [];
    function walk(dirPath) {
        const entries = fs_1.default.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const full = path_1.default.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            }
            else if (entry.isFile() && allowedExt(entry.name)) {
                let raw;
                try {
                    raw = fs_1.default.readFileSync(full, 'utf8');
                }
                catch (err) {
                    throw new Error(`Failed to read file ${full}: ${err.message || err}`);
                }
                let parsed;
                try {
                    parsed = js_yaml_1.default.load(raw);
                }
                catch (err) {
                    throw new Error(`YAML parse error in ${full}: ${String(err.message || err)}`);
                }
                results.push({ path: full, raw, parsed });
            }
        }
    }
    walk(resolvedPath);
    return results;
}
/**
 * Validate parsed object against JSON Schema (AJV)
 */
function validateStructure(parsed) {
    const valid = validateSchema(parsed);
    return { valid: Boolean(valid), errors: validateSchema.errors || undefined };
}
/**
 * Helper to qualify a target table
 */
function qualifyTarget(db, schema, table) {
    return `${db}.${schema}.${table}`;
}
/**
 * Normalize parsed DSL into a simple AST used by generators.
 * - builds sources map by id
 * - builds targets map keyed by "db.schema.table" with columns map
 * - normalizes mappings with parsed target components
 */
function normalize(parsed) {
    const project = parsed.project || 'unnamed_project';
    // Build sources map keyed by source.id
    const sources = {};
    for (const s of parsed.sources || []) {
        if (!s || !s.id)
            continue;
        sources[s.id] = s;
    }
    // Build targets map keyed by "db.schema.table"
    const targets = {};
    for (const t of parsed.targets || []) {
        const db = t.db;
        const schemaName = t.schema;
        for (const tbl of t.tables || []) {
            const q = qualifyTarget(db, schemaName, tbl.name);
            const colsMap = {};
            for (const col of tbl.columns || []) {
                colsMap[col.name] = col;
            }
            targets[q] = {
                db,
                schema: schemaName,
                table: tbl.name,
                description: tbl.description,
                owner: tbl.owner,
                columns: colsMap
            };
        }
    }
    // Normalize mappings
    const mappings = [];
    for (const m of parsed.mappings || []) {
        const targetStr = m.target;
        let targ = {};
        if (typeof targetStr === 'string') {
            const parts = targetStr.split('.');
            // Accept patterns:
            // db.schema.table.column
            // db.schema.table (implies wildcard *)
            // allow column to be wildcard '*' or 'table.*'
            if (parts.length >= 4) {
                targ = { db: parts[0], schema: parts[1], table: parts[2], column: parts.slice(3).join('.') };
            }
            else if (parts.length === 3) {
                targ = { db: parts[0], schema: parts[1], table: parts[2], column: '*' };
            }
            else {
                // fallback: keep raw
                targ = { raw: targetStr };
            }
        }
        else {
            targ = { raw: targetStr };
        }
        mappings.push({
            rawTarget: targetStr,
            target: targ,
            from: m.from || null,
            notes: m.notes || null,
            tags: m.tags || []
        });
    }
    return { project, sources, targets, mappings };
}
