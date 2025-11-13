
// backend/src/generators/erdGenerator.ts
// Enhanced ERD with better styling

export function generateERD(data: any): string {
  if (!data.targets || data.targets.length === 0) {
    return 'erDiagram\n  NO_DATA[No tables defined]';
  }
  
  let mermaid = 'erDiagram\n';
  
  data.targets.forEach((target: any) => {
    target.tables?.forEach((table: any) => {
      const tableName = `${target.schema}_${table.name}`.replace(/[^a-zA-Z0-9_]/g, '_');
      
      mermaid += `  ${tableName} {\n`;
      
      table.columns?.forEach((col: any) => {
        const type = col.type?.split('(')[0] || 'string';
        const attrs: string[] = [];
        if (col.pk) attrs.push('PK');
        if (col.unique) attrs.push('UK');
        if (col.not_null) attrs.push('NN');
        
        mermaid += `    ${type} ${col.name} ${attrs.length ? '"' + attrs.join(',') + '"' : '""'}\n`;
      });
      
      mermaid += `  }\n`;
    });
  });
  
  // Add relationships
  if (data.targets.length > 0 && data.targets[0].tables?.length >= 2) {
    const t1 = `${data.targets[0].schema}_${data.targets[0].tables[0].name}`.replace(/[^a-zA-Z0-9_]/g, '_');
    const t2 = `${data.targets[0].schema}_${data.targets[0].tables[1].name}`.replace(/[^a-zA-Z0-9_]/g, '_');
    mermaid += `  ${t1} ||--o{ ${t2} : "relates"\n`;
  }
  
  return mermaid;
}
