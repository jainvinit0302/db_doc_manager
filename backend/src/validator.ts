// backend/src/validator.ts
export function referentialValidate(ast: any): { warnings: string[] } {
  const warnings: string[] = [];

  const sourceIds = new Set((ast.sources || []).map((s: any) => s.id));
  const targetTablePaths = new Set<string>();

  (ast.targets || []).forEach((t: any) => {
    (t.tables || []).forEach((tbl: any) => {
      const basePath = `${t.db}.${t.schema}.${tbl.name}`;
      (tbl.columns || []).forEach((col: any) => {
        targetTablePaths.add(`${basePath}.${col.name}`);
      });
    });
  });

  (ast.mappings || []).forEach((m: any, idx: number) => {
    const srcId = m.from?.source_id;
    const targetPath = m.target;

    if (srcId && !sourceIds.has(srcId)) {
      warnings.push(`Mapping[${idx}] references unknown source '${srcId}'.`);
    }

    if (targetPath && !targetTablePaths.has(targetPath)) {
      warnings.push(`Mapping[${idx}] references unknown target column '${targetPath}'.`);
    }

    if (!m.from?.path && !m.from?.rule) {
      warnings.push(`Mapping[${idx}] must specify either 'from.path' or 'from.rule'.`);
    }
  });

  (ast.targets || []).forEach((t: any) => {
    (t.tables || []).forEach((tbl: any) => {
      (tbl.columns || []).forEach((col: any) => {
        if (col.required) {
          const colPath = `${t.db}.${t.schema}.${tbl.name}.${col.name}`;
          const mapped = (ast.mappings || []).some((m: any) => m.target === colPath);
          if (!mapped) {
            warnings.push(`Required target column '${colPath}' has no mapping/default.`);
          }
        }
      });
    });
  });

  return { warnings };
}
