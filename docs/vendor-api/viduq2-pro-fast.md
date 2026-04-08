> ## Documentation Index
> Fetch the complete documentation index at: https://docs.jiekou.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# VIDU Q2 Pro Fast 参考生视频

VIDU Q2 Pro Fast 参考图片/视频转视频 API，支持主体模式和非主体模式，支持 720p、1080p 两种分辨率。

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

<ParamField body="bgm" type="boolean" default={false}>
  是否添加背景音乐
</ParamField>

<ParamField body="seed" type="integer">
  随机种子，用于控制生成结果的随机性。相同种子会产生相似的结果。
</ParamField>

<ParamField body="audio" type="boolean" default={false}>
  是否生成音频
</ParamField>

<ParamField body="prompt" type="string" required={true}>
  文本提示词，可以使用 @1、@2 等占位符引用主体

  可选值：`1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`
</ParamField>

<ParamField body="duration" type="integer" required={true} default={5}>
  视频时长（秒），支持 1-10 秒

  可选值：`1`, `2`, `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`
</ParamField>

<ParamField body="subjects" type="array" required={true}>
  主体列表，每个主体包含 name、images 和 voice_id

  数组长度：1 - 无限制

  <Expandable title="properties" defaultOpen={true}>
    <ParamField body="name" type="string" required={true}>
      主体名称，在 prompt 中使用 @{name} 引用
    </ParamField>

    <ParamField body="images" type="array">
      主体图片 URL 列表，最多 3 张，每张不超过 20MB

      数组长度：0 - 3
    </ParamField>

    <ParamField body="voice_id" type="string">
      语音 ID，可选
    </ParamField>
  </Expandable>
</ParamField>

<ParamField body="watermark" type="boolean" default={false}>
  是否添加水印
</ParamField>

<ParamField body="resolution" type="string" default="720p">
  输出视频的分辨率。默认值为 720p。

  可选值：`720p`, `1080p`
</ParamField>

<ParamField body="aspect_ratio" type="string">
  视频宽高比，例如 16:9、9:16、1:1 等
</ParamField>

<ParamField body="movement_amplitude" type="string">
  运动幅度，控制视频中物体的运动强度

  可选值：`auto`, `small`, `medium`, `high`
</ParamField>

## 响应

<ResponseField name="task_id" type="string" required={true}>
  使用 task_id 请求 [查询任务结果 API](/docs/models/reference-get-async-task-result) 来检索生成的输出。
</ResponseField>


Built with [Mintlify](https://mintlify.com).
