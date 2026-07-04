## 1. 后端：自动获取重试机制

- [x] 1.1 将 `searchBingFirstResult` 替换为 `searchBingResults`，返回最多 3 个 Bing 搜索结果 URL
- [x] 1.2 更新 `POST /auto-fetch` 端点，用 `for` 循环依次尝试每个 URL
- [x] 1.3 每个尝试用 `Promise.race` 实现 5 秒超时，超时自动跳下一个
- [x] 1.4 循环顶部增加总超时 15 秒检查，超时则中断返回失败

## 2. 前端：无图页面不自动获取

- [x] 2.1 移除 `useEffect` 中无图时调用 `handleAutoFetch()` 的逻辑
- [x] 2.2 验证空状态 UI（🎸 + 提示 + 按钮组）正确展示

## 3. 前端：顶部工具栏固定

- [x] 3.1 `.floating-bar` CSS 改为 `position: fixed; top: 0; left: 0; right: 0; z-index: 1000`
- [x] 3.2 `.ant-card-body` 增加 `padding-top: 48px`，移除 `position: relative`
- [x] 3.3 移除子元素中冗余的 inline `paddingTop`（空状态的 52px、图片网格的 50px）

## 4. 前端：图片不满列时居中

- [x] 4.1 `.tabs-grid` CSS 改为 `display: flex; flex-wrap: wrap; justify-content: center`
- [x] 4.2 每个 `<img>` 添加 inline style 计算宽度：`calc((100% - (N-1) * 8px) / N)`
- [x] 4.3 验证满列时效果与 grid 一致，不满列时居中
