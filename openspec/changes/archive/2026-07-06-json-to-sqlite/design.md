## Context

当前 `song_list.json` 和 `visits.json` 以 JSON 文件存储运行时数据。该方案存在两个问题：

1. **Docker bind mount 冲突**：docker-compose 将文件挂载到容器，宿主机若不存在则 Docker 创建为目录，导致 server.js 需额外检测和修复逻辑
2. **Git 跟踪矛盾**：文件提交到 git 后，`git pull` 可能覆盖服务器运行数据；不提交则 Docker 挂载无源可依

改用 SQLite 可将所有数据存入单一数据库文件，Docker 仅需挂载数据目录而非文件，同时完全避免 git 跟踪运行时数据的问题。

## Goals / Non-Goals

**Goals:**
- 以 SQLite 替代 JSON 文件作为存储后端
- API 行为完全不变（所有接口保持相同的请求/响应格式）
- 启动时自动从现有 JSON 文件迁移数据到 SQLite
- visits 表只保留最近 30 天的记录
- Docker 配置从文件 bind mount 改为目录 mount
- song_list.json / visits.json 撤回 git 跟踪

**Non-Goals:**
- 不改变前端代码
- 不改变 API 路由或响应格式
- 不引入 ORM 或其他数据抽象层

## Decisions

### 1. 使用 `better-sqlite3` 而非 `sql.js`

- **决策**：`better-sqlite3`
- **理由**：同步 API 与当前 `loadSongs()`/`saveSongs()` 的同步模式完全匹配，改动最小。`sql.js` 需手动管理内存中数据库的同步写回。
- **代价**：在 `node:20-alpine` Docker 镜像中需额外安装 `python3`、`make`、`g++` 编译依赖。Windows 本地开发需要 Python 3.x 和 Visual Studio Build Tools 编译原生模块。
- **替代方案**：`sql.js` — 纯 JS 无原生依赖，但 API 不同，需手动 flush 到磁盘

### 2. Docker volume 从文件级改为目录级

- **决策**：将 `./server/song_list.json:/app/song_list.json` 替换为 `./server/data:/app/data`
- **理由**：Docker 对不存在的目录创建空的同名目录，符合 SQLite 数据库文件的预期使用方式；不存在"文件变目录"的问题
- **替代方案**：Docker named volume — 可工作但数据存储在 Docker 管理的路径中，不便于直接查看

### 3. 迁移策略：启动时自动执行，原 JSON 重命名而非删除

- **决策**：启动时检测 `song_list.json` 或 `visits.json` 是否存在，读取数据写入 SQLite，然后重命名为 `.song_list.json.bak` 作为备份
- **理由**：一键迁移无需手动操作，保留原文件作为数据安全的最后防线

### 4. visits 保留最近 30 天

- **决策**：启动时执行 `DELETE FROM visits WHERE date < date('now', '-30 days')`
- **理由**：visits 数据仅用于统计分析，不需要永久保留

## SQLite Schema

```sql
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
```

## Migration Plan

### 部署步骤
1. 合并代码
2. `docker compose down` 停止服务
3. 手动将 `./server/song_list.json` 和 `./server/visits.json` 复制到 `./server/data/` （确保容器启动时有数据源）
4. 更新 `docker-compose.yml` 后 `docker compose up -d` 启动
5. 验证数据正确
6. 清理备份文件（可选）

### 回滚策略
- 保留 git 上旧版本的标签
- JSON 文件只被重命名（.bak）而非删除，可手动恢复

## Risks / Trade-offs

- [Risk] `better-sqlite3` 在 Alpine 上编译失败 → Mitigation: Dockerfile 中明确安装构建依赖，锁定 `better-sqlite3` 版本
- [Risk] 迁移时 JSON 文件被占用或损坏 → Mitigation: 仅在启动时执行迁移，server.js 内部无并发写 JSON 的操作
- [Risk] 迁移后需在 Docker 外保留 `./server/data/` 目录 → Mitigation: 目录在 `docker compose up` 时自动创建
