<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="弦集">
</p>

<h1 align="center">弦集</h1>

<p align="center">
  吉他谱管理工具 — 搜索、下载、浏览、备份，一站式搞定
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-5-646CFF" alt="Vite 5">
  <img src="https://img.shields.io/badge/Express-4-000000" alt="Express 4">
  <img src="https://img.shields.io/badge/Docker-✓-2496ED" alt="Docker">
</p>

---

## 功能

- **歌单管理** — 增删歌曲、搜索、排序（最新/最早/已解析/未解析）
- **智能搜谱** — 输入歌名，自动从 Bing 搜索吉他谱并提取图片
- **URL 解析** — 粘贴吉他谱网页链接，自动提取页面中的图片
- **图片浏览** — 多列网格、双指缩放/拖动、自动滚动（带速度调节）
- **本地收藏** — 收藏常用歌曲，置顶显示
- **一键部署** — Docker Compose 编排，三分钟启动
- **自动备份** — 数据每日备份、图片每周打包

## 快速开始

### 方式一：Docker（推荐）

```bash
git clone https://github.com/LJNaN/xianji.git
cd xianji
docker compose up -d
```

访问 `http://你的IP/guitar/`

### 方式二：本地开发

需要 Node.js 20+。

```bash
# 终端 1：启动后端
cd server
npm install
node server.js

# 终端 2：启动前端
cd ..
npm install
npm run dev
```

前端 `http://localhost:5174/guitar/`，API 自动代理到后端 5000 端口。

## 项目结构

```
xianji/
├── src/                    # 前端源码（React + Vite）
│   ├── App.jsx             # 首页：歌单列表
│   ├── App.css             # 全局样式
│   ├── TabsPage.jsx        # 详情页：图片查看/搜索/选择
│   └── SongItem.jsx        # 歌曲卡片组件
├── server/                 # 后端（Express）
│   ├── server.js           # API 服务
│   ├── song_list.json      # 歌单数据
│   ├── images/             # 下载的吉他谱图片
│   ├── backups/            # 备份目录
│   ├── backup.sh           # 定时备份脚本
│   ├── Dockerfile          # 后端容器镜像
│   └── Dockerfile.backup   # 备份容器镜像
├── docker-compose.yml      # 编排文件
├── Dockerfile              # 前端容器镜像（多阶段构建）
└── nginx.conf              # Nginx 配置
```

## Docker 架构

| 服务 | 镜像 | 端口 | 说明 |
|------|------|------|------|
| `frontend` | nginx:alpine | 80 | 托管 SPA，反代 API 到后端 |
| `backend` | node:20-alpine | 5000 | Express API 服务 |
| `backup` | alpine:3.19 | — | 每日 9 点自动备份 |

数据文件通过 bind mount 持久化到宿主机 `server/song_list.json` 和 `server/images/`，
即使用 Docker 也能直接查看和编辑。

## 备份策略

- **歌单数据** — 每天备份，保留 90 天
- **上传图片** — 每周一打包 zip，保留 180 天
- **自动清理** — 过期备份自动删除，无需人工干预

手动触发备份：

```bash
docker compose exec backup /app/backup.sh
```

## 更新

```bash
git pull
docker compose up -d --build
```

## 技术栈

| 前端 | 后端 | 部署 |
|------|------|------|
| React 18 | Node.js 20 | Docker |
| Vite 5 | Express 4 | Nginx |
| Ant Design 5 | Cheerio | Docker Compose |
| React Router 6 | Axios | |
| react-zoom-pan-pinch | Multer | |
