# 资产定义 YAML 规范（初版）

## 定义
- `asset_defs/chars/*.yaml`、`asset_defs/scenes/*.yaml`、`asset_defs/props/*.yaml` 描述资产定义。
- 结构分为 `meta`、`content`、`tasks`、`refs`。
- 生成产物不存放在 `asset_defs/`，统一写入 `assets/`。

## 结构
### meta
必需字段：
- `id`：资产标识。
- `type`：资产类型，如 `character`、`scene`、`prop`。
- `version`：版本号。

### content
必需字段：
- `name`
- `description`

可选字段：
- `name_en`
- `appearance`
- `setting`
- `atmosphere`
- `era`
- `tags`
- `reference_images`

说明：
- `reference_images` 仅用于描述性参考。
- 生成输入统一使用 `tasks.<type>.params.images`。

### tasks
- 与 storyboard 一致，包含 `params` 与 `latest`。
- `latest` 只是 `tasks.jsonl` 投影，不是状态真相源。
- 资产定义 YAML 可以直接承载图片生成任务，脚本执行成功后会把产物路径回填到 `tasks.image.latest`。
- 如需稳定角色或场景视觉基准，优先先生成 `asset_defs/` 下的图片，再在分镜 `tasks.*.params.images` 中引用这些本地产物。
- `tasks.image.params.images` 中如包含本地路径，脚本会自动转成 Data URL 后再提交给 Provider，YAML 中保持原始相对路径。

### refs
- 用于前端标记参考资料，不作为 AIGC 生成输入。

## 示例
```yaml
meta:
  id: astronaut
  type: character
  version: "1.0"
content:
  name: 宇航员
  name_en: Astronaut
  description: 人类探索宇宙的先驱...
  appearance: 穿着白色或橙色太空服...
  era: 现代至未来
  tags:
    - 太空探索
    - 现代科技
  reference_images: []
tasks:
  image:
    provider: "bltai"  # 可选：指定 AIGC 服务商 (bltai | kie)
    params:
      model: "nano-banana"
      prompt: Modern astronaut character design...
      aspect_ratio: "1:1"
    latest:
      status: pending
refs: {}
```
