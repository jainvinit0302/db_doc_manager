import { NormalizedAST } from './parser';

export interface GeneratedDialects {
    sql: string;
    postgres: string;
    snowflake: string;
    mongodb: string;
}

export function generateDialects(ast: NormalizedAST): GeneratedDialects {
    const standard = generatePostgres(ast);
    return {
        sql: standard,
        postgres: standard,
        snowflake: generateSnowflake(ast),
        mongodb: generateMongoDB(ast),
    };
}

export function generateSQL(ast: NormalizedAST): string {
    return generatePostgres(ast);
}

// -------------------------
// POSTGRESQL GENERATOR
// -------------------------
function generatePostgres(ast: NormalizedAST): string {
    if (!ast || !ast.targets) return '';
    const statements: string[] = [];

    // Generate dimensions before facts
    const tableKeys = Object.keys(ast.targets).sort((a, b) => {
        const A = ast.targets[a];
        const B = ast.targets[b];

        const isA_fact = A.table.toLowerCase().startsWith("fact");
        const isB_fact = B.table.toLowerCase().startsWith("fact");

        if (isA_fact && !isB_fact) return 1;
        if (!isA_fact && isB_fact) return -1;
        return A.table.localeCompare(B.table);
    });

    for (const key of tableKeys) {
        const t = ast.targets[key];
        const tableName = `${t.db}.${t.schema}.${t.table}`;

        let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
        const colNames = Object.keys(t.columns || {});
        const colDefs: string[] = [];

        for (const colName of colNames) {
            const col = t.columns[colName];
            let def = `  ${colName} ${col.type}`;  // KEEP FULL TYPE EXACTLY

            if (col.pk) def += ' PRIMARY KEY';
            if (col.unique) def += ' UNIQUE';
            if (col.not_null) def += ' NOT NULL';
            if (col.default) def += ` DEFAULT ${col.default}`;
            // Inline foreign key reference if present
            if (col.fk) {
                def += ` REFERENCES ${t.db}.${t.schema}.${col.fk.table}(${col.fk.column})`;
            }
            colDefs.push(def);
        }

        sql += colDefs.join(',\n');
        sql += `\n);`;
        statements.push(sql);
    }
    return statements.join('\n\n');
}

// -------------------------
// SNOWFLAKE GENERATOR
// -------------------------
function generateSnowflake(ast: NormalizedAST): string {
    if (!ast || !ast.targets) return '';
    const statements: string[] = [];

    const tableKeys = Object.keys(ast.targets).sort((a, b) => {
        const A = ast.targets[a];
        const B = ast.targets[b];

        const isA_fact = A.table.toLowerCase().startsWith("fact");
        const isB_fact = B.table.toLowerCase().startsWith("fact");

        if (isA_fact && !isB_fact) return 1;
        if (!isA_fact && isB_fact) return -1;
        return A.table.localeCompare(B.table);
    });

    for (const key of tableKeys) {
        const t = ast.targets[key];
        const tableName = `${t.db}.${t.schema}.${t.table}`;

        let sql = `CREATE OR REPLACE TABLE ${tableName} (\n`;
        const colNames = Object.keys(t.columns || {});
        const colDefs: string[] = [];
        let pkColumn: string | null = null;

        for (const colName of colNames) {
            const col = t.columns[colName];
            let type = col.type;

            // Type mapping
            if (/^varchar/i.test(type)) type = 'STRING';
            if (/^text/i.test(type)) type = 'STRING';
            if (/^decimal/i.test(type)) type = type.replace(/decimal/i, 'NUMBER');

            let def = `  ${colName} ${type}`;

            if (col.unique) def += ' UNIQUE';
            if (col.not_null) def += ' NOT NULL';

            if (col.default) {
                let d = col.default;
                if (d.toLowerCase() === 'now()' || d.toLowerCase() === 'current_timestamp') {
                    d = 'CURRENT_TIMESTAMP()';
                }
                def += ` DEFAULT ${d}`;
            }

            if (col.fk) {
                def += ` REFERENCES ${t.db}.${t.schema}.${col.fk.table}(${col.fk.column})`;
            }

            if (col.pk) pkColumn = colName;
            colDefs.push(def);
        }

        if (pkColumn) {
            colDefs.push(`  PRIMARY KEY (${pkColumn})`);
        }

        sql += colDefs.join(',\n');
        sql += `\n);`;
        statements.push(sql);
    }
    return statements.join('\n\n');
}

// -------------------------
// MONGODB GENERATOR
// -------------------------
function generateMongoDB(ast: NormalizedAST): string {
    if (!ast || !ast.targets) return '';
    const statements: string[] = [];
    const tableKeys = Object.keys(ast.targets).sort();

    statements.push(`// MongoDB Schema Validation Script`);
    statements.push(`// Run this in mongosh or a driver`);

    for (const key of tableKeys) {
        const t = ast.targets[key];
        const collectionName = t.table;

        // Required fields = PK + NOT NULL only
        const requiredFields = Object.keys(t.columns || {}).filter(c => {
            const col = t.columns[c];
            return col.pk || col.not_null;
        });

        let script = `db.createCollection("${collectionName}", {\n`;
        script += `  validator: {\n`;
        script += `    $jsonSchema: {\n`;
        script += `      bsonType: "object",\n`;

        if (requiredFields.length > 0) {
            script += `      required: [${requiredFields.map(c => `"${c}"`).join(', ')}],\n`;
        }

        script += `      properties: {\n`;

        const colNames = Object.keys(t.columns || {});
        for (const colName of colNames) {
            const col = t.columns[colName];
            let typeLower = (col.type || '').toLowerCase();

            let bsonType: any = "string";

            // Type mapping
            if (typeLower.includes('bigint')) {
                bsonType = "long";
            } else if (typeLower.includes('int')) {
                bsonType = "int";
            } else if (typeLower.includes('date') || typeLower.includes('time')) {
                bsonType = "date";
            } else if (typeLower.includes('decimal')) {
                bsonType = ["double", "decimal"];
            } else if (typeLower.includes('double') || typeLower.includes('float') || typeLower.includes('number')) {
                bsonType = "double";
            }

            const isRequired = requiredFields.includes(colName);

            script += `        ${colName}: { bsonType: `;
            if (isRequired) {
                script += JSON.stringify(bsonType);
            } else {
                const types = Array.isArray(bsonType) ? bsonType : [bsonType];
                script += JSON.stringify(types.concat(["null"]));
            }
            script += ` },\n`;
        }

        script += `      }\n`;
        script += `    }\n`;
        script += `  }\n`;
        script += `});`;

        statements.push(script);
    }

    return statements.join('\n\n');
}
