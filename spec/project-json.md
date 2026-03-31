# project.json 规范（初版）

## 定义
- `project.json` 描述单个项目的基本信息。
- 文件位于 `projects/<projectId>/project.json`。

## 结构
必需字段：
- `schemaVersion`：版本号，当前建议为 `1`。
- `id`：项目标识，建议与目录名一致。
- `name`：项目名称。
- `description`：项目描述。

可选字段：
- `tags`：字符串数组。
- `createdAt`：ISO 8601。
- `updatedAt`：ISO 8601。
- `workspaceVersion`：工作区模板版本。
- `meta`：扩展字段。

## 示例
```json
{
  "schemaVersion": 1,
  "id": "demo",
  "name": "Demo Project",
  "description": "Auto-generated sample"
}
```
