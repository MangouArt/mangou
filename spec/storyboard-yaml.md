# storyboard YAML 规范（初版）

## 定义
- `storyboards/*.yaml` 描述单条分镜内容。
- 结构分为 `meta`、`content`、`tasks`、`refs`。
- 任务状态的唯一真相源是 `tasks.jsonl`。

## 结构
### meta
必需字段：
- `id`：分镜标识。
- `version`：版本号。

可选字段：
- `type`：扩展类型。

### content
必需字段：
- `sequence`：序号。
- `title`：标题。
- `story`：剧情说明。
- `action`：动作描述。
- `scene`：场景描述。
- `duration`：时长（字符串，如 `4s`）。

可选字段：
- `characters`：角色列表。
- `image_url`：展示图，仅用于 UI 展示。

### tasks
- 以任务类型为 key，如 `image`、`video`。
- 每个任务包含 `params` 与 `latest`。

`params` 常见字段：
- `prompt`
- `aspect_ratio`
- `images`
- `duration`

规则：
- 如需参考图片或已有图片，统一放在 `params.images`。
- `params.images` 中的路径必须是相对项目根目录的可读图片路径。
- 脚本执行时会自动把本地图片路径转换为 Data URL 后再提交给上游 Provider，YAML 中仍保留相对路径。
- 需要做角色锁定、画面继承或首帧参考时，也统一使用 `params.images`，不要新增其他输入字段。
- 做连续镜头时，优先把上一条分镜的静帧产物放入当前分镜的 `params.images`，而不是只依赖抽象文字描述。
- `refs` 仅用于前端展示参考资料，不作为 AIGC 生成输入。

推荐做法：
- 在视频任务里优先使用“单张分镜图 + 动作/镜头指令”的方式生成，尤其是在转场幅度较大时，不要强行做两张构图差异很大的图片之间的 morph。
- 如需强调角色对应关系，可在 `prompt` 中使用 `image1 is XXX`、`image2 is XXX` 这类明确指代。
- 如需规避模型误识别，可在 `prompt` 中补充明确排除约束，例如 `NO electric tools`、`NO headlamps`。

`latest` 常见字段：
- `task_id`
- `upstream_task_id`
- `status`：`pending|processing|success|failed|cancelled`
- `output.files`
- `updated_at`
- `error`

说明：
- `latest` 是由 `tasks.jsonl` 投影得到的展示缓存，不是任务状态真相源。
- `latest` 丢失后可从 `tasks.jsonl` 重建。
- 脚本会先把最新结果直接写回 YAML，再通知本地 Web 服务同步 UI。
- 如轮询超时但 `latest.task_id` 已存在，下次脚本运行应恢复轮询，而不是重复提交新任务。

## 示例
```yaml
meta:
  id: life-origin-01
  version: "1.0"
content:
  sequence: 1
  title: 原始海洋
  story: 地球早期的原始海洋...
  action: 深海热泉口喷涌着富含矿物质的热液...
  characters: []
  scene: 原始海洋/深海热泉
  duration: 4s
tasks:
  image:
    params:
      prompt: Underwater volcanic vent...
      aspect_ratio: "16:9"
    latest:
      task_id: "4c5a9d4b-8a2c-4bd0-9fd2-2d0bc9b4701a"
      upstream_task_id: "img_123"
      status: success
      output:
        files:
          - assets/images/image_001.png
      updated_at: "2026-03-18T11:59:52.604Z"
      error: null
  video:
    params:
      prompt: Camera slowly zooms...
      images:
        - assets/images/image_001.png
      duration: 4
refs: {}
```
