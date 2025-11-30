// backend/src/introspection/postgres.ts
/**
 * PostgreSQL Database Introspection
 * Reads schema from PostgreSQL database and generates DSL
 */

import { Client } from 'pg';
import { DSLBuilder, TableSchema, ColumnSchema, mapPostgreSQLType } from './dsl-builder';

export interface PostgreSQLIntrospectionOptions {
    connectionString: string;
    schema?: string;
    excludeTables?: string[];
}

export async function introspectPostgreSQL(options: PostgreSQLIntrospectionOptions): Promise<string> {
    const client = new Client({ connectionString: options.connectionString });
    const schema = options.schema || 'public';
    const excludeTables = options.excludeTables || [];

    try {
        await client.connect();

        // Extract database name from connection string
        const dbName = extractDatabaseName(options.connectionString);
        const builder = new DSLBuilder(dbName, dbName, 'postgres', schema);

        // Get all tables in the schema
        const tables = await getTables(client, schema, excludeTables);

        for (const tableName of tables) {
            const columns = await getColumns(client, schema, tableName);
            const primaryKeys = await getPrimaryKeys(client, schema, tableName);
            const foreignKeys = await getForeignKeys(client, schema, tableName);
            const uniqueConstraints = await getUniqueConstraints(client, schema, tableName);

            const tableSchema: TableSchema = {
                name: tableName,
                columns: columns.map(col => {
                    const columnSchema: ColumnSchema = {
                        name: col.column_name,
                        type: mapPostgreSQLType(
                            col.data_type,
                            col.character_maximum_length,
                            col.numeric_precision,
                            col.numeric_scale
                        ),
                        not_null: col.is_nullable === 'NO',
                        default: col.column_default || undefined
                    };

                    // Add primary key
                    if (primaryKeys.includes(col.column_name)) {
                        columnSchema.pk = true;
                    }

                    // Add unique constraint
                    if (uniqueConstraints.includes(col.column_name)) {
                        columnSchema.unique = true;
                    }

                    // Add foreign key
                    const fk = foreignKeys.find(f => f.column_name === col.column_name);
                    if (fk) {
                        columnSchema.fk = {
                            table: fk.foreign_table,
                            column: fk.foreign_column
                        };
                    }

                    return columnSchema;
                })
            };

            builder.addTable(tableSchema);
        }

        return builder.toYAML();

    } finally {
        await client.end();
    }
}

function extractDatabaseName(connectionString: string): string {
    try {
        const url = new URL(connectionString);
        return url.pathname.substring(1) || 'database';
    } catch {
        return 'database';
    }
}

async function getTables(client: Client, schema: string, exclude: string[]): Promise<string[]> {
    const excludeClause = exclude.length > 0
        ? `AND table_name NOT IN (${exclude.map(t => `'${t}'`).join(',')})`
        : '';

    const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_type = 'BASE TABLE'
      ${excludeClause}
    ORDER BY table_name
  `, [schema]);

    return result.rows.map(r => r.table_name);
}

async function getColumns(client: Client, schema: string, table: string): Promise<any[]> {
    const result = await client.query(`
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      character_maximum_length,
      numeric_precision,
      numeric_scale
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position
  `, [schema, table]);

    return result.rows;
}

async function getPrimaryKeys(client: Client, schema: string, table: string): Promise<string[]> {
    const result = await client.query(`
    SELECT kcu.column_name
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc
      ON kcu.constraint_name = tc.constraint_name
      AND kcu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND kcu.table_schema = $1
      AND kcu.table_name = $2
  `, [schema, table]);

    return result.rows.map(r => r.column_name);
}

async function getForeignKeys(client: Client, schema: string, table: string): Promise<any[]> {
    const result = await client.query(`
    SELECT
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.constraint_column_usage ccu
      ON kcu.constraint_name = ccu.constraint_name
      AND kcu.table_schema = ccu.table_schema
    WHERE kcu.constraint_name IN (
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY'
        AND table_schema = $1
        AND table_name = $2
    )
    AND kcu.table_schema = $1
    AND kcu.table_name = $2
  `, [schema, table]);

    return result.rows;
}

async function getUniqueConstraints(client: Client, schema: string, table: string): Promise<string[]> {
    const result = await client.query(`
    SELECT kcu.column_name
    FROM information_schema.key_column_usage kcu
    JOIN information_schema.table_constraints tc
      ON kcu.constraint_name = tc.constraint_name
      AND kcu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'UNIQUE'
      AND kcu.table_schema = $1
      AND kcu.table_name = $2
  `, [schema, table]);

    return result.rows.map(r => r.column_name);
}
