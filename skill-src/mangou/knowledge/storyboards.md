# 分镜 YAML

## Contents

- 最小结构
- 字段要求
- 规则
- 示例

## 最小结构

每个 `storyboards/*.yaml` 只表示一个镜头，根字段通常是：

- `meta`
- `content`
- `tasks`
- `refs`（可选）

## 字段要求

### `meta`

- `id`: 必填，通常与文件名一致
- `version`: 必填，建议 `"1.0"`
- `grid`: 可选。存在时表示母图
- `parent`: 可选。存在时表示子镜

### `content`

- `sequence`: 必填，镜头顺序
- `title`: 必填
- `story`: 必填，保留原剧情
- `action`: 必填，画面动作
- `scene`: 必填，场景说明
- `duration`: 必填，如 `"4s"`
- `characters`: 可选，角色 ID 列表

### `tasks.<type>`

- `provider`: 必填。脚本不会自动推断；图片任务推荐 `bltai`，视频任务推荐 `evolink`
- `params.model`
- `params.prompt`
- `params.images`
- `latest`: 运行后回填

## 规则

1. 真相源是 `tasks.jsonl`，`latest` 只是投影缓存。
2. `params.images` 必须是相对项目根目录的路径。
3. 连续镜头优先引用上一镜产物来保持一致性。
4. 母图和子镜的关系统一用 `meta.parent`、`meta.grid`、`meta.grid_index` 表达。
5. `storyboard split` 不从 prompt 猜 grid 尺寸，只认 `meta.grid` 或 `--grid`。
6. `storyboard split` 成功后也会写 `tasks.jsonl`，不要把它当例外。
7. `stitch` 优先用视频；没视频时会按 `content.duration` 用静图补预览段。
8. `tasks.image.provider` 和 `tasks.video.provider` 都必须显式写出；skill 仅提供推荐，不做脚本默认。

## 示例

```yaml
meta:
  id: "s1"
  version: "1.0"
content:
  sequence: 1
  title: "初见"
  story: "在繁忙的车站，两人擦肩而过。"
  action: "特写镜头，微风吹动发丝，眼神交错。"
  scene: "火车站站台，夕阳余晖。"
  duration: "4s"
tasks:
  image:
    provider: "bltai"
    params:
      model: "nano-banana-2"
      prompt: "Cinematic close shot, a girl looking back at a boy on a train platform during sunset."
      aspect_ratio: "16:9"
    latest:
      status: "completed"
      output: "assets/images/s1-8821a.png"
```
