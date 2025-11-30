// backend/src/__tests__/validator.test.ts
import { referentialValidate } from '../validator';
import type { NormalizedAST } from '../parser';

describe('Validator Module', () => {
    describe('referentialValidate', () => {
        it('should pass validation for valid AST with no mappings', () => {
            const ast: NormalizedAST = {
                project: 'test',
                sources: {},
                targets: {},
                mappings: [],
            };

            const result = referentialValidate(ast);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });

        it('should error when mapping references unknown source_id', () => {
            const ast: NormalizedAST = {
                project: 'test',
                sources: {
                    src1: { id: 'src1', kind: 'mongodb' },
                },
                targets: {
                    'dw.public.users': {
                        db: 'dw',
                        schema: 'public',
                        table: 'users',
                        columns: { email: { name: 'email', type: 'VARCHAR(255)' } },
                    },
                },
                mappings: [
                    {
                        rawTarget: 'dw.public.users.email',
                        target: { db: 'dw', schema: 'public', table: 'users', column: 'email' },
                        from: { source_id: 'unknown_source', path: '$.email' },
                        notes: null,
                        tags: [],
                    },
                ],
            };

            const result = referentialValidate(ast);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('unknown source_id');
        });

        it('should error when mapping references unknown target table', () => {
            const ast: NormalizedAST = {
                project: 'test',
                sources: {
                    src1: { id: 'src1', kind: 'mongodb' },
                },
                targets: {},
                mappings: [
                    {
                        rawTarget: 'dw.public.nonexistent.email',
                        target: { db: 'dw', schema: 'public', table: 'nonexistent', column: 'email' },
                        from: { source_id: 'src1', path: '$.email' },
                        notes: null,
                        tags: [],
                    },
                ],
            };

            const result = referentialValidate(ast);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('does not resolve');
        });

        it('should error when mapping targets nonexistent column', () => {
            const ast: NormalizedAST = {
                project: 'test',
                sources: {
                    src1: { id: 'src1', kind: 'mongodb' },
                },
                targets: {
                    'dw.public.users': {
                        db: 'dw',
                        schema: 'public',
                        table: 'users',
                        columns: { id: { name: 'id', type: 'INT' } },
                    },
                },
                mappings: [
                    {
                        rawTarget: 'dw.public.users.nonexistent_column',
                        target: { db: 'dw', schema: 'public', table: 'users', column: 'nonexistent_column' },
                        from: { source_id: 'src1', path: '$.data' },
                        notes: null,
                        tags: [],
                    },
                ],
            };

            const result = referentialValidate(ast);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('does not exist');
        });

        it('should error when NOT NULL column has no mapping or default', () => {
            const ast: NormalizedAST = {
                project: 'test',
                sources: {},
                targets: {
                    'dw.public.users': {
                        db: 'dw',
                        schema: 'public',
                        table: 'users',
                        columns: {
                            id: { name: 'id', type: 'INT', pk: true },
                            email: { name: 'email', type: 'VARCHAR(255)', not_null: true },
                        },
                    },
                },
                mappings: [],
            };

            const result = referentialValidate(ast);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('NOT NULL');
            expect(result.errors[0]).toContain('email');
        });

        it('should NOT error when NOT NULL column has a default', () => {
            const ast: NormalizedAST = {
                project: 'test',
                sources: {},
                targets: {
                    'dw.public.users': {
                        db: 'dw',
                        schema: 'public',
                        table: 'users',
                        columns: {
                            id: { name: 'id', type: 'INT', pk: true },
                            created_at: { name: 'created_at', type: 'TIMESTAMP', not_null: true, default: 'now()' },
                        },
                    },
                },
                mappings: [],
            };

            const result = referentialValidate(ast);
            const notNullErrors = result.errors.filter(e => e.includes('NOT NULL'));
            expect(notNullErrors).toHaveLength(0);
        });

        it('should warn about wildcard mappings', () => {
            const ast: NormalizedAST = {
                project: 'test',
                sources: {
                    src1: { id: 'src1', kind: 'mongodb' },
                },
                targets: {
                    'dw.public.users': {
                        db: 'dw',
                        schema: 'public',
                        table: 'users',
                        columns: { id: { name: 'id', type: 'INT' } },
                    },
                },
                mappings: [
                    {
                        rawTarget: 'dw.public.users.*',
                        target: { db: 'dw', schema: 'public', table: 'users', column: '*' },
                        from: { source_id: 'src1' },
                        notes: null,
                        tags: [],
                    },
                ],
            };

            const result = referentialValidate(ast);
            expect(result.warnings.length).toBeGreaterThan(0);
            expect(result.warnings[0]).toContain('wildcard');
        });

        it('should warn about orphan sources', () => {
            const ast: NormalizedAST = {
                project: 'test',
                sources: {
                    src1: { id: 'src1', kind: 'mongodb' },
                    unused_source: { id: 'unused_source', kind: 'postgres' },
                },
                targets: {
                    'dw.public.users': {
                        db: 'dw',
                        schema: 'public',
                        table: 'users',
                        columns: { email: { name: 'email', type: 'VARCHAR(255)' } },
                    },
                },
                mappings: [
                    {
                        rawTarget: 'dw.public.users.email',
                        target: { db: 'dw', schema: 'public', table: 'users', column: 'email' },
                        from: { source_id: 'src1', path: '$.email' },
                        notes: null,
                        tags: [],
                    },
                ],
            };

            const result = referentialValidate(ast);
            const orphanWarnings = result.warnings.filter(w => w.includes('not referenced'));
            expect(orphanWarnings.length).toBeGreaterThan(0);
            expect(orphanWarnings[0]).toContain('unused_source');
        });

        it('should pass validation for complete valid schema', () => {
            const ast: NormalizedAST = {
                project: 'test',
                sources: {
                    mongo_users: { id: 'mongo_users', kind: 'mongodb', db: 'shop', collection: 'users' },
                },
                targets: {
                    'dw.public.dim_user': {
                        db: 'dw',
                        schema: 'public',
                        table: 'dim_user',
                        columns: {
                            user_id: { name: 'user_id', type: 'INT', pk: true },
                            email: { name: 'email', type: 'VARCHAR(255)', not_null: true },
                            created_at: { name: 'created_at', type: 'TIMESTAMP', default: 'now()' },
                        },
                    },
                },
                mappings: [
                    {
                        rawTarget: 'dw.public.dim_user.user_id',
                        target: { db: 'dw', schema: 'public', table: 'dim_user', column: 'user_id' },
                        from: { rule: 'sequence("user_seq")' },
                        notes: null,
                        tags: [],
                    },
                    {
                        rawTarget: 'dw.public.dim_user.email',
                        target: { db: 'dw', schema: 'public', table: 'dim_user', column: 'email' },
                        from: { source_id: 'mongo_users', path: '$.contact.email' },
                        notes: null,
                        tags: [],
                    },
                ],
            };

            const result = referentialValidate(ast);
            expect(result.errors).toHaveLength(0);
        });
    });
});
