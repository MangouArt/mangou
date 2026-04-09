# Mangou AI Comic Director - Agent 指南 (Core)

## 项目概述

**Mangou** (@mangou/core) 是一个轻量级、本地优先的 AI 漫剧导演插件（Skill Bundle）。它允许 AI Agent 直接管理本地工作区的漫剧项目，通过 YAML 定义资产和分镜，并通过统一的 `mangou` CLI 调用本地能力。

与传统的中心化平台不同，Mangou 的核心哲学是将 **项目状态留在本地文件**，将 **创作逻辑交给 Agent**，将 **重型任务交给 AIGC Provider**。

### 核心能力
- **本地工作区管理**: 自动初始化并维护标准化的漫剧项目目录。
- **YAML 驱动**: 角色、场景、道具和分镜全部采用 YAML 描述，便于 Agent 阅读和精确修改。
- **任务系统**: 基于 `tasks.jsonl` 的轻量级任务追踪，确保长耗时 AI 任务的状态可追溯、可恢复。
- **可视化面板**: 内置基于 Vite + React 的本地 Web UI，实时展示任务进度。
- **统一 CLI**: 通过 `mangou` 命令提供图片生成、视频生成、视频缝合等原子能力。

---

## 技术栈

- **运行时**: Bun (>= 1.1)
- **前端 (Dashboard)**: Vite + React + TypeScript + Tailwind CSS + Radix UI / Ant Design
- **后端 (Agent Entrypoints)**: Unified CLI (`src/cli/main.ts`)
- **数据存储**: 本地文件系统 (YAML/JSON/JSONL)
- **多媒体处理**: FFmpeg (需安装在系统路径)

---

## 项目结构 (Core Repository)

```text
mangou/
├── src/                    # CLI 与 runtime 源码
│   ├── commands/           # CLI 子命令实现
│   ├── logic/              # 核心业务逻辑 (AIGC, Build, Workflows)
│   ├── server/             # 本地只读服务
│   └── web/                # 可视化 Dashboard 源码 (React)
├── skill-src/mangou/       # 唯一 skill 文档源
├── packages/dashboard/     # dashboard npm 包源码
├── spec/                   # 核心数据协议规范 (YAML/JSON)
├── workspace_template/     # 新项目初始化模板
└── bundled-skills/         # 本地/CI 构建产物 (不作为编辑源, 不手改)
```

---

## 工作区结构 (Runtime Workspace)

Agent 在执行任务时，会管理如下结构的目录：

```text
<workspaceRoot>/
  .mangou/                  # 运行时状态 (PID, Port)
  config.json               # 工作区配置
  projects.json             # 项目索引
  projects/
    <projectId>/
      project.json          # 项目元数据
      tasks.jsonl           # 任务状态唯一真相源 (Single Source of Truth)
      storyboards/          # 分镜 YAML (*.yaml)
      asset_defs/           # 资产定义 (chars/, scenes/, props/)
      assets/               # AIGC 产物 (images/, videos/)
```

---

## Agent 开发准则

### 0. 仓库组织规则
- `skill-src/mangou/` 是主仓库里唯一允许手改的 skill 文档目录。
- 仓库根目录不再保留 `SKILL.md` 入口文件；不要依赖软链接或顶层副本。
- 轻量 skill 的 GitHub 分发仓库单独维护在 `MangouArt/mangou-ai-motion-comics`。
- dashboard 的源码入口是 `packages/dashboard/`；仓库根 `dist/` 只是构建输出。
- `bundled-skills/` 与 `dist/` 都是构建输出，不是编辑源。
- `mangou` 里的脚本只负责单仓内逻辑；不要在这里编排 `Mango` 母仓或其他 submodule。
- 跨仓同步、submodule 初始化、发布顺序统一放在 `Mango` 母仓脚本里处理。

### 1. 任务循环 (Task Loop)
Agent 与 Mangou 的交互遵循 **"编辑-执行-回填"** 循环：
1. **修改 YAML**: Agent 修改 `storyboards/` 或 `asset_defs/` 中的 `params` (如 Prompt)。
2. **触发生成**: Agent 调用 `bun run mangou storyboard generate` 或 `asset generate`。
3. **状态同步**: Runner 提交任务给 Provider，更新 `tasks.jsonl`，并将 `latest` 投影写回 YAML。
4. **Agent 确认**: Agent 读取 YAML 中的 `latest.status` 确认结果。

### 2. 真相源 (Source of Truth)
- **配置真相**: YAML 文件中的 `params` 字段。
- **状态真相**: `projects/<projectId>/tasks.jsonl`。
- **展示缓存**: YAML 中的 `latest` 字段仅用于 Agent 快速阅读和 UI 展示，若与 `tasks.jsonl` 冲突，以 `tasks.jsonl` 为准。

### 3. AIGC 逻辑
- **引用不变性**: 在做视频生成时，优先在 `params.images` 中引用 `assets/images/` 下的本地路径。
- **CLI 驱动**: 所有的操作都应该通过 `mangou` CLI 完成，避免直接调用内部代码。

---

## 常用命令

```bash
# 开发模式 (Frontend)
bun run dev

# 构建可视化面板
bun run build

# 打包 Skill Bundle (输出到 bundled-skills/)
bun run build:skill

# 运行全链路测试
bun run ci

# 核心 CLI 命令
bun run mangou project init --name <my-project>
bun run mangou storyboard generate --path <shot.yaml> --type video
bun run mangou project stitch --id <my-project>
bun run mangou server start --port 3000
```

---

## 数据规范 (SPEC)

在修改数据结构前，请务必阅读 `spec/` 目录下的文档：
- [项目目录规范](./spec/project-directory.md)
- [资产 YAML 规范](./spec/assets-yaml.md)
- [分镜 YAML 规范](./spec/storyboard-yaml.md)
- [任务 JSONL 规范](./spec/tasks-jsonl.md)

---

## 核心哲学 (The Philosophy)

1. **Simplicity Over Abstraction**: 优先使用简单的文件读写和脚本调用，避免引入沉重的 ORM 或复杂的中间件。
2. **Transparent State**: 所有的任务进度必须对用户可见（通过 Web UI）且对 Agent 可读（通过 JSONL/YAML）。
3. **Agent-Centric**: 设计工具和 API 时，要考虑 Agent 是否容易通过正则表达式或 YAML 解析器进行操作。避免非结构化的控制台输出。
4. **Good Taste**: 代码要整洁，逻辑要闭环。如果一个功能需要 3 层以上的嵌套逻辑，说明设计需要简化。

---

## 协作建议

如果你是负责 **Core 开发** 的 Agent：
- 确保 `src/cli` 下的 entrypoints 具有良好的错误处理，并返回标准化的 JSON 结果。
- 维护 `spec/` 的同步更新。
- 保持 `build:skill` 和 dashboard 发布脚本稳定，但不要把构建输出当成源码修改。
- `build:skill` 只负责在 `mangou` 仓内生成 `bundled-skills/` 产物；不要把 `mangou-ai-motion-comics` 的同步逻辑写回这里。
- 不要在主仓库里维护 `skills/`、`skill-repos/` 或仓库根 `SKILL.md` 的副本；轻量 skill 仓库单独维护在 `MangouArt/mangou-ai-motion-comics`。

如果你是负责 **项目制作 (Storyboard Agent)** 的 Agent：
- 遵守 YAML 嵌套规范，不要随意移动文件。
- 优先修复 Prompt 质量，而不是修改 CLI 核心逻辑。
