## 1. 访问记录系统

- [x] 1.1 后端新增 `/guitar-api/visit` 端点
- [x] 1.2 前端生成持久化 UUID，首次访问上报设备信息
- [x] 1.3 `crypto.randomUUID()` 替换为 `Math.random()` 方案

## 2. 备份与缓存

- [x] 2.1 visits.json 加入每日备份脚本
- [x] 2.2 docker-compose 添加 visits.json 挂载
- [x] 2.3 Nginx 静态资源缓存配置

## 3. UI 细节修复

- [x] 3.1 候选图片取消时恢复原始图片列表
- [x] 3.2 详情页设置按钮始终显示
- [x] 3.3 清空图片后自动关闭设置弹窗
- [x] 3.4 song-grid flex 布局 align-items 修复
