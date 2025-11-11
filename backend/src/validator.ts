// backend/src/validator.ts
import { NormalizedAST } from './parser';

export type ReferentialResult = {
  errors: string[];
  warnings: string[];
};

/**
 * Check referential integrity and completeness for the normalized AST.
 *
 * Rules:
 *  - mappings[].from.source_id must exist in ast.sources -> error
 *  - mappings[].target must point to an existing target table -> error
 *  - if target.column is specific (not '*') it must exist in target.columns -> error
 *  - every target column with not_null:true must have a mapping or a default or be pk -> error
 *  - wildcard mappings (column='*') produce a warning (must be expanded or have fields)
 */
export function referentialValidate(ast: NormalizedAST): ReferentialResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // quick maps
  const sourceIds = new Set(Object.keys(ast.sources || {}));
  const targetKeys = Object.keys(ast.targets || {}); // keys like db.schema.table

  // helper: find target key for a mapping target object
  function findTargetKey(t: any): string | null {
    if (!t || !t.db || !t.schema || !t.table) return null;
    const key = `${t.db}.${t.schema}.${t.table}`;
    return targetKeys.includes(key) ? key : null;
  }

  // Build mapping index: map targetKey -> set(columns mapped)
  const mappedColumns: Record<string, Set<string>> = {};
  for (const key of targetKeys) mappedColumns[key] = new Set<string>();

  // Validate mappings
  for (const m of ast.mappings || []) {
    // 1. source_id exists (if mapping uses source_id)
    const from = m.from || {};
    if (from.source_id) {
      if (!sourceIds.has(from.source_id)) {
        errors.push(`Mapping for target "${m.rawTarget}" references unknown source_id "${from.source_id}"`);
      }
    }

    // 2. target resolution
    const t = m.target || {};
    const tk = findTargetKey(t);
    if (!tk) {
      // If mapping target is raw or incomplete, mark error
      errors.push(`Mapping target "${m.rawTarget}" does not resolve to an existing target table (expected db.schema.table[.column])`);
      continue;
    }

    // 3. column handling
    const col = t.column || '*';
    if (col === '*' && from.fields) {
      // fields will map to explicit columns — add them to mapped set
      for (const fieldName of Object.keys(from.fields || {})) {
        mappedColumns[tk].add(fieldName);
      }
      warnings.push(`Mapping "${m.rawTarget}" uses wildcard/explode with 'fields' — please ensure fields align to target columns.`);
    } else if (col === '*') {
      warnings.push(`Mapping "${m.rawTarget}" targets wildcard '*' — consider expanding to target columns explicitly.`);
    } else {
      // explicit column name(s) might be composite or dot-joined; treat as literal
      // if column is like "col1.col2" or contains commas, split conservatively by ',' or ';'
      const cols = String(col).split(/[,\s;]+/).filter(Boolean);
      for (const c of cols) {
        mappedColumns[tk].add(c);
        // verify column exists on target
        const tgt = ast.targets[tk];
        if (!tgt) continue;
        if (!tgt.columns || !tgt.columns[c]) {
          errors.push(`Mapping target column "${c}" in mapping "${m.rawTarget}" does not exist in target ${tk}`);
        }
      }
    }
  }

  // Validate target columns completeness (not_null)
  for (const key of targetKeys) {
    const tgt = ast.targets[key];
    if (!tgt || !tgt.columns) continue;
    for (const colName of Object.keys(tgt.columns)) {
      const colDef = tgt.columns[colName] || {};
      const isNotNull = Boolean(colDef.not_null);
      const hasDefault = colDef.default !== undefined && colDef.default !== null && String(colDef.default).trim() !== '';
      const isPK = Boolean(colDef.pk);
      const mapped = mappedColumns[key] && mappedColumns[key].has(colName);

      if (isNotNull && !isPK && !hasDefault && !mapped) {
        errors.push(`Target column ${key}.${colName} is NOT NULL but has no mapping, default, or PK/generation rule.`);
      }
    }
  }

  // Optional: detect orphan sources (sources declared but not used in any mapping)
  const usedSources = new Set<string>();
  for (const m of ast.mappings || []) {
    if (m.from && m.from.source_id) usedSources.add(m.from.source_id);
  }
  for (const sid of Object.keys(ast.sources || {})) {
    if (!usedSources.has(sid)) {
      warnings.push(`Source "${sid}" is declared but not referenced in any mapping.`);
    }
  }

  return { errors, warnings };
}
