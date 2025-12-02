"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Migration script to add metadata column to existing projects table
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const DB_PATH = path_1.default.join(__dirname, '../db/dbdoc.db');
const db = new better_sqlite3_1.default(DB_PATH);
try {
    // Check if metadata column exists
    const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
    const hasMetadata = tableInfo.some((col) => col.name === 'metadata');
    if (!hasMetadata) {
        console.log('Adding metadata column to projects table...');
        db.prepare('ALTER TABLE projects ADD COLUMN metadata TEXT').run();
        console.log('✓ metadata column added successfully');
    }
    else {
        console.log('✓ metadata column already exists');
    }
    db.close();
    console.log('Migration completed successfully');
}
catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
}
