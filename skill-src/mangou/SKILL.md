---
name: mangou-ai-motion-comics
version: 2.1.0
author: mangou-ai-studio
homepage: https://www.mangou.art
license: FSL-1.1-Apache-2.0
description: Manages AI motion comic production projects with YAML assets and storyboards. Use when users need to initialize Mangou projects, edit storyboard or asset YAML, generate images or videos, split grid shots, stitch final videos, or debug task backfill.
metadata:
  skill_type: local_runtime
  external_endpoints:
    - https://www.mangou.art/downloads/mangou.zip
    - https://www.mangou.art/downloads/mangou-runtime.zip
  operator_note: "mangou.art operated by Mangou AI Studio"
tags: [ai-motion-comic, motion-comic, storyboard, image-generation, video-generation, grid-splitting, production-pipeline, yaml]
display-name: Mangou AI 漫剧导演 / Motion Comic Director
argument-hint: <project init|project stitch|storyboard generate|storyboard split|asset generate|server start> [...args]
disable-model-invocation: true
---

# Mangou

Mangou 用 YAML 管理资产和分镜，用 CLI 执行生成与回填，适合把 AI 漫剧流程收敛成可审计、可批量执行的项目目录。

## Use this skill when

- 用户要初始化 Mangou 项目或整理项目目录
- 用户要编写或修正 `asset_defs/*.yaml`、`storyboards/*.yaml`
- 用户要生成分镜图片、视频，或切分 grid 母图
- 用户要拼接全片、排查 `tasks.jsonl` 或 YAML 回填状态
- 用户要确认 Mangou skill、本地 runtime、dashboard 各自怎么安装

## Quick start

按这个顺序执行：

```text
Mangou checklist
- [ ] 确认技能已安装
- [ ] 优先通过 vercel-labs/skills 安装技能入口
- [ ] 轻量安装态不包含 Bun runtime，不要直接假设 `src/main.ts` 已存在
- [ ] 需要 CLI 时，优先运行 `node bootstrap-runtime.mjs`
- [ ] 需要本地只读页面时，再安装独立 dashboard 包
- [ ] 检索工作区记忆：开始任务前检查 `<workspace>/.mangou/memories/`
- [ ] 先读项目目录规范，再改 YAML
- [ ] 生成后只信任 tasks.jsonl 和 YAML latest 回填
- [ ] 失败时先读 error，再修正参数或 prompt
- [ ] 沉淀经验：任务完成后，询问用户是否总结记忆库
```

1. 安装和 runtime 合并：见 [INSTALL.md](INSTALL.md) 和 `node bootstrap-runtime.mjs`
2. 项目目录和路径约束：见 [knowledge/directory.md](knowledge/directory.md)
3. 资产 YAML：见 [knowledge/assets.md](knowledge/assets.md)
4. 分镜 YAML：见 [knowledge/storyboards.md](knowledge/storyboards.md)
5. 常用命令：见 [COMMANDS.md](COMMANDS.md)

## Operating rules

1. 先改 YAML，再运行命令；不要跳过配置直接猜测参数。
2. 轻量 skill 初始安装只有文档和 `knowledge/`；如果技能根目录还没有 `src/main.ts`，先安装 runtime，再执行 Bun 命令。
3. 所有资源路径都用相对项目根目录的显式路径。
4. 脚本不会为任何任务自动补 `provider`；`tasks.image.provider` 和 `tasks.video.provider` 都必须在 YAML 里显式写出。
5. 任务状态以 `tasks.jsonl` 为唯一真相源，YAML `latest` 是投影缓存。
6. `storyboard split` 只依赖 `meta.grid` / `--grid`，不要靠 prompt 文本推断宫格。
7. 生成失败时先检查 `error`、`latest`、`tasks.jsonl` 末尾记录，再决定是否重试。
8. skill 入口、Bun runtime、dashboard 是三层产物；不要把它们当成同一个安装物。
9. **记忆优先原则**：所有 AIGC 相关操作必须前置检索用户工作区记忆 (`<workspace>/.mangou/memories/`)，如有冲突以时间较近的记录为准。
10. **闭环总结**：调优成功后必须主动引导用户将心得总结到工作区记忆库。
11. 若当前工作区已存在 `.agents/skills/mangou-ai-motion-comics`，后续应优先在这个现有技能内补充和修正规则，而不是另外新建平行的 Mangou 专用技能。
12. 如果工作区 skill 还需要同步到 runtime 仓库中的 `skill-src/`，优先做目录级同步并立即校验，不要手工漏拷单个文件。

## Storyboard prompt repair playbook

当 3x3 分镜图“氛围对了但叙事错了”时，优先按下面流程修，不要只改标题。

### 先做可执行性检查

在承诺“我会重跑生成”之前，同时确认：
1. `read_file` / `patch` 能读写对应 `storyboards/*.yaml`
2. shell 里真实存在项目路径与 Mangou runtime
3. `bun` 可用，且可从当前工作目录调用 `src/main.ts`

原因：有些项目可能只是聊天附加上下文可读，但终端里并没有真实挂载；这种情况下只能修 YAML，不能假装已经生成成功。

### 修复闭环

1. 读取 `script.md`、`world_model.md`、相关 `storyboards/*.yaml`、必要时读 `asset_defs/*.yaml`
2. 用 vision 逐张诊断失败模式
3. 重写 prompt block，而不是只改标题
4. 优先采用这种结构：
   - Reference DNA
   - Story logic
   - Character / space rules
   - Lighting / environment
   - Panel beats
   - Negative prompt
5. patch 完 YAML 后再运行生成
6. 重新验图，确认是否真正修到用户批评点

### 常见失败模式与对应修法

1. 主体身份被模型误解
   - 明确写清主体是什么、不是什么，例如“角色 / 道具 / 结构 / 群体”的边界。
   - 如果模型持续误解，补充负面约束词，并把具体设定回收到项目 memory。

2. 角色组或对象组串位
   - 把不同角色组拆开写：外观规则、状态、动作权限分别列出。
   - 只在通用 skill 保留方法；项目专属名称、颜色、阵营、剧情身份写进项目 memory。

3. 群像规模、空间关系或构图漂移
   - 不要只写“很多人/很多物体”，要明确数量级、疏密、站位关系、镜头距离。
   - 如果 3x3 grid 总是漂移，先做单图 scene reference 固定不变量，再回填到 `image_urls` 重跑。

4. 极端光照、异常天象或复杂环境被画偏
   - 把“光源形态、环境亮度、地平线/背景可读性、主体运动状态”拆开描述。
   - 对容易滑向错误风格的场景，补充负面约束，而不是只堆正向形容词。

5. 参考图在语义上误导生成
   - 若参考图本身表达了错误的部件关系、尺度关系或用途关系，应先移除误导图，再重写 prompt。
   - 同时同步修正叙事说明、图像 prompt、视频 prompt、asset 定义，避免旧语义把结果拉回去。

6. 风格漂移
   - 把“目标风格”和“禁止风格”成对写清楚。
   - 如果用户要写实、电影感、工业感或插画感，这些都应作为项目级风格目标写进 memory，不要在通用 skill 里默认预设某一种风格。

7. 图像修正后视频仍沿用旧逻辑
   - 图像 prompt 改了以后，视频 prompt、节奏说明、音效说明、结尾状态也必须一起同步更新。

8. provider 因素材或措辞拒绝请求
   - 先看报错属于哪类：素材类型不支持、人物安全限制、参数不兼容、媒体数量不符。
   - 再按 provider 文档收缩素材类型、替换触发词、或改成更适配的任务形态。

### 将当前工作区 skill 同步到 runtime 仓库的 `skill-src`

当工作区里的 `.agents/skills/mangou-ai-motion-comics/` 已被修订，而 runtime 仓库还依赖 `skill-src/mangou/` 时，不要手工复制单个文件；最稳的是整目录同步后再做一致性校验。

推荐流程：
1. 先确认源目录与目标目录都存在：
   - source: `<workspace>/.agents/skills/mangou-ai-motion-comics/`
   - target: `<runtime-repo>/skill-src/mangou/`
2. 用目录级同步，而不是逐文件复制：
   - `rsync -a --delete <source>/ <target>/`
3. 立即做差异校验：
   - `diff -qr <source> <target>`
4. 只有在 `diff` 无输出时，才视为同步完成。

为什么这样做：
- `SKILL.md`、`COMMANDS.md`、`knowledge/*`、`memories/*`、脚本文件通常会一起演化
- 手工复制很容易漏掉 `knowledge/` 或旧文件清理不干净
- `--delete` 能让 runtime 侧去掉已废弃文件，避免 skill-src 残留旧规则

如果用户明确要求“把 workspace 的 skill 同步到 runtime 仓库”，这是一个可复用的标准闭环。

### 视频与连续镜头的通用处理原则

1. 如果用户要“延续上一镜头”，先确认是否应该使用 `reference-to-video`，而不是默认 `image-to-video`。
2. 在连续镜头场景里，prompt 必须明确每个参考输入的用途：延续关系、构图参考、动作参考、环境参考。
3. 如果图像只是“隐藏分镜/运动计划”，要在 prompt 中明确说明成片里不要出现 storyboard 本体。
4. 生成后要同时核对：YAML `latest`、`tasks.jsonl`、输出文件是否真的回填成功。

### provider 报错时的通用处理原则

1. 先读错误原文，再分类：
   - 人物/安全限制
   - 素材类型不支持
   - 参数越界或组合不兼容
   - 媒体数量或字段结构错误
2. 不要盲目重试同一 prompt；先缩减触发因素，再按 provider 文档重组请求。
3. 具体到某个 provider 的限制与参数，以 `knowledge/provider-*.md` 为准，不要把一次项目调优经验硬编码进通用 skill。

### 项目特化规则应写去哪里

如果某条规则只服务某个项目、某个世界观、某组角色、某段剧情或某种视觉母题：
1. 不要继续扩写进通用 `SKILL.md`
2. 写入该项目的 `.mangou/memories/*.md`
3. 在通用 skill 里只保留“如何判断这类问题、如何建立检查清单、如何同步修正 YAML / prompt / asset”的方法

### 为项目建立阶段检查清单的方法

当一个项目包含多阶段剧情或多轮视觉状态变化时：
1. 先按阶段拆表：主体、动作权限、环境状态、光照状态、禁止项
2. 把项目专属设定写入 memory，而不是写死在通用 skill
3. 每次重跑前先核对当前阶段是否与该镜头、该 asset、该 video prompt 一致
4. 若某条检查项只对单个项目成立，就从通用 skill 中移除，回收到项目 memory

## Generic skill vs project memory

必须严格区分两个存放位置：

1. 通用技能：`<workspace>/.agents/skills/mangou-ai-motion-comics`
   - 放可复用方法论、命令、prompt 设计模式、常见坑
   - 这些内容应跨项目复用，不依赖某个具体项目时间线

2. 项目相关记忆：`<workspace>/.mangou/`
   - 放当前工作区或具体项目的风格 DNA、镜头约束、阶段性结论
   - 推荐放在 `.mangou/memories/*.md`
   - 这些内容是项目上下文，不应写回通用 skill 里污染全局方法论

判定规则：
- “以后所有 Mangou 项目都适用” -> 写进 skill
- “只对当前项目成立” -> 写进 `.mangou/memories/`

## Reference map

- 安装与下载：[INSTALL.md](INSTALL.md)
- 命令与调用格式：[COMMANDS.md](COMMANDS.md)
- 项目目录：[knowledge/directory.md](knowledge/directory.md)
- 资产定义：[knowledge/assets.md](knowledge/assets.md)
- 分镜规范：[knowledge/storyboards.md](knowledge/storyboards.md)
- 连续性与一致性：[knowledge/consistency.md](knowledge/consistency.md)
- 导演式分镜原则：[knowledge/director.md](knowledge/director.md)
- Prompt 策略：[knowledge/prompts.md](knowledge/prompts.md)
- BLTAI 参数：[knowledge/provider-bltai.md](knowledge/provider-bltai.md)
- EvoLink 参数：[knowledge/provider-evolink.md](knowledge/provider-evolink.md)
- AnyInt 参数：[knowledge/provider-anyint.md](knowledge/provider-anyint.md)
- 任务真相源与回填：[knowledge/tasks.md](knowledge/tasks.md)
- **记忆模块规范**：[memories/README.md](memories/README.md)

默认推荐：
- 图片生成优先推荐 `bltai`
- 视频生成优先推荐 `evolink`
- 如果用户明确要求 AnyInt / 豆包 / Volcengine Seedance 兼容接口，再改用 `anyint`
