## Context

App 目前仅有浅色模式，缺少全局设置入口。部分交互细节（搜索空状态、重复歌曲处理、歌名编辑）不够完善。详情页设置弹窗功能较多，需要精简。主题配置集中在 App.jsx 的 ConfigProvider 中，导致路由页面刷新时无法继承主题。

## Goals / Non-Goals

**Goals:**
- 深色模式支持（浅色/深色/跟随系统），CSS 变量驱动，Ant Design 组件通过 ConfigProvider 适配
- 全局设置弹窗，统一管理用户偏好（惯性滑步、主题），localStorage 持久化
- 交互优化：搜索空状态快捷新增、重复歌曲检测跳转、歌名编辑
- 详情页弹窗精简、移动端适配
- 主题配置提升到 main.jsx，所有路由共享

**Non-Goals:**
- 不修改后端接口（PUT 重命名接口已存在）
- 不涉及用户系统或权限管理
- 不做 SSR 或服务端渲染适配

## Decisions

- **主题管理**: ConfigProvider 从 App.jsx 提升到 main.jsx，使用 polling + storage 事件同步 App.jsx 的修改。避免引入全局状态库。
- **CSS 方案**: 使用 `html[data-theme="dark"]` 属性选择器 + CSS 变量，无额外依赖。Ant Design 组件通过 `theme.darkAlgorithm` 处理。
- **图片反色**: `filter: invert(1) hue-rotate(180deg) grayscale(1)`，白底黑字的谱子在深色下变成黑底白字。CSS 滤镜，无运行时开销。
- **弹窗滚动**: `styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' } }}`，Ant Design v5 的 styles API，无需额外组件。
- **重名检测**: 前端先检查本地 songs 数组，命中则弹确认框跳转，避免无效 API 调用。
- **padding 方案**: 用 react-zoom-pan-pinch 的 contentStyle 替代 CSS padding-top，使 padding 属于变换内容的一部分。

## Risks / Trade-offs

- main.jsx 轮询（500ms）同步主题 → 切换主题时有短暂延迟，但仅影响首次修改后的 ConfigProvider 刷新，体验可接受
- `!important` 覆盖 inline 样式 → 仅用于深色模式，不影响浅色模式正常渲染
- 图片滤镜 `grayscale(1)` → 谱子变成纯黑白，丢失原图的颜色信息。对于吉他谱（白底黑线）无影响，但对于彩色标注的谱子会丢失颜色
