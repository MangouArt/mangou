> ## Documentation Index
> Source: https://docs.jiekou.ai/docs/models/reference-get-async-task-result

# 查询任务结果

「查询任务结果 API」用于获取 JieKou 异步任务返回的图像、视频或音频结果。

## 请求

- **方法**: `GET`
- **地址**: `https://api.jiekou.ai/v3/async/task-result`

### 请求头

- `Content-Type: application/json`
- `Authorization: Bearer {{API_KEY}}`

### 查询参数

- `task_id`:
  - 类型: `string`
  - 必填
  - 值来自异步提交接口的 200 响应

## 响应结构

```json
{
  "extra": {
    "seed": "123",
    "debug_info": {
      "request_info": "...",
      "submit_time_ms": "1710000000000",
      "execute_time_ms": "1710000001000",
      "complete_time_ms": "1710000009000"
    }
  },
  "task": {
    "task_id": "task_xxx",
    "status": "TASK_STATUS_SUCCEED",
    "reason": "",
    "task_type": "video",
    "eta": 0,
    "progress_percent": 100
  },
  "images": [
    {
      "image_url": "https://...",
      "image_url_ttl": 3600,
      "image_type": "png"
    }
  ],
  "videos": [
    {
      "video_url": "https://...",
      "video_url_ttl": "3600",
      "video_type": "mp4"
    }
  ],
  "audios": [
    {
      "audio_url": "https://...",
      "audio_url_ttl": "3600",
      "audio_type": "wav",
      "audio_metadata": {
        "text": "...",
        "start_time": 0,
        "end_time": 5
      }
    }
  ]
}
```

## 状态字段

- `TASK_STATUS_QUEUED`: 排队中
- `TASK_STATUS_PROCESSING`: 处理中
- `TASK_STATUS_SUCCEED`: 成功
- `TASK_STATUS_FAILED`: 失败

## 对 Mangou runtime 的约束

- 轮询端点必须使用 `GET /v3/async/task-result?task_id=...`
- 视频成功结果从 `videos[].video_url` 读取
- 开启 `return_last_frame` 时，尾帧图片出现在 `images[].image_url`
- 开启 `generate_audio` 时，音频结果出现在 `audios[].audio_url`
