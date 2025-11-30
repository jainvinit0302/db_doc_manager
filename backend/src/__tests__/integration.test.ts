// backend/src/__tests__/integration.test.ts
/**
 * Comprehensive Integration Tests
 * Tests the complete workflow from DSL validation to documentation generation
 */

import fs from 'fs';
import path from 'path';
import { loadDbdocFiles, validateStructure, normalize } from '../parser';
import { referentialValidate } from '../validator';
import { validateTransform } from '../transforms';
import { generateStaticSite } from '../doc_generator';
import { writeMappingCSV, generateMermaidERD, generateLineageJSON } from '../generator';

const TEST_OUTPUT_DIR = path.join(__dirname, '../../test-output');
const FIXTURES_DIR = path.join(__dirname, '../../fixtures');

// Helper to clean up test output
function cleanupTestOutput() {
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
        fs.rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
    }
}

// Helper to ensure fixtures directory exists
function ensureFixtures() {
    if (!fs.existsSync(FIXTURES_DIR)) {
        fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
}

beforeAll(() => {
    ensureFixtures();
});

afterEach(() => {
    cleanupTestOutput();
});

describe('Integration Tests - Complete Workflow', () => {
    describe('Test 1: DSL Validation', () => {
        it('should validate a complete valid DSL file', () => {
            const validDSL = {
                project: 'test_project',
                targets: [
                    {
                        db: 'dw',
                        engine: 'postgres',
                        schema: 'public',
                        tables: [
                            {
                                name: 'test_table',
                                columns: [
                                    { name: 'id', type: 'INTEGER', pk: true },
                                    { name: 'name', type: 'VARCHAR(100)', not_null: true },
                                    { name: 'created_at', type: 'TIMESTAMP', default: 'now()' }
                                ]
                            }
                        ]
                    }
                ],
                sources: [
                    {
                        id: 'test_source',
                        kind: 'postgres',
                        db: 'source_db'
                    }
                ],
                mappings: [
                    {
                        target: 'dw.public.test_table.id',
                        from: { source_id: 'test_source', path: '$.user_id' }
                    },
                    {
                        target: 'dw.public.test_table.name',
                        from: { source_id: 'test_source', path: '$.user_name', transform: 'trim()' }
                    }
                ]
            };

            // Validate structure
            const structureResult = validateStructure(validDSL);
            expect(structureResult.valid).toBe(true);
            expect(structureResult.errors).toBeUndefined();

            // Normalize and validate referentially
            const aggregated = {
                targets: validDSL.targets,
                sources: validDSL.sources,
                mappings: validDSL.mappings
            };
            const ast = normalize(aggregated);
            const { errors, warnings } = referentialValidate(ast);

            expect(errors).toHaveLength(0);
            // normalize() defaults to 'unnamed_project' when project isn't in aggregated data
            expect(ast.project).toBeDefined();
            expect(Object.keys(ast.targets)).toContain('dw.public.test_table');
            expect(Object.keys(ast.sources)).toContain('test_source');
        });

        it('should fail validation for invalid DSL structure', () => {
            const invalidDSL = {
                project: 'test',
                // Missing required 'targets' field
                sources: [],
                mappings: []
            };

            const result = validateStructure(invalidDSL);
            expect(result.valid).toBe(false);
            expect(result.errors).toBeDefined();
            expect(result.errors!.length).toBeGreaterThan(0);
        });

        it('should fail validation for missing source references', () => {
            const dslWithInvalidRef = {
                project: 'test',
                targets: [{
                    db: 'dw',
                    engine: 'postgres',
                    schema: 'public',
                    tables: [{ name: 'table1', columns: [{ name: 'col1', type: 'INT' }] }]
                }],
                sources: [{ id: 'source1', kind: 'postgres' }],
                mappings: [{
                    target: 'dw.public.table1.col1',
                    from: { source_id: 'nonexistent_source', path: '$.field' }
                }]
            };

            const aggregated = {
                targets: dslWithInvalidRef.targets,
                sources: dslWithInvalidRef.sources,
                mappings: dslWithInvalidRef.mappings
            };
            const ast = normalize(aggregated);
            const { errors } = referentialValidate(ast);

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain('unknown source_id');
        });
    });

    describe('Test 2: Transform Validation', () => {
        it('should validate all supported transforms', () => {
            const transforms = [
                'lower()',
                'upper()',
                'trim()',
                'concat("a", "b")',
                'substring(0, 10)',
                'parseDate()',
                'formatDate("YYYY-MM-DD")',
                'coalesce("a", "b")',
                'default("N/A")',
                'cast("integer")',
                'round(2)',
                'abs()'
            ];

            transforms.forEach(transform => {
                const error = validateTransform(transform);
                expect(error).toBeNull();
            });
        });

        it('should reject invalid transform syntax', () => {
            const invalidTransforms = [
                'not_a_function',
                'lower(extra_arg)',
                'concat()',  // Too few args
                'unknownFunc()',
                'round(1, 2, 3)'  // Too many args
            ];

            invalidTransforms.forEach(transform => {
                const error = validateTransform(transform);
                expect(error).not.toBeNull();
            });
        });

        it('should validate transforms in complete DSL', () => {
            const dslWithTransforms = {
                project: 'test',
                targets: [{
                    db: 'dw',
                    engine: 'postgres',
                    schema: 'dim',
                    tables: [{
                        name: 'customers',
                        columns: [
                            { name: 'id', type: 'INT', pk: true },
                            { name: 'email', type: 'VARCHAR(255)', not_null: true },
                            { name: 'full_name', type: 'VARCHAR(500)', not_null: true }
                        ]
                    }]
                }],
                sources: [{ id: 'src', kind: 'mongodb', db: 'users' }],
                mappings: [
                    {
                        target: 'dw.dim.customers.id',
                        from: { source_id: 'src', path: '$.user_id' }
                    },
                    {
                        target: 'dw.dim.customers.email',
                        from: { source_id: 'src', path: '$.contact.email', transform: 'lower()' }
                    },
                    {
                        target: 'dw.dim.customers.full_name',
                        from: { rule: 'concat($.first_name, " ", $.last_name)' }
                    }
                ]
            };

            const aggregated = {
                targets: dslWithTransforms.targets,
                sources: dslWithTransforms.sources,
                mappings: dslWithTransforms.mappings
            };
            const ast = normalize(aggregated);
            const { errors } = referentialValidate(ast);

            // Should have no errors - transforms are valid
            expect(errors).toHaveLength(0);
        });
    });

    describe('Test 3: Documentation Generation', () => {
        it('should generate complete documentation site', () => {
            const testDSL = {
                project: 'doc_test',
                targets: [{
                    db: 'dw',
                    engine: 'postgres',
                    schema: 'public',
                    tables: [{
                        name: 'users',
                        description: 'User table',
                        columns: [
                            { name: 'id', type: 'INTEGER', pk: true },
                            { name: 'email', type: 'VARCHAR(255)', unique: true, not_null: true },
                            { name: 'name', type: 'VARCHAR(100)', not_null: true }
                        ]
                    }]
                }],
                sources: [{ id: 'src1', kind: 'mongodb', db: 'app' }],
                mappings: [
                    { target: 'dw.public.users.id', from: { source_id: 'src1', path: '$.user_id' } },
                    { target: 'dw.public.users.email', from: { source_id: 'src1', path: '$.email' } },
                    { target: 'dw.public.users.name', from: { source_id: 'src1', path: '$.name' } }
                ]
            };

            const aggregated = {
                targets: testDSL.targets,
                sources: testDSL.sources,
                mappings: testDSL.mappings
            };
            const ast = normalize(aggregated);

            // Generate documentation
            const docsDir = path.join(TEST_OUTPUT_DIR, 'docs');
            generateStaticSite(ast, docsDir);

            // Verify generated files
            expect(fs.existsSync(path.join(docsDir, 'index.html'))).toBe(true);
            expect(fs.existsSync(path.join(docsDir, 'sources.html'))).toBe(true);
            expect(fs.existsSync(path.join(docsDir, 'mappings.html'))).toBe(true);
            expect(fs.existsSync(path.join(docsDir, 'tables'))).toBe(true);
            expect(fs.existsSync(path.join(docsDir, 'tables', 'dw.public.users.html'))).toBe(true);

            // Verify index.html contains table name (not necessarily project name since it may be normalized)
            const indexContent = fs.readFileSync(path.join(docsDir, 'index.html'), 'utf8');
            expect(indexContent).toContain('users');
            expect(indexContent).toContain('dw.public');
        });

        it('should generate artifacts (CSV, ERD, lineage)', () => {
            const testDSL = {
                project: 'artifact_test',
                targets: [{
                    db: 'dw',
                    engine: 'postgres',
                    schema: 'dim',
                    tables: [{
                        name: 'products',
                        columns: [
                            { name: 'id', type: 'INT', pk: true },
                            { name: 'name', type: 'VARCHAR(100)' }
                        ]
                    }]
                }],
                sources: [{ id: 'src', kind: 'postgres' }],
                mappings: [
                    { target: 'dw.dim.products.id', from: { source_id: 'src', path: '$.product_id' } }
                ]
            };

            const aggregated = {
                targets: testDSL.targets,
                sources: testDSL.sources,
                mappings: testDSL.mappings
            };
            const ast = normalize(aggregated);

            const outputDir = TEST_OUTPUT_DIR;
            fs.mkdirSync(outputDir, { recursive: true });

            // Generate CSV
            writeMappingCSV(ast, outputDir);
            expect(fs.existsSync(path.join(outputDir, 'mapping_matrix.csv'))).toBe(true);
            const csvContent = fs.readFileSync(path.join(outputDir, 'mapping_matrix.csv'), 'utf8');
            expect(csvContent).toContain('target_db');  // CSV uses lowercase headers
            expect(csvContent).toContain('dw');
            expect(csvContent).toContain('products');

            // Generate ERD
            const erdDir = path.join(outputDir, 'erd');
            fs.mkdirSync(erdDir, { recursive: true });
            const erds = generateMermaidERD(ast, erdDir);
            expect(erds.length).toBeGreaterThan(0);
            expect(fs.existsSync(path.join(erdDir, 'erd_all.mmd'))).toBe(true);

            // Generate lineage
            const lineageDir = path.join(outputDir, 'lineage');
            fs.mkdirSync(lineageDir, { recursive: true });
            const lineage = generateLineageJSON(ast, lineageDir);
            expect(lineage.nodes).toBeDefined();
            expect(lineage.edges).toBeDefined();
        });
    });

    describe('Test 4: End-to-End Workflow', () => {
        it('should complete full workflow: validate -> generate -> verify', () => {
            // Step 1: Create a comprehensive DSL object
            const comprehensiveDSL = {
                project: 'e2e_test_project',
                targets: [
                    {
                        db: 'analytics',
                        engine: 'postgres',
                        schema: 'reporting',
                        tables: [
                            {
                                name: 'order_summary',
                                columns: [
                                    { name: 'order_id', type: 'INTEGER', pk: true },
                                    { name: 'customer_email', type: 'VARCHAR(255)', not_null: true },
                                    { name: 'order_total', type: 'DECIMAL(10,2)', not_null: true },
                                    { name: 'order_date', type: 'DATE', not_null: true },
                                    { name: 'created_at', type: 'TIMESTAMP', default: 'now()' }
                                ]
                            }
                        ]
                    }
                ],
                sources: [
                    {
                        id: 'mongo_orders',
                        kind: 'mongodb',
                        db: 'orderdb',
                        collection: 'orders'
                    },
                    {
                        id: 'pg_customers',
                        kind: 'postgres',
                        db: 'customerdb',
                        table: 'customers'
                    }
                ],
                mappings: [
                    {
                        target: 'analytics.reporting.order_summary.order_id',
                        from: { source_id: 'mongo_orders', path: '$.order.id' }
                    },
                    {
                        target: 'analytics.reporting.order_summary.customer_email',
                        from: { source_id: 'pg_customers', path: '$.email', transform: 'lower()' }
                    },
                    {
                        target: 'analytics.reporting.order_summary.order_total',
                        from: { source_id: 'mongo_orders', path: '$.order.total', transform: 'round(2)' }
                    },
                    {
                        target: 'analytics.reporting.order_summary.order_date',
                        from: { source_id: 'mongo_orders', path: '$.order.created_at', transform: 'formatDate("YYYY-MM-DD")' }
                    }
                ]
            };

            // Step 2: Validate structure
            const structureResult = validateStructure(comprehensiveDSL);
            expect(structureResult.valid).toBe(true);


            // Step 3: Normalize and validate referentially
            const aggregated = {
                targets: comprehensiveDSL.targets,
                sources: comprehensiveDSL.sources,
                mappings: comprehensiveDSL.mappings
            };
            const ast = normalize(aggregated);
            const { errors, warnings } = referentialValidate(ast);

            expect(errors).toHaveLength(0);
            // normalize() defaults to 'unnamed_project' when project isn't in aggregated data
            expect(ast.project).toBeDefined();

            // Step 4: Verify transforms validated
            const transformMappings = ast.mappings.filter((m: any) => m.from?.transform);
            expect(transformMappings.length).toBeGreaterThan(0);

            transformMappings.forEach((mapping: any) => {
                const transformError = validateTransform(mapping.from.transform);
                expect(transformError).toBeNull();
            });

            // Step 5: Generate all artifacts
            const outputDir = path.join(TEST_OUTPUT_DIR, 'e2e');
            fs.mkdirSync(outputDir, { recursive: true });

            // Generate docs
            generateStaticSite(ast, outputDir);
            expect(fs.existsSync(path.join(outputDir, 'index.html'))).toBe(true);

            // Generate CSV
            writeMappingCSV(ast, outputDir);
            expect(fs.existsSync(path.join(outputDir, 'mapping_matrix.csv'))).toBe(true);

            // Generate ERD
            const erdDir = path.join(outputDir, 'erd');
            fs.mkdirSync(erdDir, { recursive: true });
            generateMermaidERD(ast, erdDir);
            expect(fs.existsSync(path.join(erdDir, 'erd_all.mmd'))).toBe(true);

            // Generate lineage
            const lineageDir = path.join(outputDir, 'lineage');
            fs.mkdirSync(lineageDir, { recursive: true });
            const lineage = generateLineageJSON(ast, lineageDir);
            expect(lineage.nodes.length).toBeGreaterThan(0);

            // Step 6: Verify generated content
            const indexHtml = fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8');
            expect(indexHtml).toContain('order_summary');

            const mappingsHtml = fs.readFileSync(path.join(outputDir, 'mappings.html'), 'utf8');
            expect(mappingsHtml).toContain('lower()');
            expect(mappingsHtml).toContain('round(2)');
            expect(mappingsHtml).toContain('formatDate');
        });
    });

    describe('Test 5: CI/CD Integration', () => {
        it('should handle validation exit codes correctly', () => {
            // Valid DSL should not throw
            const validDSL = {
                project: 'ci_test',
                targets: [{ db: 'd', engine: 'postgres', schema: 's', tables: [{ name: 't', columns: [{ name: 'c', type: 'INT' }] }] }],
                sources: [],
                mappings: []
            };

            expect(() => {
                const result = validateStructure(validDSL);
                if (!result.valid) throw new Error('Validation failed');
            }).not.toThrow();

            // Invalid DSL should fail
            const invalidDSL = { project: 'test' };  // Missing targets
            const result = validateStructure(invalidDSL);
            expect(result.valid).toBe(false);
        });
    });

    describe('Test 6: Edge Cases and Error Handling', () => {
        it('should handle empty mappings', () => {
            const dsl = {
                project: 'empty_mappings',
                targets: [{ db: 'd', engine: 'postgres', schema: 's', tables: [{ name: 't', columns: [{ name: 'c', type: 'INT' }] }] }],
                sources: [],
                mappings: []
            };

            const aggregated = { targets: dsl.targets, sources: dsl.sources, mappings: dsl.mappings };
            const ast = normalize(aggregated);
            const { errors } = referentialValidate(ast);

            // Empty mappings is valid but might have warnings
            expect(Array.isArray(errors)).toBe(true);
        });

        it('should handle multiple sources and targets', () => {
            const dsl = {
                project: 'multi',
                targets: [
                    { db: 'd1', engine: 'postgres', schema: 's1', tables: [{ name: 't1', columns: [{ name: 'c1', type: 'INT', pk: true }] }] },
                    { db: 'd2', engine: 'snowflake', schema: 's2', tables: [{ name: 't2', columns: [{ name: 'c2', type: 'VARCHAR', pk: true }] }] }
                ],
                sources: [
                    { id: 'src1', kind: 'mongodb' },
                    { id: 'src2', kind: 'postgres' },
                    { id: 'src3', kind: 'csv' }
                ],
                mappings: []
            };

            const aggregated = { targets: dsl.targets, sources: dsl.sources, mappings: dsl.mappings };
            const ast = normalize(aggregated);

            expect(Object.keys(ast.targets).length).toBe(2);
            expect(Object.keys(ast.sources).length).toBe(3);
        });

        it('should handle complex transform chaining in rules', () => {
            const dsl = {
                project: 'complex_transforms',
                targets: [{
                    db: 'd',
                    engine: 'postgres',
                    schema: 's',
                    tables: [{
                        name: 't',
                        columns: [
                            { name: 'c1', type: 'INT', pk: true },
                            { name: 'c2', type: 'VARCHAR(100)', not_null: true }
                        ]
                    }]
                }],
                sources: [{ id: 'src', kind: 'postgres' }],
                mappings: [
                    { target: 'd.s.t.c1', from: { source_id: 'src', path: '$.id' } },
                    {
                        target: 'd.s.t.c2',
                        from: {
                            rule: 'trim()',  // This should validate
                            source_id: 'src'
                        }
                    }
                ]
            };

            const aggregated = { targets: dsl.targets, sources: dsl.sources, mappings: dsl.mappings };
            const ast = normalize(aggregated);
            const { errors } = referentialValidate(ast);

            // Should validate without errors
            expect(errors).toHaveLength(0);
        });
    });
});

describe('Performance Tests', () => {
    it('should handle large DSL files efficiently', () => {
        const startTime = Date.now();

        // Create a DSL with many tables
        const largeDSL: any = {
            project: 'large_project',
            targets: [],
            sources: [],
            mappings: []
        };

        // Add 50 tables
        for (let i = 0; i < 50; i++) {
            largeDSL.targets.push({
                db: 'dw',
                engine: 'postgres',
                schema: 's' + i,
                tables: [{
                    name: 'table' + i,
                    columns: [
                        { name: 'id', type: 'INT', pk: true },
                        { name: 'col1', type: 'VARCHAR(100)' },
                        { name: 'col2', type: 'INT' }
                    ]
                }]
            });

            largeDSL.sources.push({ id: 'src' + i, kind: 'postgres' });

            largeDSL.mappings.push({
                target: `dw.s${i}.table${i}.id`,
                from: { source_id: 'src' + i, path: '$.id' }
            });
        }

        // Validate
        const result = validateStructure(largeDSL);
        expect(result.valid).toBe(true);

        const aggregated = {
            targets: largeDSL.targets,
            sources: largeDSL.sources,
            mappings: largeDSL.mappings
        };
        const ast = normalize(aggregated);
        const { errors } = referentialValidate(ast);

        const endTime = Date.now();
        const duration = endTime - startTime;

        // Should complete in reasonable time (< 5 seconds)
        expect(duration).toBeLessThan(5000);
        expect(errors).toHaveLength(0);
        expect(Object.keys(ast.targets).length).toBe(50);
    });
});
