# AIGC 供应商详情: BLTAI

BLTAI 作为系统的默认服务商，提供了极其迅速的响应和极高的性价比。

## 1. 图像生成 (image.gen)

用于生成资产的基础原画。

| 模型标识 (model) | 描述 |
| :--- | :--- |
| `nano-banana` | 核心生图模型，支持文生图和图生图。 |

### 1.1 params 字段规范
- **prompt** (string, **必需**): 描述画面的文字。
- **images** (array<string>, **可选**): 参考图路径。若提供，则执行图生图或风格迁移。
- **aspect_ratio** (string, **可选**): 期望的输出比例，如 `"1:1"`, `"16:9"` 等。
- **image_size** (string, **可选**): 分辨率档位。支持 `"1024x1024"`, `"2K"`, `"4K"`。

---

## 2. 视频生成 (video.gen)

将图片或文字转为动态视频。

| 模型标识 (model) | 描述 |
| :--- | :--- |
| `doubao-seedance-1-0-pro-fast-251015` | **默认模型**。快速视频生成，擅长人物动态。 |
| `veo3.1-fast` | Google 极速视频模型。 |

### 2.1 params 字段规范
- **prompt** (string, **必需**): 动态/镜头动作描述。例如 "Camera pans right as character walks"。
- **images** (array<string>, **必需**): 首帧参考图或关键帧图片。通常引用 `image` 任务的产物。
- **duration** (number, **默认: 5**): 持续秒数。通常由后端自动处理为 5。
- **aspect_ratio** (string, **可选**): 视频比例。

---

## 3. 关键原则 (Implementation Rule)
1. **即时性**: 部分 BLTAI 任务返回速度极快。如果任务在 2 秒内完成，脚本会立即跳过轮询。
2. **多图支持**: 支持输入多张参考图，用于控制角色一致性或场景逻辑。
