# Mangou Core

Mangou 现在定位为对外 core engine 仓，而不是最终产品安装仓。

主产品入口已经迁移到：
- `MangouArt/mangou-ai-motion-comics`

本仓当前职责：
- provider 无关的 core 抽象
- dashboard npm 包
- spec / protocol / utilities
- 开发者向基础设施与测试

## What belongs here

- `src/` 中与 provider 无关的基础能力
- `packages/dashboard/`
- `spec/`
- `test/`
- `examples/` / `fixtures/`（迁移完成后）

## What no longer belongs here

- skill 文档真相源
- 对外主安装入口
- 以 zip 技能包为中心的主分发流程
- provider 产品层最终真相源

## Product boundary

如果你要修改以下内容，请优先去 `mangou-ai-motion-comics/`：
- `SKILL.md` / `INSTALL.md` / `COMMANDS.md`
- provider adapters 与 registry
- CLI/runtime 产品行为
- provider 文档与 Hermes 自进化规则

如果你要修改以下内容，请留在本仓：
- dashboard
- spec / schema / protocol
- provider 无关的共用 utilities
- 底层 task / workspace / server 抽象

## Current installation model

主安装路径已经收敛为：

```bash
npx skills add MangouArt/mangou-ai-motion-comics
```

本仓不再作为推荐的直接安装入口。

## Development

```bash
bun install
bun run typecheck
bun run test
bun run build
```

如果你在调整 dashboard：

```bash
bun run build:dashboard:package
```

## Migration notes

以下旧模型正在退役：
- `skill-src/mangou`
- `build:skill`
- `mangou.zip`
- `mangou-runtime.zip`

迁移期内这些历史结构可能仍存在于仓库中，但不再是推荐路径或 SSOT。

## Workspace note

真实创作项目目录只保留在母仓：

```text
Mango/workspace/projects/
```

本仓库内的示例/测试项目已经迁移到 `examples/projects/`；不要再把仓库内目录当成真实工作区。
