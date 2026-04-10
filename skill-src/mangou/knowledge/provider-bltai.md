# BLTAI 参数

## 环境

- 官网：`https://bltcy.ai`
- Token：`https://api.bltcy.ai/token`
- 环境变量：`BLTAI_API_KEY`、`BLTAI_BASE_URL`

## 图片

常用模型：

- `nano-banana`
- `nano-banana-2`

常用参数：

- `prompt`
- `images`
- `aspect_ratio`
- `image_size`

## 视频

常用模型：

- `doubao-seedance-1-0-pro-fast-251015`
- `veo3.1-fast`

常用参数：

- `prompt`
- `images`
- `duration`
- `aspect_ratio`

## 规则

1. 部分任务会在 2 秒内完成，CLI 可能直接跳过轮询。
2. 多图输入可用于一致性控制或复杂场景约束。
3. 上传接口可能返回“前半段成功 JSON，尾部又拼接错误 JSON”的脏响应；runtime 必须先读原始文本，再做容错解析，不能无条件 `response.json()`。
