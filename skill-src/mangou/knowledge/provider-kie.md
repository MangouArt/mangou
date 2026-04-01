# AIGC 供应商详情: KIE AI

KIE AI 提供了高性能的图像/视频生成与编辑能力，特别适合处理超长 Prompt 和复杂的多图参考任务。

## 1. 图像生成 (image.gen)

用于生成资产原画、分镜图或关键帧。

| 模型标识 (model) | 描述 |
| :--- | :--- |
| `nano-banana-2` | 下一代高性能生图模型，细节丰富，构图精准。 |
| `nano-banana` | 经典性价比模型，生成速度快。 |

### 1.1 params 字段规范
- **prompt** (string, **必需**): 描述画面的文字。支持中英文。支持描述场景、人物、走位、光效等。最大 20000 字符。
- **images** (array<string>, **可选**): 指定参考图路径。支持引用本地相对路径（如 `assets/images/char.png`）。
- **aspect_ratio** (string, **默认: "auto"**): 图片比例。
  - 可选值: `1:1`, `9:16`, `16:9`, `3:4`, `4:3`, `3:2`, `2:3`, `5:4`, `4:5`, `21:9`, `auto`。
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
| `bytedance/v1-pro-fast-image-to-video` | 极速高质量视频模型，擅长动态捕捉。 |

### 3.1 params 字段规范
- **prompt** (string, **必需**): 动作描述（Camera Movement & Character Action）。
- **images** (array<string>, **必需**): 首帧参考图。通常引用上一阶段生成的 `image` 任务产物。
- **duration** (string/number, **默认: "5"**): 视频时长。可选 `"5"` 或 `"10"`。
- **resolution** (string, **默认: "720p"**): 可选 `"720p"` 或 `"1080p"`。
- **nsfw_checker** (boolean, **默认: true**): 安全审核开关。

---

## 4. 关键原则 (Implementation Rule)
1. **自动上传**: Agent 只需填写本地相对路径，`KIE_PROVIDER` 脚本会自动将图片上传至 KIE 临时服务器 (`https://kieai.redpandaai.co`) 并替换为远程 URL 后再提交任务。
2. **异步轮询**: 视频任务通常需要 1-5 分钟。Agent 应通过读取 `latest.status` 确认任务状态，而不是阻塞等待。
