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
- `parent`：父分镜 ID。用于母子宫格回填关联。
- `grid`：母图宫格规格，如 `2x2`、`3x3`。
- `grid_index`：子分镜显式指定回填到宫格中的第几个格子，1-based。

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
- 每个任务包含 `provider`, `params` 与 `latest`。

`params` 常见字段：
- `prompt`
- `aspect_ratio`
- `images`
- `duration`

规则：
- `provider`: 可选。指定 AIGC 服务商（如 `bltai`, `kie`）。若不指定则使用系统默认。
- 如需参考图片或已有图片，统一放在 `params.images`。
- `params.images` 中的路径必须是相对项目根目录的可读图片路径。
- 脚本执行时会自动把本地图片路径转换为 Data URL 后再提交给上游 Provider，YAML 中仍保留相对路径。
- 需要做角色锁定、画面继承或首帧参考时，也统一使用 `params.images`，不要新增其他输入字段。
- 做连续镜头时，优先把上一条分镜的静帧产物放入当前分镜的 `params.images`，而不是只依赖抽象文字描述。
- `refs` 仅用于前端展示参考资料，不作为 AIGC 生成输入。

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
- 当使用宫格母图切分时，若子分镜声明 `meta.grid_index`，`split-grid` 必须优先按该索引回填；未声明时才回退到顺序映射。
- `split-grid` 的宫格来源只认两级：CLI `--grid` 显式覆盖，其次读取 `meta.grid`。不从 Prompt 文本推断网格尺寸。
- `project scaffold --grid <masterYaml>` 必须根据母图的 `meta.grid` 生成同目录子分镜占位 YAML，并为每个子分镜写入 `meta.parent` 与 `meta.grid_index`。
- `stitch` 在没有视频产物时允许回退到图片产物，但最终拼接前必须先把静态图片转成与 `content.duration` 一致的临时视频片段。

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
    provider: "bltai"  # 指定服务商
    params:
      model: "nano-banana"
      prompt: Underwater volcanic vent...
      aspect_ratio: "16:9"
    latest:
      status: success
      output:
        files:
          - assets/images/image_001.png
  video:
    provider: "kie"    # 指定服务商
    params:
      model: "bytedance/v1-pro-fast-image-to-video"
      prompt: Camera slowly zooms...
      images:
        - assets/images/image_001.png
      duration: 4
    latest:
      status: pending
refs: {}
```

## 只读 Viewer 展示约束
- `StoryboardDetail` 只展示分镜预览、原剧本文本与 `refs/refAssetIds` 对应的引用资产。
- `tasks.*.params.prompt`、`storyboard.prompt`、`storyboard.videoPrompt` 属于生成输入，不在只读 Viewer 中展示。
