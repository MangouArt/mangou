# Mangou Audit Log (Operation Log)

为了提供任务防重 (Deduplication) 和操作审计 (Traceability)，Mangou 维护一个追加式的全局日志文件。

## 1. 存储位置
- **路径**：`projects/{project_id}/tasks.jsonl`
- **格式**：JSONL (JSON Lines)

## 2. 日志结构 (JSONL Row)
每一行记录一个任务的状态变更：
```json
{
  "id": "sha1_hash",            // 任务唯一指纹 (type + input + params)
  "type": "image_generate",
  "status": "completed",        // pending, success, failed
  "target": "/storyboards/shot1.yaml",
  "output": "./assets/images/shot1.png",
  "error": null,
  "timestamp": 1712246400
}
```

## 3. 防重机制 (Deduplication)
- **行为**：CLI 在启动前应扫描 `tasks.jsonl`。
- **原则**：如果发现已存在具有相同 ID 且状态为 `success` 的任务，且本地文件依然存在，则应跳过生成，直接将旧结果回写 YAML。

## 4. 并发锁 (File Locking)
- **机制**：由于多个 CLI 进程可能同时写入日志，必须使用 `tasks.jsonl.lock` 文件锁保护写操作，确保日志行的完整性。
