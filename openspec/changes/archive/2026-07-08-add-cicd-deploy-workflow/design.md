## Context

项目已 Docker 化（docker-compose: 前端 Nginx + 后端 Express + 定时备份），部署在 Rocky Linux 9.5 服务器上。之前部署依赖手动 SSH 进服务器操作。

## Goals / Non-Goals

**Goals:**
- push 到 main 后自动触发部署流程
- 包含前端构建验证，失败则中止
- 通过 rsync 增量同步代码（跳过 node_modules、.git、运行时数据）
- 服务器端用 Docker Compose 重建并重启容器

**Non-Goals:**
- 不处理多环境（staging/prod）—— 只有一台生产服务器
- 不引入容器镜像仓库 —— 直接在服务器构建
- 不做单元测试/集成测试 —— 本项目尚无测试基础设施

## Decisions

1. **rsync 而非 git pull**
   - 无需在服务器上配置 Git 凭证
   - 可以灵活排除不需要同步的目录（node_modules、server/data 等）
   - 增量传输，效率高

2. **服务器本地构建 Docker 镜像**
   - 避免搭建镜像仓库的开销
   - 单服务器场景下足够简单

3. **GitHub Actions 而非自建 CI**
   - 代码已在 GitHub，零额外运维
   - Secrets 管理成熟
   - Rocky Linux 服务器只需开放 SSH 端口

4. **webfactory/ssh-agent + 原生 ssh/rsync 而非 appleboy actions**
   - 依赖更少，流程透明
   - rsync 支持 --exclude 排除无关目录，上传更高效

## Risks / Trade-offs

- 服务器需预装 Docker Engine + docker compose 插件 + rsync → 首次部署需手动确认
- GitHub Actions runner 到服务器的 SSH 连通性故障时无 fallback → 需手动介入
- 服务器本地构建消耗 CPU/内存，大版本升级时可能较慢 → 镜像层缓存可缓解
