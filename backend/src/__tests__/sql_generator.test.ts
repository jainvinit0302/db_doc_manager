// backend/src/__tests__/sql_generator.test.ts
import { generateDialects } from '../sql_generator';
import type { NormalizedAST } from '../parser';

describe('SQL Generator Module', () => {
    const sampleAST: NormalizedAST = {
        project: 'test',
        sources: {},
        targets: {
            'warehouse.public.users': {
                db: 'warehouse',
                schema: 'public',
                table: 'users',
                columns: {
                    user_id: { name: 'user_id', type: 'INTEGER', pk: true },
                    email: { name: 'email', type: 'VARCHAR(255)', not_null: true, unique: true },
                    created_at: { name: 'created_at', type: 'TIMESTAMP', default: 'CURRENT_TIMESTAMP' },
                },
            },
        },
        mappings: [],
    };

    describe('PostgreSQL Generation', () => {
        it('should generate valid PostgreSQL DDL', () => {
            const result = generateDialects(sampleAST);

            expect(result.postgres).toContain('CREATE TABLE');
            expect(result.postgres).toContain('warehouse.public.users');
            expect(result.postgres).toContain('user_id INTEGER PRIMARY KEY');
            expect(result.postgres).toContain('email VARCHAR(255)');
            expect(result.postgres).toContain('NOT NULL');
            expect(result.postgres).toContain('UNIQUE');
        });

        it('should include default values', () => {
            const result = generateDialects(sampleAST);

            expect(result.postgres).toContain('DEFAULT CURRENT_TIMESTAMP');
        });
    });

    describe('Snowflake Generation', () => {
        it('should generate valid Snowflake DDL', () => {
            const result = generateDialects(sampleAST);

            expect(result.snowflake).toContain('CREATE OR REPLACE TABLE');
            expect(result.snowflake).toContain('warehouse.public.users');
        });

        it('should map VARCHAR to STRING', () => {
            const result = generateDialects(sampleAST);

            expect(result.snowflake).toContain('STRING');
            expect(result.snowflake).not.toContain('VARCHAR');
        });

        it('should use PRIMARY KEY constraint', () => {
            const result = generateDialects(sampleAST);

            expect(result.snowflake).toContain('PRIMARY KEY (user_id)');
        });
    });

    describe('MongoDB Generation', () => {
        it('should generate MongoDB collection creation script', () => {
            const result = generateDialects(sampleAST);

            expect(result.mongodb).toContain('db.createCollection');
            expect(result.mongodb).toContain('"users"');
            expect(result.mongodb).toContain('$jsonSchema');
        });

        it('should mark PK and NOT NULL fields as required', () => {
            const result = generateDialects(sampleAST);

            expect(result.mongodb).toContain('required');
            expect(result.mongodb).toContain('"user_id"');
            expect(result.mongodb).toContain('"email"');
        });

        it('should map BIGINT to long', () => {
            const astWithBigInt: NormalizedAST = {
                project: 'test',
                sources: {},
                targets: {
                    'db.schema.table': {
                        db: 'db',
                        schema: 'schema',
                        table: 'table',
                        columns: {
                            big_number: { name: 'big_number', type: 'BIGINT' },
                        },
                    },
                },
                mappings: [],
            };

            const result = generateDialects(astWithBigInt);
            expect(result.mongodb).toContain('"long"');
        });

        it('should handle nullable fields correctly', () => {
            const astWithNullable: NormalizedAST = {
                project: 'test',
                sources: {},
                targets: {
                    'db.schema.table': {
                        db: 'db',
                        schema: 'schema',
                        table: 'table',
                        columns: {
                            optional_field: { name: 'optional_field', type: 'INTEGER' },
                        },
                    },
                },
                mappings: [],
            };

            const result = generateDialects(astWithNullable);
            expect(result.mongodb).toContain('"null"');
        });
    });

    describe('Multiple Tables', () => {
        it('should generate SQL for multiple tables', () => {
            const multiTableAST: NormalizedAST = {
                project: 'test',
                sources: {},
                targets: {
                    'dw.public.users': {
                        db: 'dw',
                        schema: 'public',
                        table: 'users',
                        columns: {
                            id: { name: 'id', type: 'INT', pk: true },
                        },
                    },
                    'dw.public.orders': {
                        db: 'dw',
                        schema: 'public',
                        table: 'orders',
                        columns: {
                            order_id: { name: 'order_id', type: 'INT', pk: true },
                        },
                    },
                },
                mappings: [],
            };

            const result = generateDialects(multiTableAST);

            expect(result.postgres).toContain('users');
            expect(result.postgres).toContain('orders');
        });
    });
});
