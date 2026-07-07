## 1. 创建工作流文件

- [x] 1.1 创建 `.github/workflows/deploy.yml` 含构建检查、rsync 同步、Docker 部署三步

## 2. 验证

- [x] 2.1 确认工作流语法正确（GitHub Actions 无 lint 错误）
- [x] 2.2 确认服务器端已预装 Docker Engine + docker compose v2 + rsync
- [x] 2.3 确认 GitHub Secrets（SERVER_HOST、SERVER_SSH_KEY、SERVER_USER）已配置
