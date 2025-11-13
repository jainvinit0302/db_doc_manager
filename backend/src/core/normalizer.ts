// backend/src/core/normalizer.ts
// ============================================
// Produces a fully canonical AST for generators.

export function normalizeDbDoc(doc: any) {
  const normalized: any = { ...doc };

  // -----------------------------------------------------
  // 1. Normalize targets (db, schema, table, columns)
  // -----------------------------------------------------
  normalized.targets = (doc.targets || []).map((t: any) => {
    const db = t.db || "default_db";
    const schema = t.schema || "public";

    const tables = (t.tables || []).map((tbl: any) => {
      const columns = (tbl.columns || []).map((col: any) => ({
        name: col.name,
        type: col.type || "STRING",
        pk: !!col.pk,
        not_null: !!col.not_null,
        unique: !!col.unique,
        default: col.default || null,
        description: col.description || "",
        fullName: `${db}.${schema}.${tbl.name}.${col.name}`
      }));

      return {
        ...tbl,
        db,
        schema,
        fullName: `${db}.${schema}.${tbl.name}`,
        columns
      };
    });

    return {
      ...t,
      db,
      schema,
      fullName: `${db}.${schema}`,
      tables
    };
  });

  // Build a quick lookup for column resolution
  const targetColumnIndex = new Map(); // full column name → metadata
  normalized.targets.forEach((t: any) => {
    t.tables.forEach((tbl: any) => {
      tbl.columns.forEach((col: any) => {
        targetColumnIndex.set(col.fullName, col);
      });
    });
  });

  // -----------------------------------------------------
  // 2. Normalize mappings (the most important part)
  // -----------------------------------------------------
  normalized.mappings = (doc.mappings || []).flatMap((m: any) => {
    const target = m.target || "";
    const from = m.from || {};

    // --------------------------------------------
    // Case A: wildcard mapping (explode arrays)
    // --------------------------------------------
    if (target.endsWith(".*") && from.fields) {
      const base = target.replace(".*", ""); // dw.mart.fct_order_line
      return Object.entries(from.fields).map(([colName, path]) => ({
        target: `${base}.${colName}`,
        target_table: base,
        target_column: colName,

        source_id: from.source_id || null,
        source_path: from.path || "",   // parent array path ($.lines[*])
        field_path: path,               // field-level path (e.g., $.sku)
        transform: from.transform || null,
        rule: from.rule || null,

        mapping_type: "explode"
      }));
    }

    // --------------------------------------------
    // Case B: direct source-column mapping
    // --------------------------------------------
    if (from.source_id && from.path) {
      // target: dw.mart.dim_user.email
      const parts = target.split(".");
      const col = parts.pop();
      const tbl = parts.join(".");

      return [{
        target,
        target_table: tbl,
        target_column: col,

        source_id: from.source_id,
        source_path: from.path,
        transform: from.transform || null,
        rule: null,
        mapping_type: "direct"
      }];
    }

    // --------------------------------------------
    // Case C: rule-only mapping (generate surrogate keys)
    // --------------------------------------------
    if (from.rule) {
      const parts = target.split(".");
      const col = parts.pop();
      const tbl = parts.join(".");

      return [{
        target,
        target_table: tbl,
        target_column: col,
        source_id: null,
        source_path: null,
        transform: null,
        rule: from.rule,
        mapping_type: "rule"
      }];
    }

    // --------------------------------------------
    // Fallback: invalid mapping
    // --------------------------------------------
    return [{
      target,
      target_table: "",
      target_column: "",
      source_id: null,
      source_path: "",
      transform: null,
      rule: null,
      mapping_type: "invalid"
    }];
  });

  return normalized;
}
