// backend/src/schemaExtractors/postgres.ts
import { Client } from "pg";

export async function extractPostgresSchema(connString: string) {
  const client = new Client({ connectionString: connString });
  await client.connect();

  const res = await client.query(`
    SELECT table_schema, table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name, ordinal_position;
  `);

  await client.end();

  const structure: any = {};
  for (const row of res.rows) {
    const { table_schema, table_name, column_name, data_type, is_nullable } = row;
    const key = `${table_schema}.${table_name}`;
    if (!structure[key]) structure[key] = { schema: table_schema, name: table_name, columns: [] };
    structure[key].columns.push({
      name: column_name,
      type: data_type,
      not_null: is_nullable === "NO",
    });
  }

  return structure;
}
