# 提示词工程 (Prompt Engineering)

## 结构化提示词标准 (Structured Chinese Prompts)
为了确保 Agent 对画面内容的精准控制，所有生成任务的 `prompt` 字段应遵循 `[主体/环境/走位/风格]` 的结构化标准：

- **主体 (Subject)**：核心角色及其状态（如：一个白发苍苍的老矿工，满身尘土，神情紧张）。
- **环境 (Environment)**：场景细节、光影、氛围（如：昏暗潮湿的矿道，背景是生锈的铁轨，只有手里的油灯发出微弱黄光）。
- **走位 (Action)**：动作、镜头视角、交互（如：从主角背后视角，低角度向上看，老矿工正慢慢后退）。
- **风格 (Style)**：艺术风格、媒介、负向约束（如：电影质感，写实风格，NO electrical lights, NO modern tools）。

## 角色锁定索引机制 (Character Locking Index)
在多图生成或长序列任务中，必须使用角色锁定索引来彻底解决特征漂移问题：

- **引用格式**：在 Prompt 中显式指明 `image1 是 角色A`。
- **关联引用**：将 `asset_defs/chars/xxx.yaml` 中的基准图（通常是 `latest.output`）作为生成输入（`params.images[0]`），然后在 Prompt 中指明：“此人正是 image1 中的老矿工”。
- **一致性继承**：在后续分镜中，继续引用前一分镜的 `image` 产物，确保角色服饰、长相在帧间不发生跳变。

## 防止文字污染与宫格逻辑 (Anti-Text Pollution & Grid Logic)
在生成宫格图（Grid）用于切分时，AI 模型容易因 Prompt 中的数字列表产生文字渲染干扰（如在画面中生成 "1", "2" 等数字小标题）。

- **禁用数字列表**: 严禁在 Prompt 中使用 "1. 某某动作, 2. 某某动作" 的格式，这极易诱导模型生成对应数字。
- **推荐方位词 (Directional Shorthand)**: 使用明确的方位描述宫格内容，推荐使用：`左上 (Top-left)`, `右上 (Top-right)`, `左下 (Bottom-left)`, `右下 (Bottom-right)`, `中央 (Center)`。
- **负向提示注意事项**: 除非确定分镜不含任何文字需求，否则限制全局性的 `no text`，避免误伤分镜内的合法文本。针对宫格数字现象，建议针对性使用 `no numeric labels, no digits, no numbers` 等细分约束，提升画面纯净度的同时保留必要文本的渲染能力。
