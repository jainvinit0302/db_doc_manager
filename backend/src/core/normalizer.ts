export function normalizeDbDoc(doc: any) {
  const targetMap: Record<string, any> = {};

  (doc.targets || []).forEach((t: any) => {
    (t.tables || []).forEach((table: any) => {
      const fullName = `${t.db}.${t.schema}.${table.name}`;
      targetMap[fullName] = table;
    });
  });

  const normalizedMappings = (doc.mappings || []).map((m: any) => ({
    target: m.target,
    source: m.from?.source_id || null,
    path: m.from?.path || null,
    transform: m.from?.transform || null,
    validTarget: !!targetMap[m.target],
  }));

  return { ...doc, normalizedMappings };
}
