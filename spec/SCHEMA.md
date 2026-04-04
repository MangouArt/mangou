# Mangou Data Schema (The YAML Contract)

YAML 文件是系统的唯一“真理源”。它由四个核心模块组成，读写权限严格划分。

## 1. 核心模块职责划分
| 模块 | 核心字段 | 读写权限 | 职责说明 |
| :--- | :--- | :--- | :--- |
| **meta** | id, type, parent, grid_index | Agent (写), CLI (读) | 定义唯一标识与物理层级关系。**严禁包含 status**。 |
| **content** | title, story, action, scene | Agent (全权) | 剧本与创意描述。 |
| **refs** | characters, scenes, props | Agent (全权) | **仅限 Storyboard 使用**：用于建立资产关联视图。**必须使用项目根目录相对路径**。 |
| **tasks** | image, video, split, stitch | CLI (写), Agent (读) | **状态中心**：包含执行参数与回填结果（status, output, task_id）。 |

## 2. 引用与解析逻辑 (CLI Runtime)
CLI 仅关注 `tasks.[type].params` 模块。

### A. 路径引用的解析
- **YAML 引用**：仅限 `storyboard` 引用 `asset_defs/` 下的 YAML（如 `asset_defs/chars/hero.yaml`）。CLI 自动提取该资产的 `tasks.image.latest.output`。
- **图片引用**：引用 `assets/images/` 下的物理图片。CLI 自动将其处理为 API 所需格式。
- **基准说明**：所有路径必须相对于 **项目根目录 (Project Root)**。

## 3. 任务状态规范 (Task Status)
任务状态必须严格维护在 `tasks.[type].latest` 路径下：
- **`status`**: `pending` | `running` | `completed` | `failed`
- **`output`**: 产物的项目根目录相对路径。
- **`updated_at`**: 任务完成时间戳。

## 4. 示例：Storyboard YAML
```yaml
meta:
  id: s1
  type: storyboard
content:
  title: "拔除电池"
refs:
  characters: [asset_defs/chars/rebel-01.yaml] # 显式路径引用
tasks:
  image:
    provider: bltai
    params:
      prompt: "A soldier pulls a battery."
      images: 
        - asset_defs/chars/rebel-01.yaml      # CLI 自动解析
    latest:
      status: completed
      output: assets/images/s1.png             # 项目根目录相对路径
```
