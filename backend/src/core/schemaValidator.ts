// backend/src/core/schemaValidator.ts
// Custom DSL validator for DBDocManager — semantic layer
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

  // 2️⃣ Project
  if (!data.project) addError("Missing section: project");
  else if (typeof data.project === "string") addError("Project must be object");
  else {
    if (!data.project.name) addError("Project.name is required");
  }

  // 3️⃣ Sources
  if (!Array.isArray(data.sources) || data.sources.length === 0) {
    addError("Sources must be a non-empty array");
  } else {
    data.sources.forEach((src: any, i: number) => {
      const p = `sources[${i}]`;
      if (!src.name) addError("Source name is required", p);
      if (!src.kind) addError("Source kind is required", p);
      if (src.kind === "mongodb" && !src.collection)
        addError("MongoDB requires collection", p);
    });
  }

  // 4️⃣ Targets
  if (!Array.isArray(data.targets) || data.targets.length === 0) {
    addError("Targets must be a non-empty array");
  } else {
    data.targets.forEach((t: any, i: number) => {
      const p = `targets[${i}]`;
      if (!t.db) addError("Target db required", p);
      if (!Array.isArray(t.tables)) addError("Target.tables must be array", p);
      else
        t.tables.forEach((table: any, j: number) => {
          const tp = `${p}.tables[${j}]`;
          if (!table.name) addError("Table name required", tp);
          if (!Array.isArray(table.columns))
            addError("Table.columns must be array", tp);
          else if (table.columns.length === 0)
            addError("Table must have at least one column", tp);
        });
    });
  }

  // 5️⃣ Mappings
  if (!Array.isArray(data.mappings)) addError("Mappings must be array");
  else {
    const srcNames = new Set((data.sources || []).map((s: any) => s.name));
    const tgtTables = new Set(
      (data.targets || [])
        .flatMap((t: any) =>
          (t.tables || []).map((tb: any) => tb.name)
        )
    );

    data.mappings.forEach((m: any, i: number) => {
      const p = `mappings[${i}]`;
      if (!m.target) addError("Mapping.target is required", p);
      else {
        const parts = m.target.split(".");
        const tableName = parts.length === 4 ? parts[2] : parts[0];
        if (!tgtTables.has(tableName))
          addError(`Target table '${tableName}' not found`, p);
      }

      if (!m.from) addError("Mapping.from is required", p);
      else if (typeof m.from === "object" && m.from.source_id) {
        if (!srcNames.has(m.from.source_id))
          addError(`Source '${m.from.source_id}' not defined`, p);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings: warnings.length ? warnings : undefined,
  };
}
