
import { generateLineageJSON } from './src/generator';
import path from 'path';
import fs from 'fs';

const sampleAST = {
    sources: {
        crm: { type: 'postgres' },
        web: { type: 'api' }
    },
    targets: {
        "dw.public.users": {
            db: "dw",
            schema: "public",
            table: "users",
            columns: {
                user_id: { type: "integer" },
                email: { type: "varchar" },
                created_at: { type: "timestamp" }
            }
        }
    },
    mappings: [
        {
            target: { db: "dw", schema: "public", table: "users", column: "user_id" },
            from: { source_id: "crm", path: "$.id" }
        },
        {
            target: { db: "dw", schema: "public", table: "users", column: "email" },
            from: { source_id: "web", path: "$.user.email" }
        },
        {
            target: { db: "dw", schema: "public", table: "users", column: "created_at" },
            from: { rule: "NOW()" }
        },
        // Case with missing source_id
        {
            target: { db: "dw", schema: "public", table: "users", column: "unknown_col" },
            from: { path: "$.something" }
        }
    ]
};

const outDir = path.join(__dirname, 'test_output');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const result = generateLineageJSON(sampleAST, outDir);
console.log(JSON.stringify(result, null, 2));
