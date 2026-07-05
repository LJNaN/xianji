## Why

需要记录每日访问量和设备信息以便了解用户使用情况。同时修复近期发现的 UI 细节问题：候选图片取消后恢复原始图片、无谱子时仍可编辑歌名、清空图片后关闭弹窗、静态资源缓存优化、flex 布局对齐问题、手机端 crypto.randomUUID 兼容性。

## What Changes

- **访问记录系统**：新增 `/guitar-api/visit` 端点，记录 UUID、IP、UserAgent 到 `visits.json`，定时备份
- **候选图片取消修复**：取消选图时恢复自动获取前的原始图片列表
- **设置按钮常显**：详情页无谱子时也显示设置按钮（至少可编辑歌名）
- **清空关闭弹窗**：清空图片成功后自动关闭设置弹窗
- **Nginx 静态缓存**：`/guitar/assets/` 添加 `1年` 缓存 + `immutable` 头
- **备份增强**：`visits.json` 加入每日备份，90 天清理
- **手机端 UUID 兼容**：`crypto.randomUUID()` 替换为 `Math.random()` 方案
- **flex 布局修复**：`.song-grid` 添加 `align-items: flex-start`

## Capabilities

### New Capabilities

- `visit-logging`: 访问记录系统，记录每日用户访问的设备信息

### Modified Capabilities

<!-- No existing specs to modify -->

## Impact

- **后端** (`server/server.js`)：新增 `/guitar-api/visit` 端点
- **备份** (`server/backup.sh`, `docker-compose.yml`)：visits.json 加入备份
- **前端** (`src/App.jsx`, `src/TabsPage.jsx`, `src/App.css`, `src/SongItem.jsx`)：多项 UI 修复
- **部署** (`nginx.conf`)：静态资源缓存头
