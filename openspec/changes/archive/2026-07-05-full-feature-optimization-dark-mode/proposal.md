## Why

App 缺少深色模式和全局设置入口，部分交互（搜索空状态、重复歌曲、歌名编辑）不够顺手，详情页弹窗功能冗余，需要进行一系列体验优化。

## What Changes

- 新增全局设置弹窗（首页右上角齿轮），包含惯性滑步开关和主题模式切换
- 新增深色模式，支持浅色 / 深色 / 跟随系统三种模式，Ant Design 组件和自定义样式全适配
- 深色模式下谱子图片自动反色去色（invert + grayscale），保证可读性
- 搜索无结果时增加"新增「xxx」"快捷按钮
- 新增歌曲时检测重名，弹出确认框询问是否跳转到已有歌曲
- 详情页设置弹窗新增编辑歌名功能，调用后端 PUT 接口重命名
- 详情页设置弹窗移除"解析其他URL"和"上传图片"两个冗余功能
- 详情页弹窗 body 支持移动端滚动（maxHeight + overflowY）
- 首页底部添加免责声明
- 首页歌曲爱心图标和小绿点位置大小统一
- 详情页移除 CSS padding-top，改为 react-zoom-pan-pinch contentStyle 控制
- 将 ConfigProvider 主题配置从 App.jsx 提升到 main.jsx，修复刷新时深色模式丢失的问题

## Capabilities

### New Capabilities
- `dark-mode`: 深色模式，支持浅色/深色/跟随系统，CSS 变量驱动 Ant Design + 自定义样式
- `global-settings`: 全局设置弹窗，惯性滑步开关、主题切换，localStorage 持久化
- `song-management`: 歌名编辑、重复检测跳转、搜索空状态快捷新增

### Modified Capabilities
- （无 spec 级别的行为变更，均为 UI/交互优化）

## Impact

- **main.jsx**: 新增 Root 组件管理主题状态，ConfigProvider 移至此处
- **App.jsx**: 移除自己的 ConfigProvider，新增全局设置弹窗、主题切换、免责声明、搜索空状态按钮、重复歌曲检测
- **TabsPage.jsx**: 新增编辑歌名功能，移除冗余的解析URL和上传功能，弹窗支持滚动，contentStyle 替代 CSS padding-top
- **App.css**: 新增深色模式 CSS 变量体系（~120 行），统一绿点样式
- **SongItem.jsx**: 调整爱心图标大小位置
- **server/server.js**: 无需修改（PUT /guitar-api/songs/:old_name 已存在）
