## Context

当前仓库存在三个与 git 文件跟踪相关的问题：

- **`.env`**：存放 DeepSeek API Key，已正确忽略，但新开发者无从得知需要配置哪些变量
- **`server/images/`**：在 `.gitignore` 中，但已有大量运行时图片文件意外被 git 跟踪（之前 add 后未更新 gitignore），导致仓库膨胀，且新克隆不保留目录
- **`server/song_list.json` / `server/visits.json`**：Docker volume 要求宿主机存在这些文件。当前在 `.gitignore` 中，若不存在 Docker 会创建为目录导致服务异常；但若提交为 `[]`，服务器运行后 `git pull` 会覆盖数据

## Goals / Non-Goals

**Goals:**
- 创建 `.env.example` 供新开发者参考
- `server/images/` 目录在 git 中保留为空占位，不跟踪运行时图片
- `server/song_list.json` 和 `server/visits.json` 提交为 `[]`，且服务器运行数据不受 `git pull` 影响

**Non-Goals:**
- 不修改任何业务逻辑
- 不改变现有数据格式或 API
- 不添加 CI/CD 流程

## Decisions

### 1. 使用 `.env.example` 而非提交 `.env`

- **决策**：创建 `.env.example` 提交到 git，`server.js` 启动时若 `.env` 不存在仍会创建模板（保持现有行为）
- **理由**：标准实践。提交 `.env` 会泄露密钥，不提交则新开发者不知道要配置什么。`.env.example` 作为文档存在
- **替代方案**：只在 README 中说明 → 不如 `.env.example` 直观，开发者可能忽略

### 2. `server/images/` 使用 `.gitkeep` 占位

- **决策**：修改 `.gitignore`，用 `server/images/*` + `!server/images/.gitkeep` 模式只跟踪 `.gitkeep`；`git rm --cached` 移除已跟踪的运行时图片
- **理由**：Git 不跟踪空目录，`.gitkeep` 是标准占位方式。运行时图片不应被版本控制（每次爬取/上传都在变化）
- **替代方案**：在 server.js 启动时 `mkdirSync` 创建目录（已有 `fs.mkdirSync(IMAGE_DIR, { recursive: true })`）→ 但不影响 git 层面的占位，新克隆的仓库 `server/images/` 目录不存在，`git status` 会显示为未跟踪

### 3. `server/song_list.json` 和 `server/visits.json` 提交为 `[]` + `git update-index --skip-worktree`

- **决策**：从 `.gitignore` 中移除这两个文件，提交内容为 `[]`；在服务器上运行 `git update-index --skip-worktree` 让 git 忽略本地修改
- **理由**：
  - Docker volume 要求宿主机存在这些文件，不提交则首次 `docker compose up` 会出问题
  - `--skip-worktree` 标记后，`git pull` 不会覆盖本地运行数据，`git status` 也不会显示修改
  - server.js 第 25-36 行的启动自动创建逻辑作为二次保障
- **替代方案**：保留在 `.gitignore` 中、在 docker-compose 里移除 volume 映射 → 改动更大，且容器重启后数据丢失

## Risks / Trade-offs

- **遗忘 `--skip-worktree`** → 服务器上 `git pull` 可能导致 song_list.json 被重置为 `[]`，歌单丢失
  - 缓解：在实施文档中强调，也可脚本自动化
- **已有运行时图片已占用 git 历史** → `git rm --cached` 仅从当前提交移除，历史记录中仍存在
  - 缓解：这是可接受的，图片不会被下载到新克隆，且历史中的 blob 可通过 `git gc` 清理
