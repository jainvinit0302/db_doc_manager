// backend/src/parser.ts
import fs from 'fs';
import path from 'path';
// Use require for glob to avoid ESM/CommonJS mismatch at runtime
const glob: any = require('glob');
import yaml from 'js-yaml';
import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Robust JSON Schema loader
 */
const schemaPath = path.join(__dirname, '..', 'schemas', 'dbdoc.json');

let schema: any = null;
try {
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found at: ${schemaPath}`);
  }
  const rawSchema = fs.readFileSync(schemaPath, 'utf8');
  if (!rawSchema || rawSchema.trim().length === 0) {
    throw new Error(`Schema file is empty: ${schemaPath}`);
  }
  try {
    schema = JSON.parse(rawSchema);
  } catch (parseErr: any) {
    throw new Error(`Failed to parse JSON schema at ${schemaPath}: ${parseErr.message}`);
  }
} catch (err: any) {
  console.error('Error loading JSON Schema for DBDoc DSL:');
  console.error(String(err.message || err));
  // Exit immediately because parser can't function without schema
  process.exit(2);
}

/**
 * AJV setup with formats
 */
const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);

/**
 * Types
 */
export type LoadResult = {
  path: string;
  raw: string;
  parsed: any;
};

export type NormalizedAST = {
  project: string;
  sources: Record<string, any>;
  targets: Record<string, any>; // keyed by db.schema.table
  mappings: Array<any>;
};

/**
 * Load .dbdoc files (yaml/json) from a directory.
 * Returns an array of LoadResult. If none found, returns [] (caller handles).
 */
export function loadDbdocFiles(dir = '.dbdoc'): LoadResult[] {
  // Resolve dir relative to current working directory
  const resolvedPath = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);

  // If path doesn't exist -> return []
  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  const stat = fs.statSync(resolvedPath);

  // Helper: check allowed extensions
  const allowedExt = (name: string) => {
    const n = name.toLowerCase();
    return n.endsWith('.yml') || n.endsWith('.yaml') || n.endsWith('.dbdoc') || n.endsWith('.json');
  };

  // If the path is a single file and matches extension -> return that file
  if (stat.isFile()) {
    if (!allowedExt(resolvedPath)) {
      return [];
    }
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    let parsed: any;
    try {
      parsed = yaml.load(raw);
    } catch (err: any) {
      throw new Error(`YAML parse error in ${resolvedPath}: ${String(err.message || err)}`);
    }
    return [{ path: resolvedPath, raw, parsed }];
  }

  // Otherwise it's a directory — walk recursively
  const results: LoadResult[] = [];

  function walk(dirPath: string) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && allowedExt(entry.name)) {
        let raw: string;
        try {
          raw = fs.readFileSync(full, 'utf8');
        } catch (err: any) {
          throw new Error(`Failed to read file ${full}: ${err.message || err}`);
        }
        let parsed: any;
        try {
          parsed = yaml.load(raw);
        } catch (err: any) {
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
export function validateStructure(parsed: any): { valid: boolean; errors?: ErrorObject[] } {
  const valid = validateSchema(parsed);
  return { valid: Boolean(valid), errors: validateSchema.errors || undefined };
}

/**
 * Helper to qualify a target table
 */
function qualifyTarget(db: string, schema: string, table: string) {
  return `${db}.${schema}.${table}`;
}

/**
 * Normalize parsed DSL into a simple AST used by generators.
 * - builds sources map by id
 * - builds targets map keyed by "db.schema.table" with columns map
 * - normalizes mappings with parsed target components
 */
export function normalize(parsed: any): NormalizedAST {
  const project = parsed.project || 'unnamed_project';

  // Build sources map keyed by source.id
  const sources: Record<string, any> = {};
  for (const s of parsed.sources || []) {
    if (!s || !s.id) continue;
    sources[s.id] = s;
  }

  // Build targets map keyed by "db.schema.table"
  const targets: Record<string, any> = {};
  for (const t of parsed.targets || []) {
    const db = t.db;
    const schemaName = t.schema;
    for (const tbl of t.tables || []) {
      const q = qualifyTarget(db, schemaName, tbl.name);
      const colsMap: Record<string, any> = {};
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
  const mappings: any[] = [];
  for (const m of parsed.mappings || []) {
    const targetStr: string = m.target;
    let targ: any = {};
    if (typeof targetStr === 'string') {
      const parts = targetStr.split('.');
      // Accept patterns:
      // db.schema.table.column
      // db.schema.table (implies wildcard *)
      // allow column to be wildcard '*' or 'table.*'
      if (parts.length >= 4) {
        targ = { db: parts[0], schema: parts[1], table: parts[2], column: parts.slice(3).join('.') };
      } else if (parts.length === 3) {
        targ = { db: parts[0], schema: parts[1], table: parts[2], column: '*' };
      } else {
        // fallback: keep raw
        targ = { raw: targetStr };
      }
    } else {
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
