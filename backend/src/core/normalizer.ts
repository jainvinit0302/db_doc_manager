// backend/src/core/normalizer.ts
// ============================================
export function normalizeDbDoc(doc: any) {
  // Basic normalization to ensure consistent fields
  const targets = (doc.targets || []).map((t: any) => ({
    ...t,
    fullName: `${t.db}.${t.schema}`,
    tables: (t.tables || []).map((table: any) => ({
      ...table,
      fullName: `${t.db}.${t.schema}.${table.name}`,
    })),
  }));

  const mappings = (doc.mappings || []).map((m: any) => ({
    target: m.target || "unknown",
    target_table: m.target?.split(".").slice(0, -1).join(".") || "unknown",
    target_column: m.target?.split(".").pop() || "unknown",
    source_id: m.from?.source_id || null,
    source_path: m.from?.path || "",
    transform: m.from?.transform || "",
    rule: m.from?.rule || null,
  }));

  return { ...doc, targets, mappings };
}