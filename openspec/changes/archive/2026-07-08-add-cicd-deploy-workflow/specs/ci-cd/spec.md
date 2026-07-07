## ADDED Requirements

### Requirement: 自动部署流水线
GitHub Actions push 到 main 后自动触发部署流水线，包含构建验证、代码同步、Docker 容器更新三步。

#### Scenario: push 到 main 触发部署
- **WHEN** 开发者 push 到 `main` 分支
- **THEN** GitHub Actions 自动启动 `Deploy` workflow

#### Scenario: 前端构建失败则中止
- **WHEN** `npm run build` 执行失败
- **THEN** 后续步骤跳过，部署不执行

#### Scenario: 代码同步到服务器
- **WHEN** 构建检查通过
- **THEN** 通过 rsync 增量同步代码到服务器 `/app/guitar-tabs/`，排除 `.git`、`node_modules`、`server/data`、`server/images`、`server/backups`、`dist`

#### Scenario: Docker 容器重建并重启
- **WHEN** 代码同步完成
- **THEN** 服务器执行 `docker compose up --build -d` 重建镜像并重启服务

#### Scenario: 手动触发
- **WHEN** 开发者进入 GitHub Actions 页面手动点击 "Run workflow"
- **THEN** 执行完整的部署流水线

### Requirement: Secrets 配置
工作流使用 GitHub Secrets 连接服务器，不在代码中暴露凭证。

#### Scenario: SSH 连接凭据
- **WHEN** 工作流需要连接服务器
- **THEN** 使用 `SERVER_HOST`、`SERVER_USER`、`SERVER_SSH_KEY` 三个 Secrets 进行 SSH 认证

### Requirement: 增量同步
rsync 只同步变更过的文件，跳过无关目录减少传输量。

#### Scenario: 排除无关文件
- **WHEN** rsync 执行同步
- **THEN** `.git`、`node_modules`、`server/node_modules`、`server/data`、`server/images`、`server/backups`、`dist` 被排除
