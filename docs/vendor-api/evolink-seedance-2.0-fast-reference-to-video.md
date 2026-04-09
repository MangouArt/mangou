# EvoLink Seedance 2.0 Fast Reference-to-Video

- 原始文档：https://evolink.ai/api-reference/seedance-2.0/seedance-2.0-fast-reference-to-video.md
- 参考镜像：`docs.evolink.ai/*/api-manual/video-series/seedance2.0/seedance-2.0-fast-reference-to-video`
- 接口：`POST https://api.evolink.ai/v1/videos/generations`
- 模型：`seedance-2.0-fast-reference-to-video`
- 鉴权：`Authorization: Bearer ${EVOLINK_API_KEY}`

## 用途

- 多模态参考生视频
- 支持参考图片 `image_urls`
- 支持参考视频 `video_urls`
- 支持参考音频 `audio_urls`
- 仍然要求自然语言 `prompt` 指定素材用途

## 请求体

- `model`
  - 固定为 `seedance-2.0-fast-reference-to-video`
- `prompt`
  - 必填
  - 文档建议用自然语言说明各素材编号如何使用，例如“image 1 作为首帧”“video 1 提供镜头运动”“audio 1 作为背景音乐”
- `image_urls`
  - 可选，`0-9` 个
  - 官方接口要求最终提交的是服务端可直连的远程 URL
  - 在 `mangou` runtime 中，本地图片路径会先被转成 `data:` URL，再调用 [evolink-upload-stream.md](./evolink-upload-stream.md) 上传成 `file_url` 后提交
- `video_urls`
  - 可选，`0-3` 个
  - 必须是服务端可直连的远程 URL
  - 官方说明总请求体不能超过 `64MB`，且不要使用 base64
- `audio_urls`
  - 可选，`0-3` 个
  - 必须是服务端可直连的远程 URL
- `duration`
  - 文档页当前写法为 `5-12` 秒，示例多为 `8` 或 `10`
- `quality`
  - 当前页仅列出 `480p`、`720p`
- `aspect_ratio`
  - 常见值 `16:9`、`9:16`、`1:1`
- `generate_audio`
  - 是否生成音频，示例里为 `true`

## 关键约束

- 不能只给 `audio_urls`；至少要有 `image_urls` 或 `video_urls`
- `image_urls` / `video_urls` / `audio_urls` 都是 URL 输入范式，不是 base64 输入范式
- 当前只有 `image_urls` 在 `mangou` 内实现了“本地图 -> 上传 -> URL -> 提交”
- `video_urls` / `audio_urls` 仍然只接受远程 URL

## 响应

创建任务响应示例核心字段：

- `id`
  - 异步任务 ID
- `status`
  - 初始通常为 `pending`
- `object`
  - `video.generation.task`

## 查询结果

官方任务查询页：

- `GET https://api.evolink.ai/v1/tasks/{task_id}`

查询结果核心字段：

- `id`
- `status`
  - `pending`
  - `processing`
  - `completed`
  - `failed`
- `progress`
- `results`
  - 完成态时的结果 URL 数组

`mangou` 当前按这份官方任务详情页实现轮询与结果提取。
