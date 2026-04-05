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
- **YAML 引用**：仅限在图像字段中引用 `asset_defs/` 下的 YAML（如 `asset_defs/chars/hero.yaml`）。CLI 自动提取该资产的 `tasks.image.latest.output`。
- **图片引用**：引用 `assets/images/` 下的物理图片。CLI 仅在当前字段内将其处理为 API 所需格式。
- **基准说明**：所有路径必须相对于 **项目根目录 (Project Root)**。
- **BLTAI 图片参考图上传**：当 `provider: bltai` 且 `params.image` 中的值被 CLI 解析为本地 `data:` 内容时，运行时会先调用 [bltai-file-upload.md](../docs/vendor-api/bltai-file-upload.md) 上传文件，再把返回的文件 URL 原样写回 `image[]` 后提交到图片生成接口。YAML 字段名不变，仍然只写 `image: [...]`。

### B. 参数名必须直传，不做跨字段映射
- YAML 中的字段名必须与供应商 API 文档一致。不要使用 CLI 自造别名。
- 文档索引见 [docs/vendor-api/README.md](../docs/vendor-api/README.md)。
- 当前允许 CLI 自动解析本地路径的字段只有：
  - 数组字段：`image`、`images`、`image_input`、`image_urls`、`reference_image_urls`
  - 单值字段：`image_url`、`first_frame_url`、`last_frame_url`
- 自动解析只发生在“同字段内”：
  - 本地图片路径 -> `data:` URL
  - `asset_defs/*.yaml` -> 该 YAML 的 `tasks.image.latest.output`
- CLI 不再做以下隐式重写：
  - `images` -> `image`
  - `images` -> `image_input`
  - `images` -> `image_urls`
  - `aspect_ratio` -> `image_size`

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
      model: "gemini-3.1-flash-image-preview"
      image:
        - asset_defs/chars/rebel-01.yaml      # CLI 自动解析
    latest:
      status: completed
      output: assets/images/s1.png             # 项目根目录相对路径
```

## 5. AIGC 参数示例

### A. BLTAI `gemini-3.1-flash-image-preview`
```yaml
tasks:
  image:
    provider: bltai
    params:
      model: gemini-3.1-flash-image-preview
      prompt: "A soldier pulls a battery."
      response_format: url
      aspect_ratio: "16:9"
      image:
        - asset_defs/chars/rebel-01.yaml
        - assets/images/reference.png
```

说明：上面两个 `image` 项如果最终被 CLI 解析成本地图片内容，BLTAI provider 会先上传文件，再把上传后返回的 URL 传给 `/v1/images/generations`。Agent 不需要在 YAML 里手写上传接口或中间字段。

### B. KIE `google/nano-banana`
```yaml
tasks:
  image:
    provider: kie
    params:
      model: google/nano-banana
      prompt: "A surreal banana spaceship."
      image_size: "1:1"
      output_format: png
```

### C. KIE `nano-banana-2`
```yaml
tasks:
  image:
    provider: kie
    params:
      model: nano-banana-2
      prompt: "A cinematic banana spaceship."
      aspect_ratio: "16:9"
      resolution: 2K
      output_format: jpg
      image_input:
        - assets/images/reference.png
```

### D. KIE `google/nano-banana-edit`
```yaml
tasks:
  image:
    provider: kie
    params:
      model: google/nano-banana-edit
      prompt: "Turn this into a toy figure."
      image_size: "1:1"
      output_format: png
      image_urls:
        - assets/images/source.png
```

### E. KIE `bytedance/seedance-2-fast`
```yaml
tasks:
  video:
    provider: kie
    params:
      model: bytedance/seedance-2-fast
      prompt: "The camera pushes in slowly."
      aspect_ratio: "16:9"
      resolution: 480p
      duration: 10
      reference_image_urls:
        - assets/images/reference-1.png
      first_frame_url: assets/images/first-frame.png
      last_frame_url: assets/images/last-frame.png
```
