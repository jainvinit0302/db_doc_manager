// backend/src/generators/sqlGenerator.ts
// Simple, working SQL generator for all databases

export function generatePostgresSQL(data: any): string {
  if (!data.targets) return '-- No targets defined';
  
  let sql = `-- PostgreSQL DDL\n-- Project: ${data.project}\n\n`;
  
  data.targets.forEach((target: any) => {
    if (!target.tables) return;
    
    sql += `CREATE SCHEMA IF NOT EXISTS ${target.schema || 'public'};\n\n`;
    
    target.tables.forEach((table: any) => {
      sql += `CREATE TABLE ${target.schema || 'public'}.${table.name} (\n`;
      
      const cols = table.columns?.map((col: any) => {
        let def = `  ${col.name} ${col.type || 'TEXT'}`;
        if (col.not_null) def += ' NOT NULL';
        if (col.default) def += ` DEFAULT ${col.default}`;
        return def;
      }) || [];
      
      sql += cols.join(',\n');
      
      const pks = table.columns?.filter((c: any) => c.pk).map((c: any) => c.name) || [];
      if (pks.length > 0) {
        sql += `,\n  PRIMARY KEY (${pks.join(', ')})`;
      }
      
      sql += '\n);\n\n';
    });
  });
  
  return sql;
}

export function generateMySQLSQL(data: any): string {
  if (!data.targets) return '-- No targets defined';
  
  let sql = `-- MySQL DDL\n-- Project: ${data.project}\n\n`;
  
  data.targets.forEach((target: any) => {
    if (!target.tables) return;
    
    sql += `CREATE DATABASE IF NOT EXISTS ${target.db};\nUSE ${target.db};\n\n`;
    
    target.tables.forEach((table: any) => {
      sql += `CREATE TABLE ${table.name} (\n`;
      
      const cols = table.columns?.map((col: any) => {
        let type = col.type || 'VARCHAR(255)';
        if (type.toUpperCase() === 'SERIAL') type = 'INT AUTO_INCREMENT';
        
        let def = `  ${col.name} ${type}`;
        if (col.not_null) def += ' NOT NULL';
        if (col.default && !col.type?.includes('SERIAL')) def += ` DEFAULT ${col.default}`;
        return def;
      }) || [];
      
      sql += cols.join(',\n');
      
      const pks = table.columns?.filter((c: any) => c.pk).map((c: any) => c.name) || [];
      if (pks.length > 0) {
        sql += `,\n  PRIMARY KEY (${pks.join(', ')})`;
      }
      
      sql += '\n) ENGINE=InnoDB;\n\n';
    });
  });
  
  return sql;
}

export function generateMongoSchema(data: any): string {
  if (!data.sources) return '// No MongoDB sources defined';
  
  const mongoSources = data.sources.filter((s: any) => s.kind === 'mongodb');
  if (mongoSources.length === 0) return '// No MongoDB sources defined';
  
  let output = `// MongoDB Schema\n// Project: ${data.project}\n\n`;
  
  mongoSources.forEach((source: any) => {
    output += `// Collection: ${source.db}.${source.collection || 'collection'}\n`;
    output += `db.createCollection("${source.collection || 'collection'}", {\n`;
    output += `  validator: {\n`;
    output += `    $jsonSchema: {\n`;
    output += `      bsonType: "object",\n`;
    output += `      properties: {\n`;
    
    // Build properties from mappings
    const mappings = data.mappings?.filter((m: any) => m.from?.source_id === source.id) || [];
    const props: string[] = [];
    
    mappings.forEach((m: any) => {
      if (m.from?.path) {
        const field = m.from.path.replace('$.', '').split('.')[0];
        if (field && !props.includes(field)) {
          props.push(`        ${field}: { bsonType: "object" }`);
        }
      }
    });
    
    output += props.join(',\n') || '        _id: { bsonType: "objectId" }';
    output += '\n      }\n';
    output += `    }\n`;
    output += `  }\n`;
    output += `});\n\n`;
  });
  
  return output;
}