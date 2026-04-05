# 上传文件

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /v1/files:
    post:
      summary: 上传文件
      deprecated: false
      description: |-
        上传可跨各种端点/功能使用的文件
        单个文件的大小最大为 20MB
        仅返回 url， 不支持预训练等
        上传有审核，严禁违规内容，一经发现，直接封号
      tags:
        - 文件上传（Files）
      parameters:
        - name: Authorization
          in: header
          description: ''
          required: false
          example: Bearer {{YOUR_API_KEY}}
          schema:
            type: string
            default: Bearer {{YOUR_API_KEY}}
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  description: >+
                    要上传的[JSONL](https://jsonlines.readthedocs.io/en/latest/)文件的名称。


                    如果`purpose`设置为“微调”，则每一行都是一个 JSON
                    记录，其中包含代表您的[训练示例](https://platform.openai.com/docs/guides/fine-tuning/prepare-training-data)的“提示”和“完成”字段。

                  type: string
                  format: binary
              required:
                - file
            examples: {}
      responses:
        '200':
          description: ''
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                  object:
                    type: string
                  bytes:
                    type: integer
                  created_at:
                    type: integer
                  filename:
                    type: string
                required:
                  - id
                  - object
                  - bytes
                  - created_at
                  - filename
                x-apifox-orders:
                  - id
                  - object
                  - bytes
                  - created_at
                  - filename
          headers: {}
          x-apifox-name: 成功
      security: []
      x-apifox-folder: 文件上传（Files）
      x-apifox-status: released
      x-run-in-apifox: https://app.apifox.com/web/project/3868318/apis/api-139393498-run
components:
  schemas: {}
  securitySchemes: {}
servers: []
security: []

```
