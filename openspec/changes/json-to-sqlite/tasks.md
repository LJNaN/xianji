# Tasks

## 1. Install better-sqlite3 dependency
- Add `better-sqlite3` to `server/package.json`

## 2. Create database module
- Create `server/db.js` — SQLite initialization, schema creation, WAL mode

## 3. Rewrite server.js data layer
- Replace `loadSongs()`/`saveSongs()` with direct SQLite queries
- Rewrite all 11 API endpoints to use SQLite
- Add JSON → SQLite migration on startup
- Add 30-day visit cleanup on startup

## 4. Update Dockerfile
- Add build dependencies for native module compilation (python3, make, g++)
- Copy `db.js` into the image

## 5. Update docker-compose.yml
- Replace file-level bind mounts with directory-level mount (`./server/data:/app/data`)
- Update backup service volumes

## 6. Update backup.sh
- Back up SQLite database instead of JSON files

## 7. Update .gitignore
- Add `server/data/`, `server/song_list.json`, `server/visits.json`
