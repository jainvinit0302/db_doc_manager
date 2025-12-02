"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const DB_PATH = path_1.default.join(__dirname, '../db/dbdoc.db');
const db = new better_sqlite3_1.default(DB_PATH);
try {
    console.log('--- Checking Projects Table Structure ---');
    const tableInfo = db.prepare("PRAGMA table_info(projects)").all();
    console.log(tableInfo);
    console.log('\n--- Checking Last 5 Projects ---');
    const projects = db.prepare("SELECT id, name, metadata FROM projects ORDER BY id DESC LIMIT 5").all();
    projects.forEach((p) => {
        console.log(`\nProject ID: ${p.id}, Name: ${p.name}`);
        console.log('Metadata (raw):', p.metadata);
        try {
            if (p.metadata) {
                console.log('Metadata (parsed):', JSON.parse(p.metadata));
            }
        }
        catch (e) {
            console.log('Error parsing metadata:', e);
        }
    });
    db.close();
}
catch (error) {
    console.error('Error:', error);
}
