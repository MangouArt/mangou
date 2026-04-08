# JieKou 图生视频接入反馈

这份反馈聚焦 `mangou-ai-motion-comics` skill 在 JieKou Seedance 2.0 接入上的不一致问题，目标是把文档、YAML 契约和 runtime 行为收敛成单一真相源。

## 主要问题

1. `provider-jiekou.md` 的说明过于简略，未把 YAML 字段与供应商真实请求体的映射讲清楚。
2. 通用 runtime 历史上长期使用 `reference_image_urls` / `first_frame_url`，而 JieKou 官方字段是 `reference_images` / `image` / `last_image`，很容易让调用方误判真正会被处理的字段。
3. 本地图片输入需要明确为统一链路：`项目相对路径 -> data URL -> 裸 base64 -> JieKou async API`。
4. 九宫格母图、音频生成、尾帧回传这些关键视频用法此前没有被写成可执行样例。

## 建议上游优先处理

1. 把 `knowledge/provider-jiekou.md` 明确改成“YAML 字段 -> runtime 映射 -> 供应商请求体”三段式说明。
2. 在 skill 或 runtime 仓库中附带一个最小可运行 YAML 样例，覆盖：
   - `reference_images`
   - `generate_audio: true`
   - `return_last_frame: true`
3. 把媒体输入能力收敛成统一契约，明确每个 provider 接受：
   - URL
   - `data:` URL
   - 裸 base64

## 当前仓库已做的收敛

- `spec/SCHEMA.md` 已把 `reference_images` 纳入本地路径自动解析字段。
- `knowledge/provider-jiekou.md` 已明确推荐九宫格母图优先使用 `reference_images`。
- `examples/jiekou-seedance-2.0-minimal.storyboard.yaml` 提供了最小闭环样例。
