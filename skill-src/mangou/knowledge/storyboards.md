# 故事分镜 YAML 规范 (Storyboard Specification)

本文件定义了 `storyboards/*.yaml` 的结构与业务规则。

## 1. 结构概览

每个 YAML 文件应当描述一个单一的分镜对象。核心结构包含以下四个根字段：

- `meta`: 元数据（ID、版本等）。
- `content`: 分镜表现层内容（剧情、动作、场景、时长等）。
- `tasks`: AIGC 任务定义与状态缓存。
- `refs`: 参考资料（仅用于展示）。

### 1.1 meta
- `id` (必需): 分镜的唯一物理标识，通常与文件名一致。
- `version` (必需): 规范版本，当前建议为 `"1.0"`。

### 1.2 content
- `sequence` (必需): 在剧本中的序号。
- `title` (必需): 该分镜的简要标题。
- `story` (必需): 关联的剧情原文。
- `action` (必需): 画面动作描述，常作为 AIGC Prompt 的核心。
- `scene` (必需): 场景说明。
- `duration` (必需): 建议时长，如 `"4s"`。
- `characters`: 参与角色的 ID 列表。

### 1.3 tasks
包含以任务类型为 key 的配置，如 `image` 或 `video`。
每个任务必须包含：
- `provider`: 可选。显式指定服务商（如 `bltai`, `kie`）。
- `params`: AIGC 核心参数。
  - `model`: 模型名（特定 Provider 必需）。
  - `prompt`: 提示词。
  - `images`: 参考图列表（本地相对路径）。
- `latest`: 任务状态投影（由 `tasks.jsonl` 回填）。

## 2. 业务规则

1. **真相源唯一性**: 任务执行的最终状态记录在 `projects/<id>/tasks.jsonl` 中。YAML 中的 `latest` 字段仅作为 UI 展示的缓存，若丢失可从 `.jsonl` 重建。
2. **路径一致性**: `params.images` 必须使用相对于 **项目根目录** 的相对路径。脚本在执行时会自动将其转换为 Data URL。
3. **分镜接龙**: 编写连续分镜时，推荐将前序分镜的产物路径（如 `assets/images/s1.png`）放入后续分镜的 `params.images` 中，以实现视觉连贯。
4. **回填逻辑**: 生成脚本在完成任务后，会将产物路径（相对路径）和状态回填至 YAML 的 `latest` 字段中。

## 3. 完整示例

```yaml
meta:
  id: "s1"
  version: "1.0"
content:
  sequence: 1
  title: "初见"
  story: "在繁忙的车站，两人擦肩而过。"
  action: "特写镜头，微风吹动发丝，眼神交错。"
  scene: "火车站站台，夕阳余晖。"
  duration: "4s"
tasks:
  image:
    provider: "bltai"
    params:
      model: "nano-banana-2"
      prompt: "Cinematic close shot, a girl looking back at a boy on a train platform during sunset."
      aspect_ratio: "16:9"
    latest:
      status: "completed"
      output: "assets/images/s1-8821a.png"
```
