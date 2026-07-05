## 1. DeepSeek API 代理迁移

- [x] 1.1 后端新增 `/guitar-api/ai-search` 代理端点
- [x] 1.2 安装 dotenv 依赖，配置从父目录 `.env` 加载
- [x] 1.3 替换 `.env` 中 `VITE_DEEPSEEK_KEY` 为 `DEEPSEEK_KEY`
- [x] 1.4 docker-compose 添加 backend 环境变量
- [x] 1.5 前端移除 `DEEPSEEK_KEY` 常量，改为调用后端代理

## 2. AI 搜索优化

- [x] 2.1 添加 AbortController 支持，新请求自动取消上一次请求
- [x] 2.2 禁用 DeepSeek 思考模式（`thinking: { type: "disabled" }`）
- [x] 2.3 移除 `reasoning_effort` 参数

## 3. 自动获取吉他谱增强

- [x] 3.1 搜索数从 3 增至 5，总超时调整为 30 秒
- [x] 3.2 添加 Referer、Accept、Accept-Language 反爬 headers
- [x] 3.3 尝试间隔 1 秒，增加 server log
- [x] 3.4 返回每个尝试的 URL 和具体错误（details 数组）
- [x] 3.5 前端展示详细错误列表
