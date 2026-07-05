## Context

当前系统前端直接调用 DeepSeek API，API Key 通过 Vite 环境变量 `VITE_DEEPSEEK_KEY` 暴露在客户端。后端 Express 服务已具备 axios 依赖和代理模式（proxy-image），适合承载 AI 代理。AI 搜索存在多个请求并发覆盖结果的问题，自动获取吉他谱因目标网站反爬频繁 403 且用户无感知具体失败原因。

## Goals / Non-Goals

**Goals:**
- DeepSeek API Key 仅存在于后端服务器，前端不接触
- AI 搜索请求可取消，新请求自动中断旧请求
- 禁用 AI 思考模式，减少响应延迟
- 自动获取吉他谱最多尝试 5 个搜索结果，显示详细错误
- 自动获取时添加反爬 headers 减少 403

**Non-Goals:**
- 不引入 Redis 或数据库缓存
- 不改变前端 AI 搜索交互方式（仍实时输入触发）
- 不引入 WebSocket 或 SSE 流式响应

## Decisions

1. **后端代理而非独立微服务** — 直接在 Express 中添加路由，复用现有 axios 依赖和服务器基础设施。避免引入新的部署单元。

2. **AbortController 而非状态锁** — 前端 useEffect cleanup 中 abort 上一次请求，比用 loading flag 做并发控制更可靠，不会出现竞态条件。

3. **请求间隔 1 秒 + Referer 头** — 自动获取时在每次尝试之间延迟 1 秒，模拟人类浏览行为，降低被目标网站 rate-limit 的概率。`parseImagesFromUrl` 添加 `Referer` 和 `Accept-Language` 头解决部分站点 403。

4. **dotenv 加载父目录 `.env`** — 后端通过 `require('dotenv').config({ path: '../.env' })` 读取项目根目录的 `.env` 文件，开发环境和 Docker 部署均可使用同一份配置。

## Risks / Trade-offs

- **dotenv 路径依赖** → 后端从 `server/` 目录加载 `../.env`，如果启动目录变化可能路径失效。Docker 部署已通过 docker-compose environment 独立配置，不受影响。
- **自动获取仍可能全部 403** → 反爬是猫鼠游戏，Referer 头不能保证成功。前端已展示详细错误列表让用户手动选择其他方式（去 Bing 搜索、本地上传）。
- **1 秒间隔增加总耗时** → 5 个结果全失败最多需要 5s + 4x1s = 9s，加上 30 秒总超时保护，不会无限等待。
