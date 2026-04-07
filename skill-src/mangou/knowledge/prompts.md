# Prompt 规则

## Contents

- 结构化图片 prompt
- 资产三视图
- Grid 防污染
- 3x3 母图后缀
- I2V 视频 prompt

## 结构化图片 prompt

图片任务的 `prompt` 优先按这个顺序写：

- 主体：谁，处于什么状态
- 环境：场景、光线、氛围
- 动作：走位、视角、交互
- 风格：媒介、质感、负向约束

连续镜头优先复用上一镜图片，不要全靠文字维持一致性。

## 资产三视图

核心角色和关键道具，优先先做三视图：

- front
- side
- back

作用是锁定视觉锚点。后续母图或分镜要在 `params.images` 中引用它们。

## Grid 防污染

生成宫格母图时：

1. 不要用 `1. ... 2. ...` 这类数字列表描述每格内容。
2. 改用方位词：`top-left`、`top-right`、`center`、`bottom-left`、`bottom-right`。
3. 若模型爱生数字，补 `no numeric labels, no digits, no numbers`。

## 3x3 母图后缀

`meta.grid: 3x3` 且目标是后续物理切分时，追加以下固定约束：

```text
A professional 3x3 SEAMLESS storyboard grid. NO WHITE BORDERS, NO MARGINS, NO GAPS, NO CAPTIONS, NO TEXT. The 9 panels are tightly tiled together.
```

## 视觉 DNA 约束

- **核心锚点定义**：Prompt 必须显式声明基准色温（K）、曝光模式（Key）及主导光源性质，以锁定视觉 DNA 基调。
- **工业纪实规范**：采用高度物理准确的材质细节描述（如磨砂、拉丝、氧化层），强调结构的功能性与真实感。
- **材质化语义**：使用具象物理材质代替虚泛形容词。重点描述光线在特定材质表面的交互效果。
- **负向净化**：系统排除低保真、非线性光影、过度风格化等干扰元素。

## 高保真复刻 (Cinematic Reproduction)
针对电影/高精密影视片段的复刻，必须覆盖以下硬约束：

1. **反 AI 审美（Anti-AI Aesthetic）**：
   - 使用 `Gritty Analog 35mm film scan`, `Rough industrial textures`, `Hard single-source lighting (High contrast)`。
   - 强制追加 `Heavy film grain`, `Unpolished metallic surfaces` 以对抗 AI 原生的过于平滑的质感。
2. **机械 DNA 锁定（Mechanical DNA Enforcement）**：
   - 严禁使用宽泛的机械描述（如 "complex gears"）。
   - 必须定义具体的拟真工业组件名称并全局复用（例：`Quad-Roller Hydraulic Assembly`），以锁定跨镜头的机械设计语义。

## I2V 视频 prompt

I2V prompt 重点不是“好看”，而是把物理约束写死：

1. 写清镜头怎么动，别写空泛审美词。
2. 明确变化来源只能是摄影机运动、视差、遮挡、视角变化。
3. 显式禁止：
   - `no fade in`
   - `no fade out`
   - `no morphing`
   - `no dissolve`
   - `no spatial re-layout`
4. 必要时用分段时间轴覆盖完整动作。
