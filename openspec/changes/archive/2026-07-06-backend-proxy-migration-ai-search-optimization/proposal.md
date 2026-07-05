## Why

DeepSeek API Key 暴露在前端 Vite 环境变量中不安全，需要迁移到后端。同时 AI 搜索体验有待优化：多个请求并发时结果互相覆盖、思考模式增加延迟、自动获取吉他谱经常因反爬失败且错误信息不透明。

## What Changes

- **DeepSeek API 代理迁移**：新增后端 `/guitar-api/ai-search` 端点，前端通过后端代理调用 DeepSeek，API Key 仅存在于服务器端
- **AI 搜索请求取消**：新请求触发时自动用 AbortController 取消上一次 in-flight 请求，避免结果覆盖
- **禁用 DeepSeek 思考模式**：设置 `thinking: { type: "disabled" }`，减少响应延迟
- **自动获取吉他谱增强**：搜索数从 3 增至 5，添加 Referer 反爬头，尝试间隔 1 秒，返回每个 URL 的详细错误信息
- **深色模式适配**：AI 搜索组件、错误提示、详情页等多处 UI 的深色模式 CSS 适配
- **搜索 UI 升级**：蓝紫渐变 AI 搜索框、AI 状态下拉提示、搜索空状态新增按钮、Logo 图片替换文字标题

## Capabilities

### New Capabilities

- `ai-search-proxy`: DeepSeek API 后端代理，提供 `/guitar-api/ai-search` 端点，安全封装 API Key
- `auto-fetch-improved`: 自动获取吉他谱增强，支持多结果轮询、反爬头、详细错误反馈

### Modified Capabilities

<!-- No existing specs to modify -->

## Impact

- **后端** (`server/server.js`)：新增 ai-search 路由，增强 parseImagesFromUrl 和 auto-fetch 逻辑，新增 dotenv 依赖
- **前端** (`src/App.jsx`)：移除 DEEPSEEK_KEY 常量，AI 搜索改为调用后端代理，添加 AbortController
- **前端** (`src/TabsPage.jsx`)：增强自动获取错误展示，显示每个尝试 URL 及原因
- **前端** (`src/App.css`)：大量深色模式 CSS、AI 搜索框渐变样式
- **配置** (`.env`)：`VITE_DEEPSEEK_KEY` 改为 `DEEPSEEK_KEY`
- **部署** (`docker-compose.yml`)：backend 服务添加 `DEEPSEEK_KEY` 环境变量
