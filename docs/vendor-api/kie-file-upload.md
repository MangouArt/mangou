# 文件流上传

## OpenAPI Specification

```yaml
openapi: 3.0.1
info:
  title: ''
  description: ''
  version: 1.0.0
paths:
  /api/file-stream-upload:
    post:
      summary: 文件流上传
      deprecated: false
      description: |-
        :::info[]
          上传的文件为临时文件，3天后自动删除。
        :::

        ### 功能特点

        * 支持多种文件类型的二进制流上传
        * 适合大文件上传，传输效率高
        * 自动识别 MIME 类型
        * 支持自定义文件名或自动生成（相同文件名会覆盖旧文件，可能存在缓存延迟）
        * 返回完整的文件信息和下载链接
        * API Key 认证保护
        * 上传文件为临时文件，3天后自动删除

        ### 使用建议

        * 推荐用于大文件（>10MB）
        * 支持多种格式：图片、视频、文档等
        * 传输效率比 Base64 格式高约 33%

        ### 示例命令

        ```bash  theme={null}
        curl -X POST https://kieai.redpandaai.co/api/file-stream-upload \
          -H "Authorization: Bearer YOUR_API_KEY" \
          -F "file=@/path/to/your-file.jpg" \
          -F "uploadPath=images/user-uploads" \
          -F "fileName=custom-name.jpg"
        ```
      operationId: upload-file-stream
      tags:
        - docs/zh-CN/File Upload API
      parameters: []
      requestBody:
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                  description: 要上传的文件（二进制数据）
                  example: ''
                uploadPath:
                  type: string
                  description: 文件上传路径，不带首尾斜杠
                  examples:
                    - images/user-uploads
                  example: images/user-uploads
                fileName:
                  type: string
                  description: >-
                    文件名（可选），包含文件扩展名。如不提供文件名，将自动生成随机文件名。若新上传的文件名与已存在文件名相同，则旧文件将被覆盖，但由于缓存原因，此更改可能不会立即生效
                  examples:
                    - my-image.jpg
                  example: my-image.jpg
              required:
                - file
                - uploadPath
            examples: {}
      responses:
        '200':
          description: File uploaded successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                    description: Whether the request was successful
                  code:
                    type: integer
                    enum:
                      - 200
                      - 400
                      - 401
                      - 405
                      - 500
                    description: >-
                      Response Status Code


                      | Code | Description |

                      |------|-------------|

                      | 200 | Success - Request has been processed successfully
                      |

                      | 400 | Bad Request - Request parameters are incorrect or
                      missing required parameters |

                      | 401 | Unauthorized - Authentication credentials are
                      missing or invalid |

                      | 405 | Method Not Allowed - Request method is not
                      supported |

                      | 500 | Server Error - An unexpected error occurred while
                      processing the request |
                  msg:
                    type: string
                    description: Response message
                    examples:
                      - File uploaded successfully
                  data:
                    $ref: '#/components/schemas/FileUploadResult'
                required:
                  - success
                  - code
                  - msg
                  - data
                x-apidog-orders:
                  - success
                  - code
                  - msg
                  - data
                x-apidog-ignore-properties: []
              example:
                success: true
                code: 200
                msg: File uploaded successfully
                data:
                  fileName: uploaded-image.png
                  filePath: images/user-uploads/uploaded-image.png
                  downloadUrl: >-
                    https://tempfile.redpandaai.co/xxx/images/user-uploads/uploaded-image.png
                  fileSize: 154832
                  mimeType: image/png
                  uploadedAt: '2025-01-01T12:00:00.000Z'
          headers: {}
          x-apidog-name: SuccessResponse
        '400':
          description: Request parameter error
          content:
            application/json:
              schema: &ref_0
                $ref: '#/components/schemas/ApiResponse'
              examples:
                '2':
                  summary: missing_parameter
                  value:
                    success: false
                    code: 400
                    msg: 'Missing required parameter: uploadPath'
                '3':
                  summary: invalid_format
                  value:
                    success: false
                    code: 400
                    msg: 'Base64 decoding failed: Invalid Base64 format'
          headers: {}
          x-apidog-name: BadRequestError
        '401':
          description: Unauthorized access
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiResponse1'
              example:
                success: false
                code: 401
                msg: 'Authentication failed: Invalid API Key'
          headers: {}
          x-apidog-name: UnauthorizedError
        '500':
          description: Internal server error
          content:
            application/json:
              schema: *ref_0
              example:
                success: false
                code: 500
                msg: Internal server error
          headers: {}
          x-apidog-name: ServerError
      security:
        - BearerAuth: []
          x-apidog:
            schemeGroups:
              - id: kn8M4YUlc5i0A0179ezwx
                schemeIds:
                  - BearerAuth
            required: true
            use:
              id: kn8M4YUlc5i0A0179ezwx
            scopes:
              kn8M4YUlc5i0A0179ezwx:
                BearerAuth: []
      x-apidog-folder: docs/zh-CN/File Upload API
      x-apidog-status: released
      x-run-in-apidog: https://app.apidog.com/web/project/1184766/apis/api-28506752-run
components:
  schemas:
    FileUploadResult:
      type: object
      properties:
        fileName:
          type: string
          description: File name
          examples:
            - uploaded-image.png
        filePath:
          type: string
          description: Complete file path in storage
          examples:
            - images/user-uploads/uploaded-image.png
        downloadUrl:
          type: string
          format: uri
          description: File download URL
          examples:
            - >-
              https://tempfile.redpandaai.co/xxx/images/user-uploads/uploaded-image.png
        fileSize:
          type: integer
          description: File size in bytes
          examples:
            - 154832
        mimeType:
          type: string
          description: File MIME type
          examples:
            - image/png
        uploadedAt:
          type: string
          format: date-time
          description: Upload timestamp
          examples:
            - '2025-01-01T12:00:00.000Z'
      required:
        - fileName
        - filePath
        - downloadUrl
        - fileSize
        - mimeType
        - uploadedAt
      x-apidog-orders:
        - fileName
        - filePath
        - downloadUrl
        - fileSize
        - mimeType
        - uploadedAt
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    ApiResponse:
      type: object
      properties:
        success:
          type: boolean
          description: Whether the request was successful
        code:
          type: object
          properties: {}
        msg:
          type: string
          description: Response message
          examples:
            - File uploaded successfully
      required:
        - success
        - code
        - msg
      x-apidog-orders:
        - success
        - code
        - msg
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
    ApiResponse1:
      type: object
      properties:
        code:
          type: integer
          enum:
            - 200
            - 401
            - 402
            - 404
            - 422
            - 429
            - 455
            - 500
            - 501
            - 505
          description: |-
            响应状态码

            - **200**: 成功 - 请求已处理完成
            - **401**: 未授权 - 身份验证凭据缺失或无效
            - **402**: 积分不足 - 账户余额不足以执行该操作
            - **404**: 未找到 - 请求的资源或接口不存在
            - **422**: 参数验证错误 - 请求参数未通过校验
            - **429**: 调用频率超限 - 已超出该资源的请求限制
            - **455**: 服务不可用 - 系统正在维护中
            - **500**: 服务器内部错误 - 处理请求时发生意外故障
            - **501**: 生成失败 - 内容生成任务执行失败
            - **505**: 功能禁用 - 当前请求的功能已被禁用
        msg:
          type: string
          description: 响应消息，请求失败时返回错误描述
          examples:
            - success
        success:
          type: boolean
          description: 是否成功
      x-apidog-orders:
        - code
        - msg
        - success
      required:
        - success
      x-apidog-ignore-properties: []
      x-apidog-folder: ''
  securitySchemes:
    BearerAuth:
      type: bearer
      scheme: bearer
      bearerFormat: API Key
      description: |-
        所有 API 都需要通过 Bearer Token 进行身份验证。

        获取 API Key：
        1. 访问 [API Key 管理页面](https://kie.ai/api-key) 获取您的 API Key

        使用方法：
        在请求头中添加：
        Authorization: Bearer YOUR_API_KEY

        注意事项：
        - 请妥善保管您的 API Key，切勿泄露给他人
        - 若怀疑 API Key 泄露，请立即在管理页面重置
servers:
  - url: https://api.kie.ai
    description: 正式环境
security:
  - BearerAuth: []
    x-apidog:
      schemeGroups:
        - id: kn8M4YUlc5i0A0179ezwx
          schemeIds:
            - BearerAuth
      required: true
      use:
        id: kn8M4YUlc5i0A0179ezwx
      scopes:
        kn8M4YUlc5i0A0179ezwx:
          BearerAuth: []

```
