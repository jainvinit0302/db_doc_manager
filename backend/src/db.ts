import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../db/dbdoc.db');
const SCHEMA_PATH = path.join(__dirname, '../db/schema.sql');

// Ensure db directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema if needed
function initializeSchema() {
    try {
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schema);
        console.log('Database schema initialized successfully');
    } catch (error) {
        console.error('Error initializing database schema:', error);
        throw error;
    }
}

// Initialize on first import
initializeSchema();

export default db;
