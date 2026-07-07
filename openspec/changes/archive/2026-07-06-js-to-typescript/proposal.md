## Why

全项目代码为 JavaScript（React JSX + Express JS），缺乏类型安全保障。JSX/JS 文件在重构和维护时无法利用静态类型检查，运行时错误难以在开发阶段捕获。TypeScript 在 Vite 生态中已是一等公民，迁移成本低（无需改变构建工具链），收益高（类型安全、IDE 智能提示、减少运行时异常）。

## What Changes

1. 创建共享类型定义 `src/types.ts`（Song/SongFromApi/SortMode/ThemeMode 等）
2. 后端 server.js + db.js 迁移为 TypeScript，所有路由和数据库操作类型化
3. 前端 7 个组件（App/SongItem/TabsPage/TestPage/main）从 .jsx 迁移为 .tsx
4. vite.config.js 迁移为 vite.config.ts（defineConfig 自动推断类型）
5. 配置 tsconfig.json（前端 bundler mode）+ server/tsconfig.json（后端 commonjs）
6. 修复 `downloadImage` 中 `safe` 变量未定义的 bug
7. 修复深色模式下 Ant Design message/Modal 静态方法不跟随主题的问题
8. Dockerfile 适配 tsx 运行时

## Capabilities

### New Capabilities
- `typescript`: TypeScript 类型系统覆盖全项目

### Modified Capabilities
- `backend`: 从 CommonJS require 迁移为 ES module import，使用 tsx 运行时
- `frontend`: 从 .jsx 迁移为 .tsx，组件 props 接口化

## Impact

- `server/server.js` → `server/server.ts` — 全量重写为 TypeScript
- `server/db.js` → `server/db.ts` — 导出 SongRow/VisitRow 类型
- `src/` — 7 个文件从 .jsx 迁移为 .tsx
- `vite.config.js` → `vite.config.ts`
- `server/package.json` — start 脚本改为 tsx
- `server/Dockerfile` — 从 node 运行改为 npx tsx
- `server/tsconfig.json` — 新增后端 TS 配置
- `tsconfig.json` + `tsconfig.node.json` — 新增前端 TS 配置
