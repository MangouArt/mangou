<!-- GENERATED FROM skill-src/mangou. DO NOT EDIT HERE. EDIT skill-src/mangou INSTEAD. -->
# 一致性规则

## Grid

1. 3x3 及以上 dense grid 先确认切分策略，再执行。
2. 优先用标准规格：`2x2`、`3x3`、`4x4`、`5x5`。
3. 宫格生成后必须运行 `storyboard split` 做物理切分。
4. 子镜声明了 `meta.grid_index` 时，回填必须优先按这个 1-based 索引。
5. 只有没写 `meta.grid_index` 时，才退回按 `sequence` 和文件名排序映射。

## 连续镜头

1. 连续镜头默认把上一镜 `latest.output` 放进下一镜 `tasks.image.params.images`。
2. 这样比重复堆 prompt 更稳，能继承背景、光影和角色细节。
