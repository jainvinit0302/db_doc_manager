// ============================================
// backend/src/core/schemaValidator.ts
// ============================================
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

export function validateSchema(data: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const addError = (msg: string, path = "") =>
    errors.push(path ? `${path}: ${msg}` : msg);
  const addWarning = (msg: string, path = "") =>
    warnings.push(path ? `${path}: ${msg}` : msg);

  // 1️⃣ Basic type check
  if (typeof data !== "object" || !data) {
    addError("Input must be a valid YAML/JSON object");
    return { valid: false, errors };
  }

  // 2️⃣ Project - Fixed: project can be string or object
  if (!data.project) {
    addError("Missing field: project");
  } else if (typeof data.project === "object") {
    if (!data.project.name) addError("Project.name is required");
  }

  // 3️⃣ Sources - Made optional
  if (data.sources) {
    if (!Array.isArray(data.sources)) {
      addError("Sources must be an array");
    } else {
      data.sources.forEach((src: any, i: number) => {
        const p = `sources[${i}]`;
        if (!src.id) addError("Source id is required", p); // Changed from 'name' to 'id'
        if (!src.kind) addError("Source kind is required", p);
        if (src.kind === "mongodb") {
          if (!src.db) addError("MongoDB requires db field", p);
          if (!src.collection) addError("MongoDB requires collection", p);
        }
      });
    }
  }

  // 4️⃣ Targets
  if (!Array.isArray(data.targets) || data.targets.length === 0) {
    addError("Targets must be a non-empty array");
  } else {
    data.targets.forEach((t: any, i: number) => {
      const p = `targets[${i}]`;
      if (!t.db) addError("Target db required", p);
      if (!t.schema) addError("Target schema required", p);
      if (!t.engine) addError("Target engine required", p);
      
      if (!Array.isArray(t.tables)) {
        addError("Target.tables must be array", p);
      } else if (t.tables.length === 0) {
        addWarning("Target has no tables", p);
      } else {
        t.tables.forEach((table: any, j: number) => {
          const tp = `${p}.tables[${j}]`;
          if (!table.name) addError("Table name required", tp);
          if (!Array.isArray(table.columns)) {
            addError("Table.columns must be array", tp);
          } else if (table.columns.length === 0) {
            addError("Table must have at least one column", tp);
          } else {
            // Validate columns
            const columnNames = new Set<string>();
            table.columns.forEach((col: any, k: number) => {
              const cp = `${tp}.columns[${k}]`;
              if (!col.name) addError("Column name required", cp);
              else if (columnNames.has(col.name)) {
                addError(`Duplicate column name '${col.name}'`, cp);
              }
              columnNames.add(col.name);
              if (!col.type) addError("Column type required", cp);
            });
          }
        });
      }
    });
  }

  // 5️⃣ Mappings - Made optional
  if (data.mappings) {
    if (!Array.isArray(data.mappings)) {
      addError("Mappings must be array");
    } else {
      const srcIds = new Set((data.sources || []).map((s: any) => s.id));
      const tgtColumns = new Set<string>();
      
      // Build set of valid target columns
      (data.targets || []).forEach((t: any) => {
        (t.tables || []).forEach((tb: any) => {
          (tb.columns || []).forEach((col: any) => {
            const fullPath = `${t.db}.${t.schema}.${tb.name}.${col.name}`;
            tgtColumns.add(fullPath);
          });
        });
      });

      data.mappings.forEach((m: any, i: number) => {
        const p = `mappings[${i}]`;
        if (!m.target) {
          addError("Mapping.target is required", p);
        } else if (!m.target.includes('*') && !tgtColumns.has(m.target)) {
          addError(`Target column '${m.target}' not found in schema`, p);
        }

        if (!m.from) {
          addError("Mapping.from is required", p);
        } else {
          if (m.from.source_id) {
            if (!srcIds.has(m.from.source_id)) {
              addError(`Source '${m.from.source_id}' not defined`, p);
            }
          } else if (!m.from.rule) {
            addError("Mapping.from must have either 'source_id' or 'rule'", p);
          }
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length ? warnings : undefined,
  };
}