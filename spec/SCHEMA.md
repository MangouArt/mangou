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

默认约定：
- `tasks.image.provider` 与 `tasks.video.provider` 都必须显式写出；脚本不会自动推断或补默认值。
- skill 侧仅给出推荐：图片优先 `bltai`，视频优先 `evolink`。

### A. 路径引用的解析
- **YAML 引用**：仅限在图像字段中引用 `asset_defs/` 下的 YAML（如 `asset_defs/chars/hero.yaml`）。CLI 自动提取该资产的 `tasks.image.latest.output`。
- **图片引用**：引用 `assets/images/` 下的物理图片。CLI 仅在当前字段内将其处理为 API 所需格式。
- **基准说明**：所有路径必须相对于 **项目根目录 (Project Root)**。
- **BLTAI 图片参考图上传**：当 `provider: bltai` 且 `params.image` 中的值被 CLI 解析为本地 `data:` 内容时，运行时会先调用 [bltai-file-upload.md](../docs/vendor-api/bltai-file-upload.md) 上传文件，再把返回的文件 URL 原样写回 `image[]` 后提交到图片生成接口。YAML 字段名不变，仍然只写 `image: [...]`。

### B. 参数名必须直传，不做跨字段映射
- YAML 中的字段名必须与供应商 API 文档一致。不要使用 CLI 自造别名。
- 文档索引见 [docs/vendor-api/README.md](../docs/vendor-api/README.md)。
- 当前允许 CLI 自动解析本地路径的字段只有：
  - 数组字段：`image`、`images`、`image_urls`
  - 单值字段：`image_url`
- 自动解析只发生在“同字段内”：
  - 本地图片路径 -> `data:` URL
  - `asset_defs/*.yaml` -> 该 YAML 的 `tasks.image.latest.output`
- 注意：字段“会被 runtime 解析”不等于“对应 provider 一定直接接受 `data:` URL”。例如 `EvoLink seedance-2.0-fast-reference-to-video` 的 `image_urls` 虽然可以先写本地图片，但 provider 会先上传成远程 URL 再提交；`video_urls` / `audio_urls` 则仍然不会自动上传。
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

### B. EvoLink `seedance-2.0-*`
```yaml
tasks:
  video:
    provider: evolink
    params:
      model: seedance-2.0-fast-reference-to-video
      prompt: "Use image 1 as identity reference, use video 1 for handheld camera motion, and use audio 1 as background music."
      image_urls:
        - https://example.com/character.png
      video_urls:
        - https://example.com/motion.mp4
      audio_urls:
        - https://example.com/bgm.mp3
      duration: 8
      quality: 720p
      aspect_ratio: "16:9"
      generate_audio: true
```

说明：
- `seedance-2.0-text-to-video` / `seedance-2.0-fast-text-to-video` 不接受 `image_urls` / `video_urls` / `audio_urls`，只接受 `prompt`，并可选 `model_params.web_search`。
- `seedance-2.0-image-to-video` / `seedance-2.0-fast-image-to-video` 必须提供 `1-2` 张 `image_urls`，不接受 `video_urls` / `audio_urls`。
- `seedance-2.0-reference-to-video` / `seedance-2.0-fast-reference-to-video` 接受 `image_urls` / `video_urls` / `audio_urls`，但至少要有一个 `image_urls` 或 `video_urls`。
- `image_urls` 支持本地图片路径，provider 会先调用 EvoLink 官方上传接口换成临时 URL。
- `video_urls` / `audio_urls` 仍然必须是远程 URL。
- `duration` 当前按官方统一接口收敛为 `4-15` 秒。
- `quality` 当前按官方文档只收敛为 `480p` 或 `720p`。
- `aspect_ratio` 只接受 `16:9`、`9:16`、`1:1`、`4:3`、`3:4`、`21:9`、`adaptive`。
