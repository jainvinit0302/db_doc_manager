-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  dsl_content TEXT NOT NULL,
  metadata TEXT, -- JSON: validation results, parsedData, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster project lookups by user
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Usage Stats table
CREATE TABLE IF NOT EXISTS usage_stats (
  user_id INTEGER PRIMARY KEY,
  login_count INTEGER DEFAULT 0,
  validation_count INTEGER DEFAULT 0,
  generation_count INTEGER DEFAULT 0,
  last_active DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
