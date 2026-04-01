# 资产定义 YAML 规范 (Asset Specification)

本文件描述了角色、场景及道具资产的定义标准及其在 AIGC 流水线中的作用。

## 1. 资产分类与路径

资产定义文件按类型存放于：
- `asset_defs/chars/`: 角色定义。
- `asset_defs/scenes/`: 场景定义。
- `asset_defs/props/`: 道具/物品定义。

所有资产生成产物统一存放在 `assets/` 目录下。

## 2. 结构定义

### 2.1 meta
- `id` (必需): 资产的唯一标识符（如 `mangou-girl`）。
- `type` (必需): `character`, `scene`, 或 `prop`。
- `version`: 当前建议为 `"1.0"`。

### 2.2 content
- `name`: 资产显示的中文名称。
- `name_en`: 方便 AIGC 使用的英文名称。
- `description`: 资产的基础描述。
- `appearance`: 具体的视觉外貌特征描述。
- `setting`: 环境或性格设定。

### 2.3 tasks
资产可直接承载 AIGC 任务，用于生成视觉基准（Key Visual）。
- 结构与分镜 YAML 一致，包含 `params` 和 `latest`。
- 建议先生成资产基准图，并在分镜 YAML 中通过路径引用该图。

## 3. 业务规则

1. **视觉一致性原则**: 推荐先通过资产 YAML 的 `tasks.image` 生成稳定的角色/场景原画，记录在 `assets/` 下。
2. **解耦存储**: `asset_defs/` 仅存放配置文件，严禁将生成的图片或大型二进制文件放入此目录。
3. **引用链条**: 在分镜 YAML (`storyboards/*.yaml`) 中引用资产时，应在 `content.characters` 标注 ID，并手动将资产的 `latest.output` 图片路径填入分镜任务的 `params.images`。

## 4. 示例 (角色资产)

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
