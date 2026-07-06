## Why

JSON 文件存储方案在 Docker 部署和 git 版本控制间存在根本矛盾：Docker bind mount 要求宿主机存在文件，但这些文件又是运行时数据，提交到 git 会导致 `git pull` 覆盖风险，不提交则 Docker 首次挂载会创建为目录。SQLite 作为嵌入式数据库，以单个文件存储在数据目录中，通过 Docker directory bind mount 即可规避所有问题。

## What Changes

1. 使用 `better-sqlite3` 替换 JSON 文件存储（song_list.json / visits.json）
2. 启动时自动从 JSON 文件迁移数据到 SQLite，原文件重命名为 `.bak` 备份
3. visits 表只保留最近 30 天的记录（启动时自动清理）
4. Docker 配置从文件级 bind mount 改为目录级 mount
5. 从 git 中移除 song_list.json 和 visits.json 的跟踪，放回 `.gitignore`

## Capabilities

### New Capabilities
- `data-migration`: 从 JSON 文件到 SQLite 的自动数据迁移

### Modified Capabilities
- `data`: 存储后端从 JSON 文件改为 SQLite，数据模型不变、API 不变
- `backend`: 移除启动时创建 JSON 文件的逻辑，增加 SQLite 初始化和迁移逻辑

## Impact

- `server/server.js` — 重写数据读写逻辑（loadSongs/saveSongs 改为 SQLite 查询）
- `server/package.json` — 新增 `better-sqlite3` 依赖
- `server/Dockerfile` — 新增 Alpine 构建依赖 (`python3`, `make`, `g++`)
- `docker-compose.yml` — 文件级 volume 改为目录级 volume
- `.gitignore` — 添加 `server/data/`，重新添加 `server/song_list.json` 和 `server/visits.json`
- `openspec/specs/data/spec.md` — 更新存储后端描述
- `openspec/specs/backend/spec.md` — 更新启动逻辑描述
