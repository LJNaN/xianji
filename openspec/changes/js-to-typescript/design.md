## Context

项目最初全部使用 JavaScript（React 17 + Express 5），随着功能增长，代码量已达 3000+ 行。缺失类型检查导致以下问题：
- API 响应结构变化时前端对应修改容易遗漏
- catch 块中 err 类型处理不一致
- dnd-kit / react-zoom-pan-pinch 等第三方库的 ts 类型无法利用
- 重构（如 SQLite 迁移）需要手动追踪所有调用点的数据流

## Goals / Non-Goals

**Goals:**
- 全项目代码从 .js/.jsx 迁移到 .ts/.tsx
- 所有 API 路由参数、请求/响应体类型化
- 共享类型定义（Song/SortMode/ThemeMode 等）
- 前置依赖安装和 tsconfig 配置
- Docker 运行环境适配 TypeScript

**Non-Goals:**
- 不改变运行时行为或 API 契约
- 不引入新的抽象层或设计模式
- 不要求预编译（使用 tsx 运行时直接执行）
- 不改动 CSS 或 UI 结构

## Decisions

### 1. 运行时选择：tsx（非 ts-node）

- **决策**：使用 `tsx` (esbuild-based TypeScript runner)
- **理由**：esbuild 速度比 ts-node 快 10-100 倍，零配置即可运行，且与本项目的 Vite 构建工具（同样基于 esbuild）保持一致
- **替代方案**：ts-node — 配置复杂，性能差；预编译 tsc + node — 开发流程繁琐

### 2. 后端模块系统：CommonJS（esModuleInterop）

- **决策**：server/tsconfig.json 使用 `"module": "commonjs"` + `"esModuleInterop": true`
- **理由**：`better-sqlite3` 和 `multer` 等原生模块的 CJS 导出在 ESM 模式下导入复杂，CJS 模式最简单可靠
- **替代方案**：`"module": "ESNext"` — 需处理 CJS 包的 default import 兼容性问题

### 3. 前端模块解析：bundler

- **决策**：tsconfig.json 使用 `"moduleResolution": "bundler"`
- **理由**：Vite 作为 bundler 处理模块解析，bundler 模式与 Vite 行为一致，允许导入不带扩展名的路径
- **替代方案**：`"node"` — 与 Vite 的解析规则不匹配，会导致类型错误

### 4. 运行时类型检查：无（依赖 Vite build 和 IDE）

- **决策**：不配置 tsc --noEmit 作为 pre-commit hook，依赖 Vite 构建时类型擦除
- **理由**：Vite 的 esbuild 在 transform 阶段做类型擦除而非类型检查，构建速度极快。额外的 tsc 检查会拖慢开发流程，且前端 bundler 模式的 tsc 需要单独配置 project references
- **替代方案**：vue-tsc / tsc --noEmit — 增加 CI 环节但提供更严格的类型安全保障

### 5. Ant Design 主题感知：App.useApp()

- **决策**：使用 `<App>` 包裹路由树 + `App.useApp()` 替代静态 message/Modal
- **理由**：Ant Design v5 的静态方法（message.success、Modal.confirm 等）不在 ConfigProvider 上下文中，切换到 App.useApp 后获得的实例自动继承当前主题
- **替代方案**：手动写 CSS 覆盖 — 工作量大且容易遗漏

### 6. 图片下载 bug 修复

- **修复**：`downloadImage` 中 `const safe` 变量未定义就被使用（line 204），改为 `const baseName = crypto.randomUUID()`
- **理由**：原代码生成唯一文件名后检查冲突，冲突时使用未定义的 `safe` 变量拼接新文件名。经分析，crypto.randomUUID() 的碰撞概率极低，将基础名提前提取即可简洁修复

## Architecture

### 文件结构
```
├── tsconfig.json          # 前端 TS 配置（bundler mode, noEmit）
├── tsconfig.node.json     # Vite 配置文件的 TS 配置
├── vite.config.ts         # Vite 配置
├── src/
│   ├── types.ts           # 共享类型（Song, SortMode, ThemeMode 等）
│   ├── main.tsx           # 入口，App useApp 包裹
│   ├── App.tsx            # 歌单页
│   ├── SongItem.tsx       # 歌曲项组件
│   ├── TabsPage.tsx       # 详情页
│   └── TestPage.tsx       # 拖拽测试页
└── server/
    ├── tsconfig.json      # 后端 TS 配置（commonjs, strict）
    ├── db.ts              # SQLite 数据库模块 + SongRow/VisitRow 类型
    ├── server.ts          # Express 服务，全部路由类型化
    └── Dockerfile         # CMD 改为 npx tsx
```

### 类型层级
```
SongFromApi (API 原始响应)
    ↕ 映射转换
Song (前端状态)
    ↕ props
SongItemProps / 各组件 Props 接口
```

## Migration Plan

### 迁移顺序
1. 安装依赖（前后端 typescript, tsx, @types/*）
2. 创建配置文件（tsconfig.json x 3）
3. 创建共享类型 types.ts
4. 后端迁移：db.ts（导出类型）→ server.ts（路由类型化）
5. 前端迁移：SongItem → App → TabsPage → TestPage → main → vite.config
6. 更新配置：package.json, Dockerfile, index.html
7. 清理旧 .js/.jsx 文件

### 回滚策略
- 旧 .js/.jsx 文件在提交前检查确认已全部删除
- git revert 可完整回退此次迁移

## Risks / Trade-offs

- [Risk] `better-sqlite3` 的 `.all()` 返回 `unknown[]`，需 type assertion → 已验证可行
- [Risk] Express 5 + @types/express 5 类型覆盖不完全 → 基础用法（req.params, req.body, res.json）全部正常工作
- [Risk] multer 2.x + @types/multer 版本匹配 → 文件上传路由使用 Express.Multer.File 泛型
- [Trade-off] 不引入 tsc 类型检查 CI 环节 → 减少构建时间但丢失部分类型安全保障
- [Trade-off] 后端继续使用 CommonJS 模块 → 简化原生模块导入但与前端 ESM 不一致
