// Migration script to add metadata column to existing projects table
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '../db/dbdoc.db');
const db = new Database(DB_PATH);

try {
    // Check if metadata column exists
    const tableInfo = db.prepare("PRAGMA table_info(projects)").all() as any[];
    const hasMetadata = tableInfo.some((col: any) => col.name === 'metadata');

    if (!hasMetadata) {
        console.log('Adding metadata column to projects table...');
        db.prepare('ALTER TABLE projects ADD COLUMN metadata TEXT').run();
        console.log('✓ metadata column added successfully');
    } else {
        console.log('✓ metadata column already exists');
    }

    db.close();
    console.log('Migration completed successfully');
} catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
}
