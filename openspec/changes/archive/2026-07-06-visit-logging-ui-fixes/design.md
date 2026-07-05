## Context

项目采用 JSON 文件存储数据（song_list.json），访问记录同样用 JSON 文件追加写入最合适，无需引入数据库。前端已使用 localStorage 做持久化，可存储设备 UUID 用于去重统计。UI 细节问题通过直接修复 React 组件状态管理解决。

## Goals / Non-Goals

**Goals:**
- 每日访问记录到 `visits.json`，包含 UUID、IP、UserAgent
- 前端生成持久化设备 ID，首次访问上报
- visits.json 加入每日备份
- 候选图片取消时恢复原始图片列表
- 详情页设置按钮始终显示
- 清空图片后自动关闭设置弹窗
- 静态资源 1 年强缓存
- 手机端 UUID 生成兼容非 HTTPS

**Non-Goals:**
- 不引入数据库或外部分析服务
- 不做实时统计面板（用户后台看 JSON 文件）

## Decisions

1. **JSON 文件追加** — 沿用项目现有数据存储模式，每个访问记录追加到 `visits.json`，结构简单，备份方便。
2. **`Math.random()` 替代 `crypto.randomUUID()`** — `crypto.randomUUID()` 在非 HTTPS 环境下不可用，手机端用户通过 HTTP 访问时会导致整个应用崩溃。使用 RFC4122 兼容的 `Math.random()` 方案替代。
3. **`useRef` 保存原始图片** — 自动获取前用 ref 保存当前 `selectedImages`，取消时恢复，避免状态快照问题。
4. **Nginx `immutable` 缓存** — Vite 构建产物文件名含 hash，`immutable` 标记告诉浏览器无需重新验证，直接使用缓存。

## Risks / Trade-offs

- **visits.json 无限增长** → 每条记录很小，按日备份 + 90 天清理，长期运行不会太大。若将来增长过快可加日志轮转或按日分文件。
- **Math.random() 不是真随机** → 用于生成客户端 UUID 足够，冲突概率极低。
- **`immutable` 缓存导致开发环境更新不生效** → 只作用于 nginx 生产环境，Vite 开发服务器不受影响。
