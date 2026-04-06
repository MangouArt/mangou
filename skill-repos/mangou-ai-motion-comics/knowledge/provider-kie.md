<!-- GENERATED FROM skill-src/mangou. DO NOT EDIT HERE. EDIT skill-src/mangou INSTEAD. -->
# KIE 参数

## Contents

- 环境
- 图片
- 图像编辑
- 视频
- 规则

## 环境

- 官网：`https://kie.ai`
- API Key：`https://kie.ai/api-key`
- 环境变量：`KIE_API_KEY`

## 图片

模型：

- `nano-banana-2`
- `nano-banana-v2`
- `nano-banana-v1`

常用参数：

- `prompt`
- `images`
- `aspect_ratio`
- `resolution`
- `output_format`

## 图像编辑

模型：

- `google/nano-banana-edit`

常用参数：

- `prompt`
- `images`
- `image_size`
- `output_format`

## 视频

模型：

- `bytedance/seedance-2-fast`
- `bytedance/v1-pro-fast-image-to-video`

常用参数：

- `prompt`
- `images`
- `duration`
- `resolution`
- `aspect_ratio`
- `first_frame_url`
- `last_frame_url`
- `reference_image_urls`
- `web_search`

## 规则

1. `provider` 写在 task 层，不写进 `params`。
2. `images` 里填本地相对路径即可，运行时会自动上传并替换成远程 URL。
3. 视频任务通常需要 1 到 5 分钟，靠 `latest.status` 或 `tasks.jsonl` 追踪，不要阻塞等待。
