# 一致性策略 (Consistency Strategy)

## NxM 宫格策略 (Grid Strategy)
在建立视觉基准或处理快速连续镜头时，使用 NxM 宫格母图生成的优势在于能自然地维持多张子图之间的光影、构图和角色比例一致性。

### 强制确认规则
- **策略确认**：在生成 3x3（九宫格）及以上密集宫格前，Agent 必须停下来，统一询问用户决定采用何种切分策略。
- **标准规格**：推荐使用 2x2, 3x3, 4x4, 5x5 四种标准规格。

### 切分与回填控制
- **物理切分**：宫格生成成功后，必须调用 `bun run mangou storyboard split` 进行物理切割。
- **YAML 关联回填**：切分后的子图（例如 `sub_01.png`, `sub_02.png` 等）必须准确回填到各自所属的 `storyboards/*.yaml` 或 `asset_defs/*.yaml` 中。
- **显式索引优先**：若子分镜声明 `meta.grid_index`，回填时必须优先使用该 1-based 索引，不允许再按文件顺序覆盖导演指定的格位。
- **顺序映射兜底**：只有在子分镜未声明 `meta.grid_index` 时，才允许回退到按 `sequence` 与文件名排序后的顺序映射。

## 视觉连续性继承 (Visual Continuity Inheritance)
- **引用上一镜**：在处理连续镜头时，强制在 `tasks.image.params.images` 中填入上一分镜的 `latest.output` 图片路径。
- **特征传递**：通过上一镜的图片输入（Image-to-Image），确保模型能自动继承背景、光影和角色的细微视觉细节，减少 Prompt 描述的负担。
