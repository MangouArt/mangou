# 供应商: JieKou AI (接口 AI)

JieKou AI (`jiekou.ai`) 是一个聚合 AIGC 服务商，提供包括 Seedance 2.0、Kling、Vidu 等在内的多种模型。

## 配置密钥

在 `.env.local` 中添加：
```bash
JIEKOU_API_KEY="你的 API 密钥"
# 可选：自定义 Base URL
# JIEKOU_BASE_URL="https://api.jiekou.ai"
```

## 模型推荐

### Seedance 2.0
- **ID**: `seedance-2.0` 或 `seedance-2.0-fast`
- **特点**: 高精度视频生成，支持首帧、首尾帧、多图参考、音频生成与尾帧回传。
- **请求体字段**: 以供应商文档为准，使用 `image`、`last_image`、`ratio`、`reference_images`、`generate_audio`、`return_last_frame`。

## YAML 到 runtime 的字段约定

Mangou 的 YAML 可以继续使用项目里的稳定字段名，provider 会在提交前做映射：

| YAML 字段 | JieKou 请求体字段 | 用途 |
| :--- | :--- | :--- |
| `first_frame_url` | `image` | 首帧控制 |
| `last_frame_url` | `last_image` | 尾帧控制 |
| `reference_images` | `reference_images` | 多图参考，九宫格母图优先放这里 |
| `reference_image_urls` | `reference_images` | 兼容旧写法，但新 YAML 优先使用 `reference_images` |
| `aspect_ratio` | `ratio` | 兼容旧写法，但新 YAML 优先使用 `ratio` |

约束说明：
- `reference_images` 才是 Seedance 2.0 的主多图参考字段。
- `first_frame_url` 只适合控制起始关键帧，不适合作为九宫格母图主输入。
- `last_frame_url` 只有与 `first_frame_url` 一起使用时才有意义。

## 本地图片输入规则

Mangou runtime 会先把本地图片路径解析为 `data:` URL，再由 JieKou provider 转成裸 base64 提交给 Seedance 2.0。

这意味着以下写法都允许直接在 YAML 中使用项目相对路径：
- `reference_images`
- `first_frame_url`
- `last_frame_url`

不需要在 YAML 里手写上传接口，也不需要先把图片换成公网 URL。

## 视频任务建议

- 九宫格母图做整段视频参考时，优先使用 `reference_images`。
- 单关键帧起始控制时，再补 `first_frame_url`。
- 连续分段生成时，建议显式设置 `return_last_frame: true`。
- 需要环境音、人物声和背景声时，建议显式设置 `generate_audio: true`。

## 最小可运行样例

```yaml
tasks:
  video:
    provider: jiekou
    params:
      model: seedance-2.0
      prompt: "镜头缓慢推进，人物回头，风吹动头发，保留原始服装与构图。"
      duration: 5
      ratio: "16:9"
      resolution: 720p
      reference_images:
        - assets/images/grid-mother.png
      first_frame_url: assets/images/first-frame.png
      generate_audio: true
      return_last_frame: true
```

## 当前已知边界

- Mangou 当前稳定路径是“本地路径 -> `data:` URL -> provider 转裸 base64 -> 提交到 JieKou 异步接口”。
- 如果你在排查供应商行为，以 [Seedance 2.0 规格说明](../../docs/vendor-api/jiekou-seedance-2.0.md) 为准，不要再假设 KIE 的上传接口可复用到 JieKou。

## 获取 Token

访问 [JieKou.ai 控制台](https://jiekou.ai/settings/key-management) 获取 API 密钥。

## 相关文档

- [Seedance 2.0 规格说明](../../docs/vendor-api/jiekou-seedance-2.0.md)
- [模型列表](../../docs/vendor-api/jiekou-llms.txt)
