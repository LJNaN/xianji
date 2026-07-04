## Context

目前项目在本地开发环境下通过 `node server.js`（端口 5000）和 `vite dev`（端口 5174）分别运行前后端，生产环境由 Express 直接托管构建后的前端静态文件。数据持久化依赖 `server/song_list.json` 和 `server/images/` 目录，无备份机制。移动端部分 UI 在窄屏手机上布局过密。

## Goals / Non-Goals

**Goals:**
- 将前后端分别容器化，通过 docker-compose 编排三个服务（frontend Nginx、backend Express、backup 定时备份）
- 建立 song_list.json 每日备份、images/ 每周打包的自动备份机制，含过期清理
- 修复移动端候选图片选择器图片过大和首页歌名间距过小的问题
- 保持现有开发流程不变（仍可直接 npm run dev 运行）

**Non-Goals:**
- 不改动现有 API 接口和数据模型
- 不引入数据库（沿用 JSON 文件存储）
- 不做 CI/CD 或部署到远程服务器

## Decisions

### 1. 架构模式：Nginx 反代 + 双容器
选择 Nginx 容器托管前端 SPA，通过反代将 API 和图片请求转发到 backend 容器。替代方案是 Express 直接托管前端（现有模式），但 Docker 化后用 Nginx 可以获得更好的静态资源性能、缓存控制和独立扩展能力。

### 2. 数据持久化：Bind Mount
使用 bind mount 将宿主机 `server/song_list.json` 和 `server/images/` 直接挂载到 backend 容器内，路径与现有代码一致（`__dirname` = `/app`）。这样即使用户不启动 Docker 也能直接操作文件。

### 3. 备份容器：Alpine + crond
备份容器使用最小化的 Alpine 镜像，安装 bash、zip、tzdata，通过系统 crond 调度每日 9:00（中国时区）执行备份脚本。与 backend 容器共享数据卷挂载，song_list.json 和 images/ 以只读方式挂载，backups/ 可写。

### 4. 前端构建：多阶段构建
前端 Dockerfile 分两个阶段：build 阶段使用 node:20-alpine 执行 `npm ci && npm run build`；run 阶段使用 nginx:alpine 仅复制构建产物和 nginx.conf。最终镜像约 20-30MB。

### 5. Nginx 路径映射
前端 base path 为 `/guitar/`，使用 alias 指令将 `/guitar/` 映射到 `/usr/share/nginx/html/`。SPA 路由回退通过 `try_files $uri $uri/ /guitar/index.html` 实现。

### 6. 备份策略
- song_list.json：每日备份，保留 90 天，文件名 `song_list_YYYY-MM-DD.json`
- images/：每周一打包 zip，保留 180 天，文件名 `images_YYYY-WW.zip`
- 通过 `date +%u` 判断周一执行 images 备份，避免每周多次重复打包

### 7. 移动端 CSS 方案
候选图片选择器从固定 `width={200} height={250}` 改为 CSS class，利用 media query 在 ≤600px 时缩小尺寸。歌单间距从 `gap: 4px` 增大到 `10px`，纯 CSS 修改，无 JavaScript 逻辑变更。

## Risks / Trade-offs

- [风险] Bind mount 在 Windows 上可能存在文件权限问题 → Mitigation: backend 容器使用 `node:20-alpine` 以 node 用户运行，确保 `song_list.json` 可写
- [风险] Docker 环境与本地开发环境不一致 → Mitigation: 保持 `npm run dev` 和 `node server.js` 开发流程不变，Docker 仅作为可选的部署方式
- [权衡] 备份容器每天唤醒执行 cron，对闲置服务器有轻微资源开销 → 但 Alpine 基础镜像仅 ~5MB，可忽略不计
- [权衡] 使用 bind mount 而非 named volume 更适合本地开发，但不利于跨机器迁移 → 本场景为单机使用，bind mount 更直观
