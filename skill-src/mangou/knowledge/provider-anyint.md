# AnyInt 参数

## 环境

- 网关：`https://gateway.api.anyint.ai`
- 环境变量：`ANYINT_API_KEY`、`ANYINT_BASE_URL`

## 视频

`AnyInt` 当前只接入 Doubao Seedance 视频接口。只有当用户明确要求 `AnyInt`、`豆包`、`Volcengine Seedance` 或指定官方兼容参数时，才推荐显式写 `provider: anyint`。

当前已接入模型：

- `doubao-seedance-2-0-260128`
- `doubao-seedance-2-0-fast-260128`

常用参数：

- `model`
- `content`
- `duration`
- `ratio`
- `resolution`
- `watermark`
- `generate_audio`

## 规则

1. `provider` 写在 task 层，不写进 `params`。
2. `content` 必填，至少一项。
3. `content[].type=text` 时必须提供非空 `text`。
4. `content[].type=image_url` 时只允许 `role: first_frame | last_frame | reference_image`。
5. `content[].type=video_url` 时只允许 `role: reference_video`。
6. `content[].type=audio_url` 时只允许 `role: reference_audio`。
7. `duration` 只接受 `4-15` 秒。
8. `ratio` 只接受 `21:9`、`16:9`、`4:3`、`1:1`、`3:4`、`9:16`、`adaptive`。
9. `resolution` 只接受 `480p`、`720p`。
10. 本地媒体路径会先被 runtime 解析成 `data:` URL，再借用 EvoLink 上传接口换成远程 URL。
11. 上传阶段使用 `EVOLINK_API_KEY`，生成阶段使用 `ANYINT_API_KEY`；两个 key 都要配置。

## 最小示例

```yaml
tasks:
  video:
    provider: anyint
    params:
      model: doubao-seedance-2-0-260128
      content:
        - type: text
          text: "一个小猫对着镜头打哈欠"
      duration: 5
      ratio: "16:9"
      resolution: 720p
      watermark: false
      generate_audio: true
```

## 首尾帧示例

```yaml
tasks:
  video:
    provider: anyint
    params:
      model: doubao-seedance-2-0-fast-260128
      content:
        - type: text
          text: "小猫从睁眼到闭眼"
        - type: image_url
          role: first_frame
          image_url:
            url: https://example.com/start.jpg
        - type: image_url
          role: last_frame
          image_url:
            url: https://example.com/end.jpg
      duration: 5
      ratio: adaptive
      resolution: 720p
      watermark: false
      generate_audio: true
```
