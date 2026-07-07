import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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

export default db;

export interface SongRow {
  id: number;
  name: string;
  img_url: string;
  favorite: number;
  created_at: string | null;
  sort_order: number;
}

export interface VisitRow {
  id: number;
  date: string;
  time: string;
  uuid: string;
  ip: string | null;
  user_agent: string | null;
}
