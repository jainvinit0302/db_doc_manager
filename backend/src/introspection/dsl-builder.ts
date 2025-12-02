// backend/src/introspection/dsl-builder.ts
/**
 * DSL Builder - Utility to construct DSL objects from introspected schemas
 */

import YAML from 'js-yaml';

export interface TableSchema {
    name: string;
    columns: ColumnSchema[];
    description?: string;
}

export interface ColumnSchema {
    name: string;
    type: string;
    pk?: boolean;
    not_null?: boolean;
    unique?: boolean;
    default?: string;
    fk?: { table: string; column: string };
    description?: string;
}

export class DSLBuilder {
    private project: string;
    private db: string;
    private engine: string;
    private schema: string;
    private tables: TableSchema[] = [];

    constructor(project: string, db: string, engine: string, schema: string = 'public') {
        this.project = project;
        this.db = db;
        this.engine = engine;
        this.schema = schema;
    }

    addTable(table: TableSchema) {
        this.tables.push(table);
    }

    toDSL(): any {
        return {
            project: this.project,
            targets: [
                {
                    db: this.db,
                    engine: this.engine,
                    schema: this.schema,
                    tables: this.tables.map(t => ({
                        name: t.name,
                        description: t.description,
                        columns: t.columns.map(c => {
                            const col: any = {
                                name: c.name,
                                type: c.type
                            };

                            if (c.pk) col.pk = true;
                            if (c.not_null) col.not_null = true;
                            if (c.unique) col.unique = true;
                            if (c.default) col.default = c.default;
                            if (c.fk) {
                                col.fk = {
                                    table: c.fk.table,
                                    column: c.fk.column
                                };
                            }
                            if (c.description) col.description = c.description;

                            return col;
                        })
                    }))
                }
            ],
            sources: [],
            mappings: []
        };
    }

    toYAML(): string {
        const dsl = this.toDSL();
        return YAML.dump(dsl, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            sortKeys: false
        });
    }
}

/**
 * Type mapping utilities
 */

export function mapPostgreSQLType(pgType: string, charMaxLength?: number, numericPrecision?: number, numericScale?: number): string {
    const type = pgType.toLowerCase();

    // Integer types
    if (type === 'smallint' || type === 'int2') return 'SMALLINT';
    if (type === 'integer' || type === 'int' || type === 'int4') return 'INTEGER';
    if (type === 'bigint' || type === 'int8') return 'BIGINT';

    // String types
    if (type === 'character varying' || type === 'varchar') {
        return charMaxLength ? `VARCHAR(${charMaxLength})` : 'VARCHAR(255)';
    }
    if (type === 'character' || type === 'char') {
        return charMaxLength ? `CHAR(${charMaxLength})` : 'CHAR(1)';
    }
    if (type === 'text') return 'TEXT';

    // Numeric types
    if (type === 'numeric' || type === 'decimal') {
        if (numericPrecision && numericScale !== undefined) {
            return `DECIMAL(${numericPrecision},${numericScale})`;
        }
        return 'DECIMAL(10,2)';
    }
    if (type === 'real') return 'FLOAT';
    if (type === 'double precision') return 'DOUBLE';

    // Boolean
    if (type === 'boolean' || type === 'bool') return 'BOOLEAN';

    // Date/Time types
    if (type === 'timestamp' || type === 'timestamp without time zone') return 'TIMESTAMP';
    if (type === 'timestamp with time zone' || type === 'timestamptz') return 'TIMESTAMP';
    if (type === 'date') return 'DATE';
    if (type === 'time' || type === 'time without time zone') return 'TIME';

    // JSON types
    if (type === 'json' || type === 'jsonb') return 'JSON';

    // UUID
    if (type === 'uuid') return 'VARCHAR(36)';

    // Default
    return 'TEXT';
}

export function mapMongoDBType(bsonType: string): string {
    switch (bsonType) {
        case 'objectId':
            return 'VARCHAR(24)';
        case 'string':
            return 'VARCHAR(255)';
        case 'int':
        case 'int32':
            return 'INTEGER';
        case 'long':
        case 'int64':
            return 'BIGINT';
        case 'double':
        case 'decimal':
            return 'DECIMAL(10,2)';
        case 'bool':
        case 'boolean':
            return 'BOOLEAN';
        case 'date':
            return 'TIMESTAMP';
        case 'array':
        case 'object':
            return 'JSON';
        default:
            return 'TEXT';
    }
}
