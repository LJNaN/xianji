const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);

// PERSIST mode: journal file stays on disk (truncated) instead of being deleted,
// avoiding SQLITE_IOERR_DELETE on Docker bind mounts from Windows
db.pragma('journal_mode = PERSIST');

db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    img_url TEXT NOT NULL DEFAULT '[]',
    favorite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    uuid TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(date);
`);

module.exports = db;
