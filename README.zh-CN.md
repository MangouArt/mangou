# Mangou Core

Mangou 现在定位为对外 core engine 仓，而不是最终产品安装仓。

主产品入口已经迁移到：
- `MangouArt/mangou-ai-motion-comics`

本仓当前职责：
- provider 无关的 core 抽象
- dashboard npm 包
- spec / protocol / utilities
- 开发者向基础设施与测试

## 这里应该放什么

- `src/` 中与 provider 无关的基础能力
- `packages/dashboard/`
- `spec/`
- `test/`
- `examples/` / `fixtures/`（迁移完成后）

## 这里不再承担什么

- skill 文档真相源
- 对外主安装入口
- 以 zip 技能包为中心的主分发流程
- provider 产品层最终真相源

## 产品边界

以下内容应优先去 `mangou-ai-motion-comics/` 修改：
- `SKILL.md` / `INSTALL.md` / `COMMANDS.md`
- provider adapters 与 registry
- CLI/runtime 产品行为
- provider 文档与 Hermes 自进化规则

以下内容留在本仓：
- dashboard
- spec / schema / protocol
- provider 无关的共用 utilities
- 底层 task / workspace / server 抽象

运行时产品行为及其回归测试现在优先收敛到 `mangou-ai-motion-comics`；本仓测试应逐步聚焦 dashboard、spec 与少量真正共享的 core 边界。

## 当前安装模型

主安装路径已经收敛为：

```bash
npx skills add MangouArt/mangou-ai-motion-comics
```

本仓不再作为推荐的直接安装入口。

## 开发

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

## 迁移说明

以下旧模型正在退役：
- `skill-src/mangou`
- `build:skill`
- `mangou.zip`
- `mangou-runtime.zip`

迁移期内这些历史结构可能仍存在于仓库中，但不再是推荐路径或 SSOT。

## 工作区说明

真实创作项目目录只保留在母仓：

```text
Mango/workspace/projects/
```

本仓库不再保留任何仓内 `projects/` 目录；真实创作项目只存在于 `Mango/workspace/projects/`。
