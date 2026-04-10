# EvoLink 参数

## 环境

- 官网：`https://evolink.ai`
- API 文档索引：`https://docs.evolink.ai/llms.txt`
- 环境变量：`EVOLINK_API_KEY`、`EVOLINK_BASE_URL`

## 视频

`EvoLink` 是当前 skill 推荐的视频 provider。编写 `tasks.video` 时，如果没有特殊要求，优先显式写 `provider: evolink`，并按本页字段和约束组织 YAML。

当前已接入模型：

- `seedance-2.0-text-to-video`
- `seedance-2.0-image-to-video`
- `seedance-2.0-reference-to-video`
- `seedance-2.0-fast-text-to-video`
- `seedance-2.0-fast-image-to-video`
- `seedance-2.0-fast-reference-to-video`

模型分支：

- `*-text-to-video`
  - 只接受 `prompt`
  - 可选 `model_params.web_search`
- `*-image-to-video`
  - 必须提供 `image_urls`
  - 只接受 `1-2` 张图
  - 不接受 `video_urls` / `audio_urls`
- `*-reference-to-video`
  - 接受 `image_urls` / `video_urls` / `audio_urls`
  - 至少要有一个 `image_urls` 或 `video_urls`
  - `prompt` 必须用自然语言说明各参考素材的用途

媒体输入说明：

- `image_urls` 可写本地图片路径，runtime 会先转成 `data:`，provider 再通过 EvoLink 官方上传接口换成远程 URL
- `video_urls` / `audio_urls` 也可写本地媒体路径，runtime 会先转成 `data:`，provider 再通过 EvoLink 官方上传接口换成远程 URL
- 九宫格母图如果要给 `reference-to-video` 当连续镜头计划，必须在 `prompt` 明确说明它是 hidden shot plan，不是单张海报

常用参数：

- `model`
- `prompt`
- `image_urls`
- `video_urls`
- `audio_urls`
- `duration`
- `quality`
- `aspect_ratio`
- `generate_audio`
- `callback_url`

## 规则

1. `provider` 写在 task 层，不写进 `params`。
2. `image_urls` / `video_urls` / `audio_urls` 都支持本地媒体路径，但本地媒体最终会先上传到 `files-api.evolink.ai`，得到临时 `file_url` 再提交。
3. `text-to-video` 不接受任何 `image_urls` / `video_urls` / `audio_urls`。
4. `image-to-video` 必须有 `1-2` 张 `image_urls`，其中 2 张图会按首尾帧心智提交。
5. `reference-to-video` 至少要有一个 `image_urls` 或 `video_urls`，不能只传 `audio_urls`。
6. `duration` 当前按官方统一接口收敛为 `4-15` 秒。
7. `quality` 当前只按官方页收敛为 `480p` 或 `720p`。
8. `aspect_ratio` 只接受 `16:9`、`9:16`、`1:1`、`4:3`、`3:4`、`21:9`、`adaptive`。
9. `callback_url` 只接受 HTTPS URL。

## 最小示例

```yaml
tasks:
  video:
    provider: evolink
    params:
      model: seedance-2.0-fast-reference-to-video
      prompt: "Use image 1 as the first-frame identity reference, use video 1 for handheld camera movement, and use audio 1 as the background music."
      image_urls:
        - https://example.com/character.png
      video_urls:
        - https://example.com/motion-reference.mp4
      audio_urls:
        - https://example.com/bgm.mp3
      duration: 8
      quality: 720p
      aspect_ratio: "16:9"
      generate_audio: true
```

## 图片

`EvoLink` 现已接入官方图像模型 `gemini-3.1-flash-image-preview`。编写 `tasks.image` 时，可以显式写 `provider: evolink`。

当前已接入图片模型：

- `gemini-3.1-flash-image-preview`

常用参数：

- `model`
- `prompt`
- `size`
- `quality`
- `image_urls`
- `model_params.web_search`
- `model_params.thinking_level`
- `callback_url`

图片规则：

1. 当前图片能力只接 `gemini-3.1-flash-image-preview`。
2. `prompt` 必填，长度按官方页收敛为不超过 `2000` 字符。
3. `size` 只接受官方枚举：`auto`、`1:1`、`1:4`、`4:1`、`1:8`、`8:1`、`2:3`、`3:2`、`3:4`、`4:3`、`4:5`、`5:4`、`9:16`、`16:9`、`21:9`。
4. `quality` 只接受官方枚举：`0.5K`、`1K`、`2K`、`4K`。
5. `image_urls` 最多 `14` 张，支持本地图片路径；本地图最终会先上传到 `files-api.evolink.ai`，得到临时 `file_url` 再提交。
6. `model_params` 当前只透传 `web_search` 和 `thinking_level`。
7. `thinking_level` 只接受 `auto`、`min`、`high`。
8. `callback_url` 只接受 HTTPS URL。

最小示例：

```yaml
tasks:
  image:
    provider: evolink
    params:
      model: gemini-3.1-flash-image-preview
      prompt: "一只猫在草地上玩耍"
      size: "16:9"
      quality: 2K
      image_urls:
        - assets/images/reference.png
      model_params:
        web_search: true
        thinking_level: auto
      callback_url: "https://example.com/webhooks/image-task-completed"
```

```yaml
tasks:
  video:
    provider: evolink
    params:
      model: seedance-2.0-fast-image-to-video
      prompt: "Use image 1 as the first frame and image 2 as the ending frame. Camera slowly pushes in between them."
      image_urls:
        - assets/images/first-frame.png
        - assets/images/last-frame.png
      duration: 5
      quality: 720p
      aspect_ratio: adaptive
      generate_audio: true
```
