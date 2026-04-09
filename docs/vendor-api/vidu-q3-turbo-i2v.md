> ## Documentation Index
> Fetch the complete documentation index at: https://docs.jiekou.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Vidu Q3 Turbo 图生视频

本地记录来源于用户提供的官方页面：
`https://docs.jiekou.ai/docs/models/reference-vidu-q3-turbo-i2v.md`

用户随后确认提交端点为：
`POST https://api.jiekou.ai/v3/async/vidu-q3-turbo-i2v`

<Tip>
  这是一个**异步** API，只会返回异步任务的 `task_id`。生成结果应通过 [查询任务结果 API](/docs/models/reference-get-async-task-result) 获取。
</Tip>

## 请求头

<ParamField header="Content-Type" type="string" required={true}>
  枚举值：`application/json`
</ParamField>

<ParamField header="Authorization" type="string" required={true}>
  Bearer 身份验证格式：`Bearer {{API 密钥}}`
</ParamField>

## 请求体

<ParamField body="seed" type="integer">
  随机种子，用于可重复生成；`0` 或不传则随机生成。

  取值范围：`[0, 2147483647]`
</ParamField>

<ParamField body="audio" type="boolean" default={true}>
  是否使用音视频直出能力。设为 `true` 时，输出带台词以及背景音的视频。Q3 模型默认 `true`。
</ParamField>

<ParamField body="images" type="array" required={true}>
  参考图片 URL 数组；支持 `.jpg`、`.jpeg`、`.png`、`.webp`。
  每张图片大小不超过 `50MB`；宽高比需在 `1:4` 与 `4:1` 之间。
</ParamField>

<ParamField body="is_rec" type="boolean" default={false}>
  启用音画匹配；设为 `true` 时，音频节奏与视频动态同步。
</ParamField>

<ParamField body="prompt" type="string">
  视频生成的运动描述；描述场景运动、动作和动态效果。

  长度限制：`0 - 5000`
</ParamField>

<ParamField body="duration" type="integer" default={5}>
  视频时长（秒）。

  取值范围：`[1, 16]`
</ParamField>

<ParamField body="off_peak" type="boolean" default={false}>
  使用非高峰时段定价；设为 `true` 时，任务排队等待非高峰时段处理以降低成本。
</ParamField>

<ParamField body="audio_type" type="string" default="all">
  音频类型，`audio = true` 时生效。
  `all` = 音效 + 人声，`speech_only` = 仅人声，`sound_effect_only` = 仅音效。

  可选值：`all`、`speech_only`、`sound_effect_only`
</ParamField>

<ParamField body="resolution" type="string" default="720p">
  输出视频分辨率。

  可选值：`540p`、`720p`、`1080p`
</ParamField>

## 响应

<ResponseField name="task_id" type="string" required={true}>
  异步任务 ID。需要用该值调用查询任务结果接口获取生成结果。
</ResponseField>

## 关键结论

- 当前模型是“多图 URL 数组 + 运动 prompt”的 i2v，不是 `subjects[].images` 那套主体驱动协议。
- 提交端点是 `POST /v3/async/vidu-q3-turbo-i2v`。
- 主图字段是 `images`，文档当前明确写的是图片 URL 数组。
- `audio` 默认开启，`audio_type` 只有在 `audio = true` 时才有意义。
- `resolution` 支持 `540p`、`720p`、`1080p`。
