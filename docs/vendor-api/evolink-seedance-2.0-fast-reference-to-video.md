# EvoLink Seedance 2.0 Overview

- 原始文档：https://evolink.ai/api-reference/seedance-2.0/seedance-2.0-fast-reference-to-video.md
- 补充总览：`docs.evolink.ai/*/api-manual/video-series/seedance2.0/seedance-2.0-overview`
- 接口：`POST https://api.evolink.ai/v1/videos/generations`
- 模型：`seedance-2.0-*`
- 鉴权：`Authorization: Bearer ${EVOLINK_API_KEY}`

## 用途

- Seedance 2.0 全系列统一接口
- 通过 `model` 参数区分 6 个模型：
  - `seedance-2.0-text-to-video`
  - `seedance-2.0-image-to-video`
  - `seedance-2.0-reference-to-video`
  - `seedance-2.0-fast-text-to-video`
  - `seedance-2.0-fast-image-to-video`
  - `seedance-2.0-fast-reference-to-video`

## 请求体

- `model`
  - 通过 `model` 选择具体 Seedance 2.0 模型
- `prompt`
  - 必填
  - `text-to-video` 直接写文本描述
  - `image-to-video` 用于描述镜头运动，不在 prompt 里引用视频或音频素材
  - `reference-to-video` 建议明确写出“image 1 作为首帧”“video 1 提供镜头运动”“audio 1 作为背景音乐”
- `image_urls`
  - `image-to-video` 必填，`1-2` 张
  - `reference-to-video` 可选，`0-9` 张
  - 官方接口要求最终提交的是服务端可直连的远程 URL
  - 在 `mangou` runtime 中，本地图片路径会先被转成 `data:` URL，再调用 [evolink-upload-stream.md](./evolink-upload-stream.md) 上传成 `file_url` 后提交
- `video_urls`
  - 仅 `reference-to-video` 可选，`0-3` 个
  - 必须是服务端可直连的远程 URL
  - 官方说明总请求体不能超过 `64MB`，且不要使用 base64
- `audio_urls`
  - 仅 `reference-to-video` 可选，`0-3` 个
  - 必须是服务端可直连的远程 URL
- `duration`
  - 官方统一接口当前为 `4-15` 秒
- `quality`
  - 当前统一接口仅列出 `480p`、`720p`
- `aspect_ratio`
  - `16:9`、`9:16`、`1:1`、`4:3`、`3:4`、`21:9`、`adaptive`
- `generate_audio`
  - 是否生成同步音频，默认 `true`
- `model_params`
  - 仅 `text-to-video` 可用
  - 当前本地只透传 `web_search`
- `callback_url`
  - 只接受 HTTPS URL

## 关键约束

- `text-to-video` 不接受 `image_urls` / `video_urls` / `audio_urls`
- `image-to-video` 必须提供 `1-2` 张 `image_urls`
- `reference-to-video` 不能只给 `audio_urls`；至少要有 `image_urls` 或 `video_urls`
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
