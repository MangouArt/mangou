# 一致性规则

## Grid

1. 3x3 及以上 dense grid 先确认切分策略，再执行。
2. 优先用标准规格：`2x2`、`3x3`、`4x4`、`5x5`。
3. 宫格生成后必须运行 `storyboard split` 做物理切分。
4. 子镜声明了 `meta.grid_index` 时，回填必须优先按这个 1-based 索引。
5. 只有没写 `meta.grid_index` 时，才退回按 `sequence` 和文件名排序映射。
6. **链式叙事 (Relay Chaining)**：
   - 针对 15s 跨度的 grid，各面板间必须维持“接力棒（Baton）”传承。
   - 前一面板（Pn）的关键视觉锚点（核心组件、光源、光效）必须出现在下一相邻面板（Pn+1）的构图中，以锁定叙事连贯性。

## 连续镜头

1. 连续镜头默认把上一镜 `latest.output` 放进下一镜 `tasks.image.params.images`。
2. 这样比重复堆 prompt 更稳，能继承背景、光影和角色细节。
