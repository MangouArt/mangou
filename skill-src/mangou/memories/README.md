# Mangou 记忆模块 (Memory Module)

## 设计哲学
记忆模块用于沉淀用户在 AI 漫剧调教过程中的最佳实践、风格约束和特定资产的认知。它将“一次性的成功”转化为“永久性的项目知识”。

## 目录结构
- **规范端** (`skill-src/mangou/memories/`)：定义如何记录和检索记忆。
- **数据端** (`workspace/.mangou/memories/`)：存储用户在该工作区产出的所有记忆条目 (`*.md`)。

## 检索逻辑 (Agent 必备)
1. **自动对齐**：在执行任何任务前，Agent 必须读取 `workspace/.mangou/memories/`。
2. **场景匹配**：根据文档中的 `Scope` 标签判断是否适用于当前任务。
3. **最近优先**：如果多条记录冲突，以 `Date` 最新或文件修改时间最近的为准。

## 创建记忆
- **自动触发**：任务完成后，Agent 会提议“沉淀记忆”。
- **手动编辑**：参照 `TEMPLATE.md` 在 `workspace/.mangou/memories/` 下创建 Markdown 文件。
