## Why

每次手动 SSH 到服务器拉代码、重建容器太繁琐，且容易漏步骤。需要一个自动化流程，push 到 main 后自动构建、同步并部署。

## What Changes

- 新增 `.github/workflows/deploy.yml` GitHub Actions 工作流
- push 到 `main` 自动触发：构建检查 → rsync 同步代码到服务器 → docker compose 重建并重启容器
- 支持手动触发（`workflow_dispatch`）
- 工作流使用已有的 GitHub Secrets（`SERVER_HOST`、`SERVER_SSH_KEY`、`SERVER_USER`）

## Capabilities

### New Capabilities
- `ci-cd`: GitHub Actions 自动部署流水线，覆盖构建验证、代码同步、Docker 容器更新

### Modified Capabilities

- （无）

## Impact

- 新增文件：`.github/workflows/deploy.yml`
- 新增依赖：服务器需预装 Docker Engine + docker compose v2 插件 + rsync
- 无后端/前端代码变更
