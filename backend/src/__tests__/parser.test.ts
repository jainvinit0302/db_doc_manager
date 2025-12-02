// backend/src/__tests__/parser.test.ts
import { validateStructure, normalize } from '../parser';

describe('Parser Module', () => {
    describe('validateStructure', () => {
        it('should validate a minimal valid DSL', () => {
            const validDSL = {
                project: 'test_project',
                targets: [],
                sources: [],
                mappings: [],
            };

            const result = validateStructure(validDSL);
            expect(result.valid).toBe(true);
            expect(result.errors).toBeUndefined();
        });

        it('should validate DSL with targets', () => {
            const dslWithTargets = {
                project: 'test',
                targets: [
                    {
                        db: 'warehouse',
                        engine: 'postgres',
                        schema: 'public',
                        tables: [
                            {
                                name: 'users',
                                columns: [
                                    { name: 'id', type: 'INTEGER', pk: true },
                                    { name: 'email', type: 'VARCHAR(255)', not_null: true },
                                ],
                            },
                        ],
                    },
                ],
                sources: [],
                mappings: [],
            };

            const result = validateStructure(dslWithTargets);
            expect(result.valid).toBe(true);
        });

        it('should fail validation when project name is missing', () => {
            const invalidDSL = {
                targets: [],
                sources: [],
                mappings: [],
            };

            const result = validateStructure(invalidDSL);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
        });

        it('should validate sources with MongoDB', () => {
            const dslWithSources = {
                project: 'test',
                targets: [],
                sources: [
                    {
                        id: 'mongo_users',
                        kind: 'mongodb',
                        db: 'shop',
                        collection: 'users',
                    },
                ],
                mappings: [],
            };

            const result = validateStructure(dslWithSources);
            expect(result.valid).toBe(true);
        });
    });

    describe('normalize', () => {
        it('should create a normalized AST with empty arrays', () => {
            const dsl = {
                project: 'test',
                targets: [],
                sources: [],
                mappings: [],
            };

            const ast = normalize(dsl);
            expect(ast.project).toBe('test');
            expect(ast.targets).toEqual({});
            expect(ast.sources).toEqual({});
            expect(ast.mappings).toEqual([]);
        });

        it('should normalize targets into keyed object', () => {
            const dsl = {
                project: 'test',
                targets: [
                    {
                        db: 'dw',
                        schema: 'public',
                        tables: [
                            {
                                name: 'users',
                                columns: [{ name: 'id', type: 'INT' }],
                            },
                        ],
                    },
                ],
                sources: [],
                mappings: [],
            };

            const ast = normalize(dsl);
            expect(ast.targets['dw.public.users']).toBeDefined();
            expect(ast.targets['dw.public.users'].table).toBe('users');
            expect(ast.targets['dw.public.users'].columns['id']).toBeDefined();
        });

        it('should normalize sources by ID', () => {
            const dsl = {
                project: 'test',
                targets: [],
                sources: [
                    { id: 'src1', kind: 'mongodb', db: 'shop', collection: 'orders' },
                    { id: 'src2', kind: 'postgres', db: 'legacy' },
                ],
                mappings: [],
            };

            const ast = normalize(dsl);
            expect(ast.sources['src1']).toBeDefined();
            expect(ast.sources['src1'].kind).toBe('mongodb');
            expect(ast.sources['src2']).toBeDefined();
            expect(ast.sources['src2'].kind).toBe('postgres');
        });

        it('should normalize mappings with parsed target components', () => {
            const dsl = {
                project: 'test',
                targets: [],
                sources: [],
                mappings: [
                    {
                        target: 'dw.mart.dim_user.email',
                        from: {
                            source_id: 'mongo_users',
                            path: '$.contact.email',
                        },
                    },
                ],
            };

            const ast = normalize(dsl);
            expect(ast.mappings).toHaveLength(1);
            expect(ast.mappings[0].target.db).toBe('dw');
            expect(ast.mappings[0].target.schema).toBe('mart');
            expect(ast.mappings[0].target.table).toBe('dim_user');
            expect(ast.mappings[0].target.column).toBe('email');
        });

        it('should handle wildcard mappings', () => {
            const dsl = {
                project: 'test',
                targets: [],
                sources: [],
                mappings: [
                    {
                        target: 'dw.mart.dim_user',
                        from: { source_id: 'src1' },
                    },
                ],
            };

            const ast = normalize(dsl);
            expect(ast.mappings[0].target.column).toBe('*');
        });
    });
});
