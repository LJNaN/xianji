## Context

当前详情页在无图片时自动触发 Bing 搜索，无论成功与否页面布局都不理想：自动搜索不能取消、失败后提示信息混杂在按钮区域、顶部工具栏随图片滚动而滚动、图片网格在不满列时靠左对齐。这些问题影响核心浏览体验。

## Goals / Non-Goals

**Goals:**
- 无图页面进入时不自动请求，展示干净的空状态引导用户操作
- 自动获取增加重试和超时保护，避免单点故障卡死
- 顶部工具栏固定不随内容滚动，始终可操作
- 图片列表不满列时居中显示，视觉更平衡

**Non-Goals:**
- 不改变图片查看器的缩放/拖拽行为
- 不改变歌单首页的布局
- 不改变后端数据存储结构
- 不引入新的 UI 组件库

## Decisions

### 1. 后端重试逻辑：服务端串行 + Promise.race 超时
- 在 `POST /auto-fetch` 端点内用 `for` 循环依次尝试每个搜索结果
- 每个结果用 `Promise.race([parseImagesFromUrl(url), timeoutPromise(5000)])` 实现 5s 超时
- 总超时 15s 在循环顶部用 `Date.now() - startTime` 检查
- **为什么不是客户端做重试？** 避免客户端多次请求带来的网络开销和状态管理复杂度，且超时时间不受网络环境波动影响

### 2. 前端空状态：移除自动调用，保持现有 UI
- 直接删除 `useEffect` 中 `handleAutoFetch()` 的调用
- 保留已有的空状态 JSX（🎸 图标 + 提示文字 + 按钮组），这些在之前已经实现
- 按钮包括：自动获取、去 Bing 搜索、本地上传、URL 输入提取

### 3. 顶部工具栏：absolute → fixed
- `.floating-bar` 从 `position: absolute` 改为 `position: fixed; top: 0; left: 0; right: 0; z-index: 1000`
- `.ant-card-body` 增加 `padding-top: 48px` 补偿固定栏高度
- 移除 `.detail-card .ant-card-body` 的 `position: relative`（不再需要作为 absolute 定位参考）

### 4. 图片网格：Grid → Flexbox + justify-content: center
- `.tabs-grid` 从 `display: grid; gap: 8px` 改为 `display: flex; flex-wrap: wrap; gap: 8px; justify-content: center`
- 每个 `<img>` 用 inline style 设置 `width` 和 `flex: 0 0 calc((100% - (N-1) * 8px) / N)`，其中 N = 列数
- 满列时效果与 grid 一致，不满列时由 `justify-content: center` 居中

## Risks / Trade-offs

- [Promise.race 不取消] → 超时后 parseImagesFromUrl 仍在后台运行，但结果会被丢弃。不影响功能，只浪费少量带宽
- [flex 布局缩放行为与 grid 略有差异] → 在使用 react-zoom-pan-pinch 缩放时，flex 包裹行为不变，TransformWrapper 控制整体变换
- [justify-content: center 导致末行居中] → 对吉他谱浏览（看谱）场景来说居中比靠左更自然，特意如此
