// Quick test to verify normalize function processes multiple tables correctly
import { normalize } from './src/parser';

const sampleParsed = {
    project: 'test',
    sources: [],
    targets: [
        {
            db: 'dw',
            schema: 'dim',
            tables: [
                { name: 'dim_customer', columns: [{ name: 'id', type: 'int' }] },
                { name: 'dim_product', columns: [{ name: 'id', type: 'int' }] },
            ]
        },
        {
            db: 'dw',
            schema: 'fact',
            tables: [
                { name: 'fct_order', columns: [{ name: 'id', type: 'int' }] }
            ]
        }
    ],
    mappings: []
};

const ast = normalize(sampleParsed);

console.log('\n=== Normalized AST ===');
console.log('Number of target tables:', Object.keys(ast.targets).length);
console.log('Target table keys:', Object.keys(ast.targets));
console.log('\nDetailed targets:');
for (const [key, table] of Object.entries(ast.targets)) {
    console.log(`  ${key}:`, {
        db: table.db,
        schema: table.schema,
        table: table.table,
        columnCount: Object.keys(table.columns).length
    });
}

if (Object.keys(ast.targets).length !== 3) {
    console.error('\n❌ ERROR: Expected 3 tables but got', Object.keys(ast.targets).length);
    process.exit(1);
} else {
    console.log('\n✅ SUCCESS: All 3 tables were normalized correctly');
}
