## 1. 环境变量模板

- [x] 1.1 创建 `.env.example` 文件，包含 `DEEPSEEK_KEY` 变量名和获取说明
- [x] 1.2 更新 `.gitignore`，确认 `.env` 和 `.env.local` 仍在忽略列表中

## 2. 图片目录占位跟踪

- [x] 2.1 修改 `.gitignore`：`server/images/` 改为 `server/images/*` + `!server/images/.gitkeep`
- [x] 2.2 执行 `git rm --cached server/images/*` 移除已跟踪的运行时图片
- [x] 2.3 创建 `server/images/.gitkeep` 并 `git add -f` 提交跟踪

## 3. 运行时数据文件提交

- [x] 3.1 从 `.gitignore` 中移除 `server/song_list.json` 和 `server/visits.json`
- [x] 3.2 将 `server/song_list.json` 和 `server/visits.json` 内容重置为 `[]` 并提交

## 4. 服务器配置

- [x] 4.1 部署后在服务器执行 `git update-index --skip-worktree server/song_list.json server/visits.json`
