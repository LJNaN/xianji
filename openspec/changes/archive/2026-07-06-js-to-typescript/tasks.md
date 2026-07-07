# Tasks

## 1. Install dependencies
- Frontend: `typescript @types/react @types/react-dom`
- Backend: `typescript tsx @types/express @types/better-sqlite3 @types/multer @types/cors @types/cheerio @types/node`

## 2. Create TypeScript configurations
- `tsconfig.json` — frontend (target ES2020, jsx react-jsx, moduleResolution bundler, noEmit)
- `tsconfig.node.json` — Vite config
- `server/tsconfig.json` — backend (target ES2022, module commonjs, esModuleInterop)

## 3. Create shared types
- `src/types.ts` — Song / SongFromApi / ThemeMode / SortMode / API response interfaces

## 4. Migrate backend
- `server/db.js` → `server/db.ts` — export SongRow/VisitRow
- `server/server.js` → `server/server.ts` — type all routes, fix downloadImage safe bug
- Update `server/package.json` (main, start script)
- Update `server/Dockerfile` (npm install, COPY ., tsx runtime)
- Create `server/.dockerignore`

## 5. Migrate frontend
- `src/SongItem.jsx` → `src/SongItem.tsx` — props interface
- `src/App.jsx` → `src/App.tsx` — state types, fetch response typing
- `src/TabsPage.jsx` → `src/TabsPage.tsx` — ref types, dnd-kit event types
- `src/TestPage.jsx` → `src/TestPage.tsx` — drag event types
- `src/main.jsx` → `src/main.tsx` — ThemeMode type
- `vite.config.js` → `vite.config.ts` — defineConfig auto-inference

## 6. Fix dark mode theme context
- Add `<App>` wrapper in main.tsx
- Replace static message/Modal with `App.useApp()` in App.tsx, TabsPage.tsx

## 7. Update references
- `index.html` — script src from main.jsx to main.tsx

## 8. Clean up
- Delete migrated .js/.jsx files

## 9. Verify
- Backend: `npx tsx server/server.ts` — API responds 200
- Frontend: `vite build` — zero TS errors
- Frontend dev: `vite dev` — starts and serves content
