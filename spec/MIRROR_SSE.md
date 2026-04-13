# Mangou Mirror & SSE Specification

WEB Server 是 Mangou 系统的实时“投影仪”。它通过监听文件变动 (Watcher) 和数据热推送 (SSE) 实现 UI 的无感刷新。

## 1. 实时监听 (File System Watcher)
WEB Server 启动时，必须通过 `fs.watch` 或 `chokidar` 递归监听 `<workspaceRoot>/projects/` 目录，而不是 `mangou/` 仓库内部目录。
- **监听目标**：`*.yaml`, `*.png`, `*.mp4`。
- **过滤规则**：忽略 `node_modules`, `.git`, `.agent_logs`。

## 2. 数据热推送 (SSE)
当文件系统发生变动时，WEB Server 必须通过 SSE 协议推送增量更新。

### 推送事件格式 (SSE Event)
- **Event Name**: `vfs`
- **Data Payload**:
```json
{
  "projectId": "demo",
  "type": "file_change",
  "path": "/storyboards/shot1.yaml",
  "content": "...",             // 更新后的 YAML 解析后的 JSON 对象
  "timestamp": 1712246400
}
```

## 3. 静态资源映射 (Static Proxy)
为了安全地在前端展示本地图片/视频，WEB Server 应提供如下 URL 映射：
- **请求格式**：`GET /api/vfs?projectId={id}&path={relative_path}`。
- **响应头**：必须包含正确的 `Content-Type`（如 `image/png`）和 `Cache-Control`（如 `max-age=3600`）。

## 4. UI 适配原则
- **前端本地缓存**：前端 React 应用应当维持一个内存 Store (如 Zustand)。
- **局部热更新**：前端接收到 SSE `file_change` 事件后，应只更新对应的分镜/资产卡片，而非全量刷新页面。
