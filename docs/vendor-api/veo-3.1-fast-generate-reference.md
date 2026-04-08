> ## Documentation Index
> Fetch the complete documentation index at: https://docs.jiekou.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Veo 3.1 Fast 参考图像生成视频

使用 Google Veo 3.1 Fast 模型通过 1-3 张参考图像引导生成视频。支持 720p 和 1080p 分辨率，支持 16:9 和 9:16 宽高比。时长固定为 8 秒。参考类型仅支持 `asset`。

<Tip>
  这是一个**异步**API，只会返回异步任务的 task_id。您应该使用该 task_id 请求 [查询任务结果 API](/docs/models/reference-get-async-task-result) 来检索生成结果。
</Tip>

## 请求头

<ParamField header="Content-Type" type="string" required={true}>
  枚举值: `application/json`
</ParamField>

<ParamField header="Authorization" type="string" required={true}>
  Bearer 身份验证格式: Bearer {{API 密钥}}。
</ParamField>

## 请求体

<ParamField body="seed" type="integer">
  随机种子，用于复现生成结果。

  取值范围：[0, 4294967295]
</ParamField>

<ParamField body="prompt" type="string" required={true}>
  描述期望视频内容的文本提示词。
</ParamField>

<ParamField body="resolution" type="string" default="720p">
  输出视频分辨率。

  可选值：`720p`, `1080p`
</ParamField>

<ParamField body="aspect_ratio" type="string" default="16:9">
  输出视频宽高比。

  可选值：`16:9`, `9:16`
</ParamField>

<ParamField body="sample_count" type="integer" default={1}>
  生成视频样本数量（1-4）。

  取值范围：[1, 4]
</ParamField>

<ParamField body="enhance_prompt" type="boolean" default={true}>
  是否使用 AI 改写提示词以获得更好的生成效果。
</ParamField>

<ParamField body="generate_audio" type="boolean" default={false}>
  是否同时生成音频。
</ParamField>

<ParamField body="negative_prompt" type="string">
  描述需要在生成视频中避免的内容。
</ParamField>

<ParamField body="reference_images" type="array" required={true}>
  1-3 张参考图像，用于引导视频生成。每个元素包含图像 URL 或 Base64 编码数据和参考类型。

  数组长度：1 - 3
</ParamField>

<ParamField body="person_generation" type="string" default="allow_adult">
  是否允许生成成人人物。`allow_adult`：允许生成成人；`dont_allow`：不允许生成人物。

  可选值：`allow_adult`, `dont_allow`
</ParamField>

## 响应

<ResponseField name="task_id" type="string" required={false}>
  使用 task_id 请求 [查询任务结果 API](/docs/models/reference-get-async-task-result) 来检索生成的输出。
</ResponseField>


Built with [Mintlify](https://mintlify.com).
