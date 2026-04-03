# AIGC 供应商详情: KIE AI

KIE AI 提供了高性能的图像/视频生成与编辑能力，特别适合处理超长 Prompt 和复杂的多图参考任务。

## 0. 注册与 API Key

- **官方网站**: [https://kie.ai](https://kie.ai)
- **获取 API Key**: [https://kie.ai/api-key](https://kie.ai/api-key)
- **环境变量**: `KIE_API_KEY`

## 1. 图像生成 (image.gen)

用于生成资产原画、分镜图或关键帧。

| 模型标识 (model) | 描述 |
| :--- | :--- |
| `nano-banana-2` | 下一代高性能生图模型，细节丰富，构图精准。 |
| `nano-banana-v2` | 下一代高性能生图模型，细节丰富，构图精准。 |
| `nano-banana-v1` | 经典性价比模型，生成速度快。 |

### 1.1 params 字段规范
- **prompt** (string, **必需**): 描述画面的文字。支持中英文。支持描述场景、人物、走位、光效等。最大 20000 字符。
- **images** (array<string>, **可选**): 指定参考图路径。支持引用本地相对路径（如 `assets/images/char.png`）。
- **aspect_ratio** (string, **默认: "auto"**): 图片比例。
  - 可选值: `1:1`, `9:16`, `16:9`, `4:3`, `3:4`, `3:2`, `2:3`, `5:4`, `4:5`, `21:9`, `auto`。
- **resolution** (string, **默认: "1K"**): 画质分辨率。
  - 可选值: `1K` (推荐), `2K`, `4K`。
- **output_format** (string, **默认: "jpg"**): 产物格式。
  - 可选值: `jpg`, `png`。

---

## 2. 图像编辑 / 图生图 (image.gen + images)

通过参考图进行修改或重排版。

| 模型标识 (model) | 描述 |
| :--- | :--- |
| `google/nano-banana-edit` | 专业图像编辑模型。 |

### 2.1 params 字段规范
- **prompt** (string, **必需**): 编辑指令。例如 "将背景改为雪地" 或 "turn this into a cyberpunk style"。
- **images** (array<string>, **必需**): 需要编辑的原图。至少包含 1 张图。
- **image_size** (string, **默认: "1:1"**): 输出图片比例。
  - 可选值: `1:1`, `9:16`, `16:9`, `3:4`, `4:3`, `3:2`, `2:3`, `5:4`, `4:5`, `21:9`, `auto`。
- **output_format** (string, **默认: "png"**): 可选 `png` 或 `jpeg`。

---

## 3. 图生视频 (video.gen)

将静止的分镜图转为动态视频。

| 模型标识 (model) | 描述 |
| :--- | :--- |
| `bytedance/seedance-2-fast` | 字节跳动 Seedance 2.0 快速版，支持首尾帧控制与多图参考。 |
| `bytedance/v1-pro-fast-image-to-video` | 极速高质量视频模型，擅长动态捕捉。 |

### 3.1 params 字段规范
- **prompt** (string, **必需**): 动作描述（Camera Movement & Character Action）。
- **images** (array<string>, **必需**): 参考图路径。如果是 `seedance-2-fast` 模型，通常用作 `first_frame_url`。
- **duration** (number, **默认: 5**): 视频时长（秒）。`seedance-2-fast` 支持 5-15 秒。
- **resolution** (string, **默认: "720p"**): 可选 `"480p"`, `"720p"`。
- **aspect_ratio** (string, **默认: "16:9"**): 视频比例。`seedance-2-fast` 支持 `1:1`, `4:3`, `3:4`, `16:9`, `9:16`, `21:9`, `adaptive`。
- **first_frame_url** (string, **可选**): 指定首帧。若不填则自动使用 `images[0]`。
- **last_frame_url** (string, **可选**): 指定尾帧。
- **reference_image_urls** (array<string>, **可选**): 多图参考，最多 7 张。
- **web_search** (boolean, **默认: true**): 是否启用联网搜索。`seedance-2-fast` 必需。
- **nsfw_checker** (boolean, **默认: true**): 安全审核开关（仅旧模型支持）。

---

## 4. 关键原则 (Implementation Rule)

1. **Provider 字段位置**: `provider` 字段必须位于 **task 级别**，而不是 `params` 内部。
   ```yaml
   tasks:
     video:
       provider: kie  # 正确位置
       params:
         model: bytedance/v1-pro-fast-image-to-video
         prompt: "A cinematic zoom in"
         images: ["assets/images/scene-01.png"]
   ```
2. **自动上传**: Agent 只需填写本地相对路径，`KIE_PROVIDER` 脚本会自动将图片上传至 KIE 临时服务器 (`https://kieai.redpandaai.co`) 并替换为远程 URL 后再提交任务。
3. **异步轮询**: 视频任务通常需要 1-5 分钟。Agent 应通过读取 `latest.status` 确认任务状态，而不是阻塞等待。

---

## 5. 环境依赖

运行 KIE 脚本需要以下依赖（已包含在 `mangou` 核心包中）：
- `js-yaml`: YAML 文件解析
- `undici`: 现代 HTTP 客户端 (Node 18+ 原生 fetch 亦可)
- `node-fetch` 或 `undici` 的 Proxy 支持
