## 1. Docker 容器化

- [ ] 1.1 创建 .dockerignore 文件，排除 node_modules、dist、.claude、.git
- [ ] 1.2 创建 nginx.conf，配置 /guitar/ SPA 托管、/guitar-api/ 反代、/guitar-images/ 反代
- [ ] 1.3 创建前端 Dockerfile（多阶段构建：Vite build → nginx:alpine）
- [ ] 1.4 创建 server/Dockerfile（Node.js Express 后端容器化）
- [ ] 1.5 创建 server/Dockerfile.backup（Alpine + crond 定时备份容器）
- [ ] 1.6 创建 docker-compose.yml，编排 frontend/backend/backup 三个服务
- [ ] 1.7 验证 `docker compose build` 无报错

## 2. 数据备份

- [ ] 2.1 创建 server/backup.sh，实现 song_list.json 每日备份到 server/backups/
- [ ] 2.2 在 backup.sh 中实现 images/ 每周一打包 zip 的逻辑
- [ ] 2.3 在 backup.sh 中添加过期清理：json 保留 90 天，zip 保留 180 天
- [ ] 2.4 创建 server/install_backup_task.bat Windows 计划任务安装脚本
- [ ] 2.5 更新 .gitignore 添加 server/backups/ 规则

## 3. 移动端 UI 优化

- [ ] 3.1 修改 TabsPage.jsx 候选图片选择器：去掉固定 width/height，改用 className
- [ ] 3.2 在 App.css 添加 .candidate-image 样式（默认 200x250px，object-fit: contain）
- [ ] 3.3 在 App.css 添加 ≤600px media query，候选图片缩小到 140x180px
- [ ] 3.4 在 App.css 将手机端 ≤480px 的 .song-grid gap 从 4px 增大到 10px
