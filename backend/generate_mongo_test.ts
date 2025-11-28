// Temporary script to test generateMongoDB
import { generateMongoDB } from './src/sql_generator';

const sampleAST = {
    targets: {
        tbl1: {
            db: 'testdb',
            schema: 'public',
            table: 'users',
            columns: {
                id: { type: 'BIGINT', pk: true },
                name: { type: 'VARCHAR', not_null: true },
                age: { type: 'INT' },
                created_at: { type: 'TIMESTAMP' },
                price: { type: 'DECIMAL' },
                is_active: { type: 'BOOLEAN' },
                meta: { type: 'JSON' },
                tags: { type: 'ARRAY' },
                optional: { type: 'VARCHAR' }
            }
        }
    }
};

console.log(generateMongoDB(sampleAST as any));
