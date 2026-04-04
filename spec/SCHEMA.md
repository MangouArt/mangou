# Mangou Data Schema (The YAML Contract)

YAML 文件是系统的唯一“真理源”，承载了 Agent 的创意意图与 CLI 的执行结果。

## 1. 核心模块职责划分
| 模块 | 核心字段 | 读写权限 | 职责说明 |
| :--- | :--- | :--- | :--- |
| **meta** | id, type, parent, grid_index | Agent (写), CLI (读) | 定义唯一标识与物理层级关系 |
| **content** | title, story, action, scene | Agent (全权) | 剧本与创意描述 (WEB 展示核心) |
| **refs** | characters, scenes, props | Agent (全权) | **仅限 UI 展示**：建立资产关联视图。**必须使用相对于项目根目录的 YAML 路径**。 |
| **tasks** | image, video, split, stitch | CLI (写), Agent (读) | **执行核心**：包含 API 参数、引用解析与结果回填 |

## 2. 引用与解析逻辑 (CLI Runtime)
CLI 在执行任务时，**仅关注 `tasks.[type].params` 模块**。

### A. 引用解析 (Reference Resolving)
- **输入源**：`tasks.params.images` (列表) 或其他 Provider 定义的输入字段。
- **解析逻辑**：
  1. **YAML 路径引用**：若值为以 `.yaml` 结尾的路径（如 `asset_defs/chars/rebel-01.yaml`），CLI 自动读取该文件，提取其 `tasks.image.latest.output` 指向的物理图片。
  2. **图片路径引用**：若值为图片路径（如 `assets/images/xxx.png`），CLI 自动将其编码为 **Base64 (DataURL)**。

### B. UI 关联 (UI Linking)
- **输入源**：`refs.characters`, `refs.scenes`, `refs.props`。
- **约束**：必须填入对应的 YAML 路径。WEB Server 解析这些路径用于在前端显示资产关联。

## 3. 任务回填规范 (Backfill)
CLI 在任务完成后，必须回填以下字段：
- **`status`**: `completed` | `failed` | `running`
- **`output`**: 生成媒体的**本地相对路径**。
- **`task_id`**: 原始任务 ID。
- **`updated_at`**: ISO 8601 时间戳。

## 4. 示例：路径引用的 YAML
```yaml
meta:
  id: s1
  type: storyboard
content:
  title: "拔除电池"
refs:
  characters: [asset_defs/chars/rebel-01.yaml] # UI 显示关联的角色
tasks:
  image:
    provider: bltai
    params:
      prompt: "A soldier pulls a battery."
      images: 
        - asset_defs/chars/rebel-01.yaml      # CLI 在这里解析该 YAML 关联的图片
        - assets/images/bg.png                 # CLI 在这里处理本地背景图
    latest:
      status: completed
      output: assets/images/s1.png
```
