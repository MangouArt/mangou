# 导演规则

## 分镜写法

1. 一个 `storyboards/*.yaml` 只表示一个物理镜头。
2. `content.story` 保留剧本原文，不要擅自概括或改写。
3. 先想清楚镜头语言，再写 prompt：`close-up`、`medium shot`、`over-the-shoulder`、`low-angle` 这类词优先。

## 视觉校验

如果当前 Agent 支持读图，生成后应检查：

- 动作是否符合 `content.action`
- 剧情是否符合 `content.story`
- 角色是否符合资产定义
- 是否混入错误时代元素或逻辑错误

发现显著偏差时，直接修 prompt 或参数，不要机械重试。

## 空间一致性

1. 同一场景跨镜头先固定角色站位。
2. 视线、左右位次、前后关系不能乱跳，除非剧本明确写了走位。
