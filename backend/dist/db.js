"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const DB_PATH = path_1.default.join(__dirname, '../db/dbdoc.db');
const SCHEMA_PATH = path_1.default.join(__dirname, '../db/schema.sql');
// Ensure db directory exists
const dbDir = path_1.default.dirname(DB_PATH);
if (!fs_1.default.existsSync(dbDir)) {
    fs_1.default.mkdirSync(dbDir, { recursive: true });
}
// Initialize database
const db = new better_sqlite3_1.default(DB_PATH);
// Enable foreign keys
db.pragma('foreign_keys = ON');
// Initialize schema if needed
function initializeSchema() {
    try {
        const schema = fs_1.default.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schema);
        console.log('Database schema initialized successfully');
    }
    catch (error) {
        console.error('Error initializing database schema:', error);
        throw error;
    }
}
// Initialize on first import
initializeSchema();
exports.default = db;
