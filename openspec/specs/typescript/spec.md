# TypeScript Specification

## Purpose
Define the TypeScript configuration, type system, and migration conventions for the project.

## Requirements

### Requirement: TypeScript Configuration
The project SHALL use TypeScript with project-specific tsconfig files for both frontend and backend.

#### Scenario: Frontend build (Vite)
- GIVEN the project is built with `vite build`
- WHEN TypeScript files in `src/` are processed
- THEN Vite's esbuild handles type stripping (no type checking during dev/build)
- AND the output is bundled JavaScript

#### Scenario: Backend runtime (tsx)
- GIVEN the server is started with `tsx server.ts`
- WHEN TypeScript files in `server/` are executed
- THEN tsx transpiles on-the-fly using esbuild
- AND no pre-compilation step is needed

### Requirement: Shared Type Definitions
Common types SHALL be defined in `src/types.ts` and imported by both frontend components.

#### Scenario: Song type hierarchy
- GIVEN a song is fetched from the API
- WHEN the raw response is `SongFromApi` (`{ name, imgUrl?, favorite?, createdAt? }`)
- THEN it is mapped to `Song` (`{ id, name, imgUrl, favorite, createdAt }`) for frontend state
- AND props interfaces are defined per component

#### Scenario: Sort mode enumeration
- GIVEN the sort dropdown in App.tsx
- WHEN the user selects a sort option
- THEN the value is typed as `SortMode` (union of `'latest' | 'oldest' | 'nameAsc' | 'nameDesc' | 'parsed' | 'unparsed'`)

### Requirement: Theme-Aware Static Methods
Ant Design static methods SHALL be theme-aware via `App.useApp()`.

#### Scenario: Dark mode message
- GIVEN the app is in dark mode
- WHEN `message.success()` is called from `App.useApp()`
- THEN the toast notification follows the current ConfigProvider theme
- AND no manual CSS overrides are needed

### Requirement: Type Safety Conventions

#### Scenario: API route typing
- GIVEN an Express route handler
- WHEN req.params, req.query, or req.body are accessed
- THEN they SHALL be cast to the expected type using `as` assertions or interface annotations

#### Scenario: SQLite query results
- GIVEN a `db.prepare(...).all()` or `.get()` call
- WHEN the result is used outside the query
- THEN it SHALL be asserted with `as SongRow[]` or `as { count: number }`
- AND better-sqlite3's `unknown` return type is explicitly narrowed

#### Scenario: dnd-kit event typing
- GIVEN a drag event handler
- WHEN `active.id` or `over?.id` is compared with string IDs
- THEN the `UniqueIdentifier` type (`string | number`) is handled via `String()` or direct comparison

### Requirement: File Conventions

#### Scenario: Naming
- Frontend components: `.tsx` extension
- Backend modules: `.ts` extension
- Shared types: `.ts` extension
- Vite config: `.ts` extension

#### Scenario: Imports
- Frontend: ES module imports (matching Vite bundler behavior)
- Backend: CommonJS imports with esModuleInterop (`import x from 'y'` pattern)
- Type-only imports SHOULD use `import type { ... }` syntax
