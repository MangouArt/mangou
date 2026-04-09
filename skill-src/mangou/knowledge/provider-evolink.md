# EvoLink 参数

## 环境

- 官网：`https://evolink.ai`
- API 文档索引：`https://docs.evolink.ai/llms.txt`
- 环境变量：`EVOLINK_API_KEY`、`EVOLINK_BASE_URL`

## 视频

当前已接入模型：

- `seedance-2.0-fast-reference-to-video`

模型说明：

- 输入范式是 `image_urls` / `video_urls` / `audio_urls`
- `image_urls` 可写本地图片路径，runtime 会先转成 `data:`，provider 再通过 EvoLink 官方上传接口换成远程 URL
- `video_urls` / `audio_urls` 仍然只接受远程 URL
- `prompt` 必须用自然语言说明各参考素材的用途

常用参数：

- `prompt`
- `image_urls`
- `video_urls`
- `audio_urls`
- `duration`
- `quality`
- `aspect_ratio`
- `generate_audio`

## 规则

1. `provider` 写在 task 层，不写进 `params`。
2. `image_urls` 支持本地图片路径，但本地图片最终会先上传到 `files-api.evolink.ai`，得到临时 `file_url` 再提交。
3. `seedance-2.0-fast-reference-to-video` 至少要有一个 `image_urls` 或 `video_urls`，不能只传 `audio_urls`。
4. `quality` 当前只按官方页收敛为 `480p` 或 `720p`。

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
