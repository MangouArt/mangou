# EvoLink 文件流上传

- 原始文档：https://docs.evolink.ai/cn/api-manual/file-series/upload-stream
- 接口：`POST https://files-api.evolink.ai/api/v1/files/upload/stream`
- 鉴权：`Authorization: Bearer ${EVOLINK_API_KEY}`

## 用途

- 用 `multipart/form-data` 上传本地图片
- 当前只支持图片：`image/jpeg`、`image/png`、`image/gif`、`image/webp`
- 文件 72 小时后过期

## 请求体

- `file`
  - 必填
  - 单次请求最多 1 张图片
- `upload_path` / `uploadPath`
  - 可选
- `file_name` / `fileName`
  - 可选

## 响应

- `success`
- `data.file_url`
- `data.download_url`

对 `mangou` 而言，提交生成任务时优先使用 `data.file_url` 作为 `image_urls` 的远程 URL。
