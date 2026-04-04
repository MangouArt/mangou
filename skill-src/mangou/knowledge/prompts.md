# 提示词工程 (Prompt Engineering)

## 结构化提示词标准 (Structured Chinese Prompts)
为了确保 Agent 对画面内容的精准控制，所有生成任务的 `prompt` 字段应遵循 `[主体/环境/走位/风格]` 的结构化标准：

- **主体 (Subject)**：核心角色及其状态（如：一个白发苍苍的老矿工，满身尘土，神情紧张）。
- **环境 (Environment)**：场景细节、光影、氛围（如：昏暗潮湿的矿道，背景是生锈的铁轨，只有手里的油灯发出微弱黄光）。
- **走位 (Action)**：动作、镜头视角、交互（如：从主角背后视角，低角度向上看，老矿工正慢慢后退）。
- **风格 (Style)**：艺术风格、媒介、负向约束（如：电影质感，写实风格，NO electrical lights, NO modern tools）。

- **一致性继承**：在后续分镜中，继续引用前一分镜的 `image` 产物，确保角色服饰、长相在帧间不发生跳变。

## 资产设计图 (Asset Design Sheet / 3-view)
在开始故事板生成前，必须为核心资产（角色、重要道具）生成一张 **3-view (front, side, back)** 的三视图设定图。
- **作用**: 作为视觉锚点 (Visual Anchor) 实质性锁定模型在不同角度下的细节。
- **引用规则**: 在母图 YAML 中将其列为 `IMAGE 1`, `IMAGE 2`，并在 Prompt 中明确说明：“IMAGE 1 是角色 A 的三视图，请在生成 9 宫格时严格遵循其服装细节”。
- **细节要求**: 在三视图中明确功能点（如：胸口电池槽），并在后续分镜叙事中进行针对性强调。

## 防止文字污染与宫格逻辑 (Anti-Text Pollution & Grid Logic)
在生成宫格图（Grid）用于切分时，AI 模型容易因 Prompt 中的数字列表产生文字渲染干扰（如在画面中生成 "1", "2" 等数字小标题）。

- **禁用数字列表**: 严禁在 Prompt 中使用 "1. 某某动作, 2. 某某动作" 的格式，这极易诱导模型生成对应数字。
- **推荐方位词 (Directional Shorthand)**: 使用明确的方位描述宫格内容，推荐使用：`左上 (Top-left)`, `右上 (Top-right)`, `左下 (Bottom-left)`, `右下 (Bottom-right)`, `中央 (Center)`。
- **负向提示注意事项**: 除非确定分镜不含任何文字需求，否则限制全局性的 `no text`，避免误伤分镜内的合法文本。针对宫格数字现象，建议针对性使用 `no numeric labels, no digits, no numbers` 等细分约束，提升画面纯净度的同时保留必要文本的渲染能力。

## 3x3 宫格母图强制后缀 (Required 3x3 Grid Suffix)
当 `meta.grid` 为 `3x3`，且任务目标是生成可被 `split-grid` 物理切分的宫格母图时，Prompt 必须追加一段固定的无缝约束后缀。

> **强制后缀 (Standard Suffix)**:
> A professional 3x3 SEAMLESS storyboard grid. NO WHITE BORDERS, NO MARGINS, NO GAPS, NO CAPTIONS, NO TEXT. The 9 panels are tightly tiled together. Industrial sci-fi cinematic style, photorealistic textures.

- **强制性**：这是母图的默认补充约束。
- **目的**: 避免 AI 模型自动在画面间添加说明文字、标号或白色边框，确保切分后的图片可直接作为 I2V 输入且无残留笔画。
- **视觉层级**: 强调“电影化网格 (Cinematic Grid)”而非“排版示意 (Layout Mockup)”。
## 导演级视频提示词规范 (Director-level Video Prompting)

在进行 I2V（图片转视频）生成时，核心逻辑是**从“审美描述”转向“导演调度约束”**。Agent 必须主动压低模型的自由度，通过物理约束来确保视频的连续性与真实感。

### 1. 核心原则：物理约束优于审美描述
不要写“梦幻般的镜头”、“电影级转场”，必须写清楚镜头的物理路径和变化来源。

- **确定首尾帧关系**：写明首帧有什么，画外（Off-screen）有什么，尾帧落点在哪。
- **锁定视觉变化来源**：明确声明变化仅由以下因素驱动：摄影机运动、视角变化、遮挡关系、视差。

### 2. 显式禁止项 (Forbidden Transitions)
必须在 Prompt 中显式禁止模型常用的“偷懒/幻觉”解法：
- **严禁淡入淡出 (No Fades)**：`no fade in, no fade out, no black screen, no transparency changes`.
- **严禁生成式变形 (No Morphing)**：禁止物体凭空变大、变小或通过奇怪的形变“长”出来。
- **严禁溶解与叠化 (No Dissolve/Merge)**：禁止两个场景或物体在过渡中由于物理不通而互相融合、叠化。
- **严禁空间重组**：禁止背景（如地平线、地板）在镜头移动中滑动、闪烁或重新排列。

### 3. 空间与运动指令 (Spatial & Motion Commands)
- **明确场外存在 (`offscreen_elements`)**：例如：“人群真实存在于摄影机右侧 90 度的场外空间”，而不是“人群逐渐出现”。
- **唯一主运镜动作**：明确主轨迹（如：`Rotate right 90 degrees`），并补充排除项（`NOT panning, NOT zooming, NOT scaling`）。
- **主体静止原则**：对于环境驱动的镜头，需说明“背景中的雪地、地平线从头到尾静止，不滑动、不重构”。

### 4. 机械分段指令 (Timed Beats)
当一段自然语言控制不住模型乱发挥时，必须使用分段式时间指令，且必须保证 **全覆盖 (Full Coverage)**：
- **母图溯源**: 必须在时间轴中显式提及宫格母图中的所有 9 个子分镜。
- **示例格式**:
  - `0-3s: Initial sweep across panels 1, 2, and 3.`
  - `3-7s: Focus on movement in panel 4, leading to the flash in panel 5.`
  - `...`
- **目的**: 防止 AI 模型因简化任务而“跳过”某些关键情节。

### 5. 坏提示词 vs. 导演级提示词 (Comparison)
- **❌ 坏 (Bad)**: "A cinematic camera move across the crowd, naturally transition to a new scene, high quality visual." （模型会用溶解或凭空生成来应付，物理逻辑一塌糊涂）
- **✅ 好 (Good)**: "I2V constraint: Camera rotates 90 degrees to the right. The crowd elements are static and exist in the off-screen space at the start. NO FADE, NO MORPH, NO FLASH. Background remains rigid. The movement is purely driven by physical camera rotation and perspective change."
