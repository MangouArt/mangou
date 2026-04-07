> ## Documentation Index
> Fetch the complete documentation index at: https://docs.jiekou.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Seedance 2.0 视频生成

Seedance 2.0 系列模型支持图像、视频、音频、文本等多种模态内容输入，具备视频生成、视频编辑、视频延长等能力，可高精度还原物品细节、音色、效果、风格、运镜等，保持稳定角色特征。支持文生视频、图生视频（首帧/首尾帧）、多模态参考生视频（图片+视频+音频组合）。提供标准版（seedance-2.0）与快速版（seedance-2.0-fast），快速版价格更低、生成更快。

### 最低消费说明

* **适用 SKU**：多模态参考生视频（含视频输入，即 MULTI\_REF\_VID 系列）
* **计费规则**：实际扣费 = max(每秒单价 × 总视频秒数, 最低消费)
* **触发场景**：当用户输入的视频很短（如 1\~2 秒）+ 输出也短时，按秒计算的金额可能低于供应商最低 token 消耗对应的费用，此时按最低消费兜底
* **场景举例**：客户要生成一个4秒的产品宣传视频，上传了一个2秒的产品宣传视频，希望修改背景和颜色，没有其他输入元素，视频较为简单，秒单价 × 视频秒数计算出本次消耗只有\$0.19，但因上传了视频素材，则会触发最低消费，直接按照4秒档的最低消费（\$0.30）进行扣费

#### 最低消费表

| 输出秒数 | 2.0-480P | 2.0-720P | fast-480P | fast-720P |
| ---- | -------- | -------- | --------- | --------- |
| 4    | \$0.30   | \$0.65   | \$0.23    | \$0.50    |
| 5    | \$0.39   | \$0.84   | \$0.30    | \$0.64    |
| 6    | \$0.43   | \$0.93   | \$0.33    | \$0.71    |
| 7    | \$0.52   | \$1.11   | \$0.40    | \$0.85    |
| 8    | \$0.61   | \$1.30   | \$0.46    | \$1.00    |
| 9    | \$0.65   | \$1.39   | \$0.50    | \$1.07    |
| 10   | \$0.73   | \$1.58   | \$0.56    | \$1.21    |
| 11   | \$0.82   | \$1.76   | \$0.63    | \$1.35    |
| 12   | \$0.86   | \$1.86   | \$0.66    | \$1.43    |
| 13   | \$0.95   | \$2.04   | \$0.73    | \$1.57    |
| 14   | \$1.04   | \$2.23   | \$0.79    | \$1.71    |
| 15   | \$1.08   | \$2.32   | \$0.83    | \$1.78    |

<Tip>
  这是一个**异步**API，只会返回异步任务的 task\_id。您应该使用该 task\_id 请求 [查询任务结果 API](/docs/models/reference-get-async-task-result) 来检索生成结果。
</Tip>

## 请求头

<ParamField header="Content-Type" type="string" required={true}>
  枚举值: `application/json`
</ParamField>

<ParamField header="Authorization" type="string" required={true}>
  Bearer 身份验证格式: Bearer \{\{API 密钥}}。
</ParamField>

## 请求体

<ParamField body="fast" type="boolean" default={false}>
  是否使用快速版模型（seedance-2.0-fast）。快速版价格更低、生成更快。
</ParamField>

<ParamField body="seed" type="integer" default={-1}>
  随机种子，用于控制生成内容的随机性。取值范围 \[-1, 2^32-1]，-1 表示随机。

  取值范围：\[-1, +∞]
</ParamField>

<ParamField body="image" type="string">
  首帧图片 URL 或 Base64 编码。用于图生视频-首帧模式。格式支持 jpeg/png/webp/bmp/tiff/gif。宽高比范围 (0.4, 2.5)，宽高像素范围 (300, 6000)，单张不超过 30MB。
</ParamField>

<ParamField body="ratio" type="string" default="adaptive">
  生成视频的宽高比。adaptive 表示根据输入自动选择最合适的宽高比。

  可选值：`16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `21:9`, `adaptive`
</ParamField>

<ParamField body="prompt" type="string">
  文本提示词，描述期望生成的视频。支持中英文，建议中文不超过500字，英文不超过1000词。文生视频模式下必填，其他模式可选。
</ParamField>

<ParamField body="duration" type="integer" default={5}>
  生成视频时长（秒）。范围 \[4,15] 或设为 -1 表示由模型自主选择合适时长。

  取值范围：\[-1, 15]
</ParamField>

<ParamField body="watermark" type="boolean" default={false}>
  生成视频是否包含水印。
</ParamField>

<ParamField body="last_image" type="string">
  尾帧图片 URL 或 Base64 编码。必须与 image 字段同时传入，实现图生视频-首尾帧模式。单独传入 last\_image 而不传 image 无效。首尾帧图片宽高比不一致时以首帧为主，尾帧自动裁剪适配。
</ParamField>

<ParamField body="resolution" type="string" default="720p">
  视频分辨率。

  可选值：`480p`, `720p`
</ParamField>

<ParamField body="web_search" type="boolean" default={false}>
  是否开启联网搜索。开启后模型根据提示词自主判断是否搜索互联网内容，可提升时效性但增加时延。
</ParamField>

<ParamField body="generate_audio" type="boolean" default={true}>
  是否生成与画面同步的声音。true 时模型基于文本与视觉内容自动生成匹配的人声、音效及背景音乐。
</ParamField>

<ParamField body="reference_audios" type="array">
  参考音频列表，用于多模态参考生视频模式。每项为音频 URL 或 Base64 编码。格式 wav/mp3，单个时长 \[2,15]s，所有音频总时长不超过 15s，单个不超过 15MB。不可单独输入音频，需至少包含 1 个参考图片或视频。

  数组长度：1 - 3
</ParamField>

<ParamField body="reference_images" type="array">
  参考图片列表，用于多模态参考生视频模式。每项为图片 URL 或 Base64 编码。最多 9 张。可通过提示词指定图片组合方式，推荐使用「\[图1]xxx，\[图2]xxx」格式。

  数组长度：1 - 9
</ParamField>

<ParamField body="reference_videos" type="array">
  参考视频列表，用于多模态参考生视频模式。每项为视频 URL。格式 mp4/mov，分辨率 480p/720p，单个时长 \[2,15]s，所有视频总时长不超过 15s，单个不超过 50MB。

  数组长度：1 - 3
</ParamField>

<ParamField body="return_last_frame" type="boolean" default={false}>
  是否返回生成视频的尾帧图像（png格式，无水印）。可用于连续视频生成：以尾帧作为下一段视频的首帧。
</ParamField>

## 响应

<ResponseField name="task_id" type="string" required={true}>
  使用 task\_id 请求 [查询任务结果 API](/docs/models/reference-get-async-task-result) 来检索生成的输出。
</ResponseField>


Built with [Mintlify](https://mintlify.com).