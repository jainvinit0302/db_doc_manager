"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateDialects = generateDialects;
exports.generateSQL = generateSQL;
function generateDialects(ast) {
    const standard = generatePostgres(ast);
    return {
        sql: standard,
        postgres: standard,
        snowflake: generateSnowflake(ast),
        mongodb: generateMongoDB(ast),
    };
}
// Keep the original function for backward compatibility if needed, or just redirect
function generateSQL(ast) {
    return generatePostgres(ast);
}
function generatePostgres(ast) {
    if (!ast || !ast.targets)
        return '';
    const statements = [];
    const tableKeys = Object.keys(ast.targets).sort();
    for (const key of tableKeys) {
        const t = ast.targets[key];
        const tableName = `${t.db}.${t.schema}.${t.table}`;
        let sql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
        const colNames = Object.keys(t.columns || {});
        const colDefs = [];
        for (const colName of colNames) {
            const col = t.columns[colName];
            // Basic type mapping could be added here
            let def = `  ${colName} ${col.type || 'VARCHAR'}`;
            colDefs.push(def);
        }
        sql += colDefs.join(',\n');
        sql += `\n);`;
        statements.push(sql);
    }
    return statements.join('\n\n');
}
function generateSnowflake(ast) {
    if (!ast || !ast.targets)
        return '';
    const statements = [];
    const tableKeys = Object.keys(ast.targets).sort();
    for (const key of tableKeys) {
        const t = ast.targets[key];
        // Snowflake often uses UPPERCASE, but we'll keep DSL case. 
        // Uses CREATE OR REPLACE TABLE usually.
        const tableName = `${t.db}.${t.schema}.${t.table}`;
        let sql = `CREATE OR REPLACE TABLE ${tableName} (\n`;
        const colNames = Object.keys(t.columns || {});
        const colDefs = [];
        for (const colName of colNames) {
            const col = t.columns[colName];
            // Map types to Snowflake types if needed
            let type = col.type || 'STRING';
            if (type.toLowerCase() === 'varchar')
                type = 'STRING'; // Snowflake prefers STRING
            if (type.toLowerCase() === 'text')
                type = 'STRING';
            let def = `  ${colName} ${type}`;
            colDefs.push(def);
        }
        sql += colDefs.join(',\n');
        sql += `\n);`;
        statements.push(sql);
    }
    return statements.join('\n\n');
}
function generateMongoDB(ast) {
    if (!ast || !ast.targets)
        return '';
    const statements = [];
    const tableKeys = Object.keys(ast.targets).sort();
    statements.push(`// MongoDB Schema Validation Script`);
    statements.push(`// Run this in mongosh or a driver`);
    for (const key of tableKeys) {
        const t = ast.targets[key];
        // MongoDB doesn't have schemas/dbs in the same way, usually just collection name
        // We'll use the table name as collection name
        const collectionName = t.table;
        let script = `db.createCollection("${collectionName}", {\n`;
        script += `  validator: {\n`;
        script += `    $jsonSchema: {\n`;
        script += `      bsonType: "object",\n`;
        script += `      required: [${Object.keys(t.columns || {}).map(c => `"${c}"`).join(', ')}],\n`;
        script += `      properties: {\n`;
        const colNames = Object.keys(t.columns || {});
        for (const colName of colNames) {
            const col = t.columns[colName];
            // Map types to BSON types
            let bsonType = "string";
            const typeLower = (col.type || '').toLowerCase();
            if (typeLower.includes('int'))
                bsonType = "int";
            else if (typeLower.includes('bool'))
                bsonType = "bool";
            else if (typeLower.includes('date') || typeLower.includes('time'))
                bsonType = "date";
            else if (typeLower.includes('float') || typeLower.includes('double') || typeLower.includes('decimal'))
                bsonType = "double";
            script += `        "${colName}": {\n`;
            script += `          bsonType: "${bsonType}",\n`;
            script += `          description: "must be a ${bsonType} and is required"\n`;
            script += `        },\n`;
        }
        script += `      }\n`;
        script += `    }\n`;
        script += `  }\n`;
        script += `});`;
        statements.push(script);
    }
    return statements.join('\n\n');
}
