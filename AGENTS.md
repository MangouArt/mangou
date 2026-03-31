# Mangou AI Comic Director - Agent 指南 (Core)

## 项目概述

**Mangou** (@mangou/core) 是一个轻量级、本地优先的 AI 漫剧导演插件（Skill Bundle）。它允许 AI Agent (如 Cursor, Claude Desktop) 直接管理本地工作区的漫剧项目，通过 YAML 定义资产和分镜，并调用本地脚本完成 AIGC 生成和视频合成。

与传统的中心化平台不同，Mangou 的核心哲学是将 **项目状态留在本地文件**，将 **创作逻辑交给 Agent**，将 **重型任务交给 AIGC Provider**。

### 核心能力
- **本地工作区管理**: 自动初始化并维护标准化的漫剧项目目录。
- **YAML 驱动**: 角色、场景、道具和分镜全部采用 YAML 描述，便于 Agent 阅读和精确修改。
- **任务系统**: 基于 `tasks.jsonl` 的轻量级任务追踪，确保长耗时 AI 任务的状态可追溯、可恢复。
- **可视化面板**: 内置基于 Vite + React 的本地 Web UI，实时展示任务进度。
- **全链路 AIGC**: 通过 `scripts/` 提供图片生成、视频生成、视频缝合等原子能力。

---

## 技术栈

- **运行时**: Node.js (>= 18.18)
- **前端 (Dashboard)**: Vite + React + TypeScript + Tailwind CSS + Radix UI / Ant Design
- **后端 (Agent Entrypoints)**: Node.js Scripts (ESM, .mjs)
- **数据存储**: 本地文件系统 (YAML/JSON/JSONL)
- **多媒体处理**: FFmpeg (需安装在系统路径)

---

## 项目结构 (Core Repository)

```text
mangou/
├── scripts/                # Agent 调用入口 (核心脚本)
│   ├── init-workspace.mjs  # 初始化工作区
│   ├── create-project.mjs  # 创建项目
│   ├── aigc-runner.mjs     # AIGC 生成核心逻辑 (Runner)
│   ├── agent-stitch.mjs    # 视频合成脚本
│   ├── start-web.mjs       # 启动可视化 Web 服务
│   └── build-skill.mjs     # 打包为 Agent Skill Bundle
├── src/                    # 可视化 Dashboard 源码 (React)
├── skill-src/              # Skill 定义 (VFS/Tool 配置)
├── spec/                   # 核心数据协议规范 (YAML/JSON)
├── workspace_template/     # 新项目初始化模板
└── bundled-skills/         # 构建产物 (供 Agent 安装)
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

### 1. 任务循环 (Task Loop)
Agent 与 Mangou 的交互遵循 **"编辑-执行-回填"** 循环：
1. **修改 YAML**: Agent 修改 `storyboards/` 或 `asset_defs/` 中的 `params` (如 Prompt)。
2. **触发生成**: Agent 调用 `scripts/aigc-runner.mjs`。
3. **状态同步**: Runner 提交任务给 Provider，更新 `tasks.jsonl`，并将 `latest` 投影写回 YAML。
4. **Agent 确认**: Agent 读取 YAML 中的 `latest.status` 确认结果。

### 2. 真相源 (Source of Truth)
- **配置真相**: YAML 文件中的 `params` 字段。
- **状态真相**: `projects/<projectId>/tasks.jsonl`。
- **展示缓存**: YAML 中的 `latest` 字段仅用于 Agent 快速阅读和 UI 展示，若与 `tasks.jsonl` 冲突，以 `tasks.jsonl` 为准。

### 3. AIGC 逻辑
- **引用不变性**: 在做视频生成时，优先在 `params.images` 中引用 `assets/images/` 下的本地路径。
- **原子化**: 一个脚本只做一件事。不要在 `aigc-runner` 里写复杂的业务逻辑，业务逻辑应留在 Agent 的 Prompt 或 Domain 层。

---

## 常用命令

```bash
# 开发模式 (Frontend & Server)
npm run dev

# 构建可视化面板
npm run build

# 打包 Skill Bundle (输出到 bundled-skills/)
npm run build:skill

# 运行全链路测试
npm run ci

# 快速初始化本地测试环境
npm run workspace:reset:test
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
- 确保 `scripts/` 下的 entrypoints 具有良好的错误处理，并返回标准化的 JSON 结果。
- 维护 `spec/` 的同步更新。
- 保持 `bundled-skills/` 的构建脚本稳定，这是分发的关键。

如果你是负责 **项目制作 (Storyboard Agent)** 的 Agent：
- 遵守 YAML 嵌套规范，不要随意移动文件。
- 优先修复 Prompt 质量，而不是修改 `aigc-runner.mjs`。
