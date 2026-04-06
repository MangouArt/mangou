<!-- GENERATED FROM skill-src/mangou. DO NOT EDIT HERE. EDIT skill-src/mangou INSTEAD. -->
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

`meta.grid: 3x3` 且目标是后续物理切分时，追加这段固定约束：

```text
A professional 3x3 SEAMLESS storyboard grid. NO WHITE BORDERS, NO MARGINS, NO GAPS, NO CAPTIONS, NO TEXT. The 9 panels are tightly tiled together. Industrial sci-fi cinematic style, photorealistic textures.
```

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

示例：

```text
Camera rotates 90 degrees to the right. The crowd exists in off-screen space at the start. NO FADE, NO MORPH, NO FLASH. Background remains rigid. Movement is driven only by physical camera rotation and perspective change.
```
