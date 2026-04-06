---
name: managing-motion-comics
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
- [ ] 需要 CLI 时，再安装 runtime 包
- [ ] 需要本地只读页面时，再安装独立 dashboard 包
- [ ] 先读项目目录规范，再改 YAML
- [ ] 生成后只信任 tasks.jsonl 和 YAML latest 回填
- [ ] 失败时先读 error，再修正参数或 prompt
```

1. 安装和 runtime 合并：见 [INSTALL.md](INSTALL.md)
2. 项目目录和路径约束：见 [knowledge/directory.md](knowledge/directory.md)
3. 资产 YAML：见 [knowledge/assets.md](knowledge/assets.md)
4. 分镜 YAML：见 [knowledge/storyboards.md](knowledge/storyboards.md)
5. 常用命令：见 [COMMANDS.md](COMMANDS.md)

## Operating rules

1. 先改 YAML，再运行命令；不要跳过配置直接猜测参数。
2. 所有资源路径都用相对项目根目录的显式路径。
3. 任务状态以 `tasks.jsonl` 为唯一真相源，YAML `latest` 是投影缓存。
4. `storyboard split` 只依赖 `meta.grid` / `--grid`，不要靠 prompt 文本推断宫格。
5. 生成失败时先检查 `error`、`latest`、`tasks.jsonl` 末尾记录，再决定是否重试。
6. skill 入口、Bun runtime、dashboard 是三层产物；不要把它们当成同一个安装物。

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
- KIE 参数：[knowledge/provider-kie.md](knowledge/provider-kie.md)
- 任务真相源与回填：[knowledge/tasks.md](knowledge/tasks.md)
