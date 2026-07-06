## Why

项目仓库的 git 文件跟踪策略存在几个问题：一是 `.env` 不被跟踪，新开发者无从得知需要配置哪些环境变量；二是 `server/images/` 目录被整个忽略，大量运行时图片却已被意外跟踪，且新克隆的仓库不会保留该目录；三是 `server/song_list.json` 和 `server/visits.json` 因 Docker volume 映射需要被跟踪，但又不能在 `git pull` 时覆盖服务器运行数据。

## What Changes

1. 创建 `.env.example` 模板文件并提交到 git，指导环境变量配置
2. 用 `.gitkeep` 占位跟踪 `server/images/` 空目录，取消跟踪已有的运行时图片文件
3. 提交 `server/song_list.json` 和 `server/visits.json` 为 `[]`，通过 `git update-index --skip-worktree` 防止 `git pull` 覆盖运行数据

## Capabilities

### New Capabilities

- `git-tracking`: 仓库文件跟踪策略，覆盖 .env 模板、目录占位、运行时数据文件保护

### Modified Capabilities

<!-- 无 spec 级别的行为变更 -->

## Impact

- `.gitignore` 需要修改
- `server/images/` 下的已有跟踪文件需要从 git 中移除
- `server/song_list.json` 和 `server/visits.json` 从 `.gitignore` 中移除并重新提交
- 服务器需要进行一次 `git update-index --skip-worktree` 操作
