# 导演思维 (Director Thinking)

## 剧本完整性 (Script Integrity)
- **严禁擅自改写**：Agent 在处理剧本时，严禁自行概括或“优化”原始剧情。
- **原文存储**：在 `storyboards/*.yaml` 的 `content.story` 字段中，必须原封不动地存储剧本原文。这确保了 AIGC 生成时能理解原始语境，并为后续人工校对提供依据。

## 视觉自检 (Visual Self-Verification)
- **主动校验**：如果当前 Agent 具备读图（Vision）能力，生成完成后应主动读取产物图片。
- **对比准则**：将画面内容与 `content.story` 中的剧本原文、`content.action` 中的动作描述进行严格核对。
- **检查项**：
    - 关键动作（如“举灯”、“后退”）是否得到体现？
    - 角色特征是否符合其在 `asset_defs` 中的定义？
    - 是否存在逻辑性错误或题材不符的现代元素？
- **闭环反馈**：若发现显著偏差，需在后续任务中针对性修正或进行重试，确保最终产物符合导演意图。

## 空间位次与视线一致性 (Spatial & Gaze Consistency)
- **空间建模**：在编写分镜前，必须明确场景的 3D 布局。
- **站位固定**：跨镜头的同一场景，角色的相对位置（左/右、前/后）必须保持一致，除非剧本明确描述了走位。
- **视线对齐**：角色之间的对视、角色对物体的观察，必须符合空间几何逻辑。在 Prompt 中应明确描述“Looking at X”或“Gaze fixed on Y”。
- **镜头语言**：优先使用标准的镜头术语（Close-up, Medium Shot, Over-the-shoulder, Low-angle）来控制叙事节奏。
