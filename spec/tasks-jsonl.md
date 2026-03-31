# tasks.jsonl 规范（初版）

## 定义
- `tasks.jsonl` 为项目级任务状态数据库。
- 文件位于 `projects/<projectId>/tasks.jsonl`。
- 只追加写入（append-only），同一 `id` 以最后一条为准。

## 角色定位
- `tasks.jsonl` 是任务状态唯一真相源。
- `storyboards/*.yaml` 与 `asset_defs/*.yaml` 中的 `latest` 只是展示投影。
- 所有写入必须经由脚本或 Web Server 的本地 HTTP API 完成。

## 任务结构
必需字段：
- `schemaVersion`：版本号，当前为 `1`。
- `id`：本地任务 ID，使用 `uuid`。
- `kind`：任务类型，例如 `image|video|audio|custom`。
- `provider`：供应商或执行来源，如 `blt|iflow|custom`。
- `status`：`pending|processing|success|failed|cancelled`。
- `input`：任务输入。
- `ref.yamlPath`：关联 YAML 文件路径，相对项目根目录。
- `createdAt`：ISO 8601。
- `updatedAt`：ISO 8601。

可选字段：
- `upstreamTaskId`：上游任务 ID。
- `output.files`：相对项目根目录的产物路径列表。
- `output.urls`：上游返回的 URL 列表。
- `output.meta`：输出扩展信息。
- `ref.taskType`：关联 YAML 中的任务类型，如 `image`、`video`。
- `error.message`：失败原因。
- `error.code`
- `error.detail`

## 示例
```json
{
  "schemaVersion": 1,
  "id": "4c5a9d4b-8a2c-4bd0-9fd2-2d0bc9b4701a",
  "kind": "image",
  "provider": "blt",
  "upstreamTaskId": "img_123",
  "status": "processing",
  "input": {
    "prompt": "a girl in the forest",
    "aspect_ratio": "16:9"
  },
  "ref": {
    "yamlPath": "storyboards/scene-001.yaml",
    "taskType": "image"
  },
  "createdAt": "2025-01-01T00:00:00Z",
  "updatedAt": "2025-01-01T00:00:10Z"
}
```

## 行为规则
- 每次创建或更新任务，都向 `tasks.jsonl` 追加一条完整快照。
- 读取时按 `id` 聚合，最后一条视为最新状态。
- 不使用输入 hash 去重。
- 文件锁与并发控制由脚本或 Web Server 统一处理。
