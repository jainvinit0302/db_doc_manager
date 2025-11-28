import { generateMermaidERD } from './src/generator';
import path from 'path';
import fs from 'fs';

const sampleAST = {
    targets: {
        "dw.public.users": {
            db: "dw",
            schema: "public",
            table: "users",
            columns: {
                user_id: { type: "integer" },
                email: { type: "varchar" }
            }
        },
        "dw.public.orders": {
            db: "dw",
            schema: "public",
            table: "orders",
            columns: {
                order_id: { type: "integer" },
                user_id: { type: "integer" }, // No explicit FK, should infer from name
                amount: { type: "decimal" }
            }
        },
        "dw.public.items": {
            db: "dw",
            schema: "public",
            table: "items",
            columns: {
                item_id: { type: "integer" },
                order_id: { type: "integer" }, // No explicit FK, should infer from name
                product: { type: "varchar" }
            }
        }
    }
};

const outDir = path.join(__dirname, 'test_output_erd');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const result = generateMermaidERD(sampleAST, outDir);
console.log("Generated files:", result.map(r => r.name));

// Check if erd_all.mmd exists and has content
const allErdPath = path.join(outDir, 'erd_all.mmd');
if (fs.existsSync(allErdPath)) {
    console.log("\nerd_all.mmd content:");
    console.log(fs.readFileSync(allErdPath, 'utf8'));
} else {
    console.error("erd_all.mmd was NOT generated!");
}
