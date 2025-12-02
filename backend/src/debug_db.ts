import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../db/dbdoc.db');
const db = new Database(DB_PATH);

try {
    console.log('--- Checking Projects Table Structure ---');
    const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
    console.log(tableInfo);

    console.log('\n--- Checking Last 5 Projects ---');
    const projects = db.prepare("SELECT id, name, metadata FROM projects ORDER BY id DESC LIMIT 5").all();

    projects.forEach((p: any) => {
        console.log(`\nProject ID: ${p.id}, Name: ${p.name}`);
        console.log('Metadata (raw):', p.metadata);
        try {
            if (p.metadata) {
                console.log('Metadata (parsed):', JSON.parse(p.metadata));
            }
        } catch (e) {
            console.log('Error parsing metadata:', e);
        }
    });

    db.close();
} catch (error) {
    console.error('Error:', error);
}
