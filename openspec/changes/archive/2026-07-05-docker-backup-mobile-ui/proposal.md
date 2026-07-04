## Why

目前项目通过 `node server.js` 和 `vite dev` 在本地直接运行，缺少容器化编排、数据备份机制，且移动端部分 UI 在手机上体验不佳。需要将前后端容器化、建立自动备份机制，并修复移动端响应式问题。

## What Changes

- **Docker 容器化**: 新增 docker-compose.yml 编排三个服务（frontend Nginx SPA + backend Express API + backup 定时备份），前后端各自独立容器运行
- **数据自动备份**: 新增 backup.sh 备份脚本，song_list.json 每日备份、images/ 每周打包 zip，自动清理过期备份
- **移动端 UI 优化**: 候选图片选择器在手机上尺寸从 200x250px 缩小到 140x180px；首页歌名间距从 4px 增大到 10px
- **基础设施文件**: 新增 Dockerfile、nginx.conf、.dockerignore、server/Dockerfile、server/Dockerfile.backup

## Capabilities

### New Capabilities
- `container-deployment`: Docker 容器化部署，包含 Nginx 反代配置、多阶段构建、docker-compose 多服务编排
- `data-backup`: 数据自动备份机制，支持每日 json 备份和每周 images 打包，含自动清理策略
- `mobile-ui`: 移动端响应式 UI 优化，候选图片选择器适配和列表间距调整

### Modified Capabilities
<!-- 本次不修改现有规格的 requirements -->

## Impact

- 新增 6 个 Docker/infra 文件（docker-compose.yml, Dockerfile, nginx.conf, .dockerignore, server/Dockerfile, server/Dockerfile.backup）
- 新增 2 个备份相关文件（server/backup.sh, server/install_backup_task.bat）
- 修改 2 个前端文件（src/App.css, src/TabsPage.jsx）
- 修改 1 个配置文件（.gitignore）
- 后端代码（server.js）无需修改，现有路径映射与 Docker 卷挂载兼容
- 现有开发流程不变：仍可直接 `node server.js` + `vite dev` 运行
