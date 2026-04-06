<!-- GENERATED FROM skill-src/mangou. DO NOT EDIT HERE. EDIT skill-src/mangou INSTEAD. -->
# 资产 YAML

## 何时阅读

- 要新建角色、场景、道具定义
- 要让分镜复用资产参考图
- 要排查 `asset generate` 的输入是否合理

## 路径

- `asset_defs/chars/`
- `asset_defs/scenes/`
- `asset_defs/props/`
- 生成产物统一写到 `assets/`

## 最小结构

- `meta.id`: 唯一 ID
- `meta.type`: `character` / `scene` / `prop`
- `meta.version`: 建议 `"1.0"`
- `content.name`: 中文名
- `content.name_en`: 英文名
- `content.description`: 基础描述
- `content.appearance`: 视觉特征
- `content.setting`: 设定补充
- `tasks.image`: 资产基准图任务

## 规则

1. 先生成资产基准图，再在分镜里引用它。
2. `asset_defs/` 只放 YAML，不放大图或二进制产物。
3. 分镜里引用资产时，同时维护：
   - `content.characters` 中的资产 ID
   - `tasks.<type>.params.images` 中的产物相对路径

## 示例

```yaml
meta:
  id: "hero-lee"
  type: "character"
  version: "1.0"
content:
  name: "李英雄"
  name_en: "Hero Lee"
  appearance: "黑色短发，穿着银色轻型动力装甲，眼神坚定。"
tasks:
  image:
    provider: "bltai"
    params:
      model: "nano-banana-2"
      prompt: "Character concept art, a brave warrior in silver armor, white background."
    latest:
      status: "completed"
      output: "assets/images/hero-lee-ref.png"
```
