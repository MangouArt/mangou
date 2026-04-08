# Wan 2.7 - 参考生视频

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /api/v1/jobs/createTask:
    post:
      summary: Wan 2.7 - 参考生视频
      deprecated: false
      description: >-
        ## 创建任务


        调用该接口可创建一个新的参考驱动视频生成任务。


        <Card title="查询任务详情" icon="lucide-search"
        href="/market/common/get-task-detail">
          提交任务后，可通过统一查询接口查看任务进度并获取生成结果
        </Card>


        ::: tip[]

        生产环境建议优先使用 `callBackUrl` 参数接收任务完成通知，而不是持续轮询任务状态接口。

        :::


        ## 相关资源


        <CardGroup cols={2}>
          <Card title="模型市场" icon="lucide-store" href="/market/quickstart">
            浏览全部可用模型与能力
          </Card>
          <Card title="通用 API" icon="lucide-cog" href="/common-api/get-account-credits">
            查看账户积分与调用情况
          </Card>
        </CardGroup>
      operationId: wan-2-7-r2v-cn
      tags:
        - docs/zh-CN/Market/Video Models/Wan
      requestBody:
        content:
          application/json:
            schema:
              type: object
              required:
                - model
                - input
              properties:
                model:
                  type: string
                  enum:
                    - wan/2-7-r2v
                  default: wan/2-7-r2v
                callBackUrl:
                  type: string
                  format: uri
                input:
                  type: object
                  required:
                    - prompt
                  properties:
                    prompt:
                      type: string
                    negative_prompt:
                      type: string
                    reference_image:
                      type: array
                      maxItems: 5
                      items:
                        type: string
                        format: uri
                    reference_video:
                      type: array
                      maxItems: 5
                      items:
                        type: string
                        format: uri
                    first_frame:
                      type: string
                      format: uri
                    reference_voice:
                      type: string
                      format: uri
                    resolution:
                      type: string
                      enum:
                        - 720p
                        - 1080p
                      default: 1080p
                    aspect_ratio:
                      type: string
                      enum:
                        - '16:9'
                        - '9:16'
                        - '1:1'
                        - '4:3'
                        - '3:4'
                      default: '16:9'
                    duration:
                      type: integer
                      minimum: 2
                      maximum: 10
                      default: 5
                    prompt_extend:
                      type: boolean
                      default: true
                    watermark:
                      type: boolean
                      default: false
                    seed:
                      type: integer
                      minimum: 0
                      maximum: 2147483647
                    nsfw_checker:
                      type: boolean
            example:
              model: wan/2-7-r2v
              callBackUrl: https://your-domain.com/api/callback
              input:
                prompt: 图1在吃饭，视频1和图2在旁边唱歌。
                negative_prompt: 低分辨率、错误、最差质量、低质量、残缺、多余的手指、比例不良等。
                reference_image:
                  - https://example.com/demo/ref-image-1.png
                  - https://example.com/demo/ref-image-2.png
                reference_video:
                  - https://example.com/demo/ref-video-1.mp4
                first_frame: https://example.com/demo/first-frame.png
                reference_voice: https://example.com/demo/reference-voice.mp3
                resolution: 1080p
                aspect_ratio: '16:9'
                duration: 5
                prompt_extend: true
                watermark: false
                seed: 0
      responses:
        '200':
          description: 请求成功
          content:
            application/json:
              example:
                code: 200
                msg: success
                data:
                  taskId: task_wan_1765180586443
servers:
  - url: https://api.kie.ai
    description: 正式环境
```
