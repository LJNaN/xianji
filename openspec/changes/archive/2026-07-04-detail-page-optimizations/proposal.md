## Why

详情页在无吉他谱图片时的体验不佳：进入页面自动触发网络请求、失败后布局混乱、顶部工具栏跟随内容滚动、图片不满列时靠左不美观。需要优化这些细节以提升用户体验。

## What Changes

1. **无图页面不自动获取**：进入详情页时若歌曲没有图片，不再自动调用后端搜索，改为显示空状态提示 + 操作按钮，由用户手动触发
2. **自动获取增加重试机制**：自动搜索时，获取 Bing 前 3 个搜索结果，依次尝试提取图片，每个结果 5 秒超时，总超时 15 秒
3. **顶部工具栏 fixed 固定**：浮动操作栏（返回按钮、歌名、收藏、设置）改为 `position: fixed`，不随内容滚动
4. **图片列表不满列时居中**：图片网格从 CSS Grid 改为 Flexbox + `justify-content: center`，当图片数少于列数时居中显示

## Capabilities

### New Capabilities

- `detail-empty-state`: 详情页无图片时的空状态展示与手动操作流程
- `auto-fetch-retry`: 自动搜索吉他谱的重试与超时机制

### Modified Capabilities

<!-- No existing spec-level capabilities are changing -->

## Impact

- `server/server.js`: `searchBingFirstResult` 替换为 `searchBingResults`（返回多结果）；auto-fetch API 增加重试循环
- `src/TabsPage.jsx`: 移除 mount 时的自动调用；图片列表渲染从 grid 改为 flex
- `src/App.css`: `.floating-bar` 从 `absolute` 改为 `fixed`；`.tabs-grid` 从 grid 改为 flex
