# 任务追踪规范 (Tasks & Truth Source)

本文件说明了 `tasks.jsonl` 的数据库结构以及 Mangou 如何管理任务状态。

## 1. 唯一真相源 (Single Source of Truth)

在 Mangou 项目中，任务状态的**唯一真相源**是项目根目录下的 `tasks.jsonl` 文件。
- 地址: `projects/<id>/tasks.jsonl`
- 机制: 只追加写入 (Append-only)。对同一个任务 ID 进行多次写入时，最后一项记录代表其当前状态。

## 2. 记录结构 (JSONL Schema)

每行是一个完整的 JSON 对象，包含以下核心字段：

- `schemaVersion`: 结构版本，当前为 `1`。
- `id`: 本地生成的唯一任务 ID (UUID)。
- `kind`: 任务类型，如 `image`, `video`。
- `provider`: 使用的服务商，如 `blt`, `kie`。
- `status`: 当前执行状态。可选值: `pending`, `processing`, `success`, `failed`, `cancelled`。
- `input`: 提交给供应商的原始参数快照。
- `output`: 成功后的产物信息。
  - `files`: 产物在项目内的相对路径列表（首项通常为主产物）。
- `ref`: 关联信息。
  - `yamlPath`: 关联的 YAML 文件相对路径。
  - `taskType`: 关联 YAML 中的任务类型（如 `image`）。
- `error`: 失败信息。
  - `message`: 友好的错误提示。

## 3. 状态回填流程 (Projection)

为了方便 UI 展示和 Agent 读取，脚本在更新 `tasks.jsonl` 后会执行“投影”操作：
1. 提取任务的最新的产物路径和状态。
2. 将该信息写入关联 YAML 文件的 `tasks.<type>.latest` 字段中。
3. 如果回填失败，不会影响 `tasks.jsonl` 的可靠性。

## 4. Agent 执行建议

- **失败诊断**: 当 `agent-generate` 报错时，Agent 应检查 YAML 中的 `latest.error` 或 `tasks.jsonl` 的末尾记录，以判断是 API 密钥失效、Prompt 违规还是网络超时。
- **防止重复**: 脚本具备一定的断点续传能力。如果 YAML 中已有处理中的 `task_id`，Agent 再次调用生成时脚本会尝试轮询而非重新提交。
