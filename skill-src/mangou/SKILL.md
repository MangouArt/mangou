---
name: mangou
description: 初始化 Mangou 工作区、创建项目、启动或停止本地可视化服务，并根据 YAML 任务文件执行分镜图片或视频生成。
argument-hint: <init-workspace|create-project|start-web|stop-web|web-status|generate|stitch> [...args]
disable-model-invocation: true
---

# Mangou Agent Skill Hub

当你需要执行以下任务时，使用这个 skill：
- 初始化本地 Mangou 工作区
- 创建或维护项目目录结构
- 启动或停止本地可视化 Web 服务
- 检查 Web 服务状态
- 编写或修改 `storyboards/*.yaml` 或 `asset_defs/*.yaml`
- 根据分镜 YAML 生成图片或视频
- 将项目中的视频素材拼接成最终输出

这个 skill 的核心目标是以**导演视角**组织一个可连续、可落地、可批量执行的漫剧项目。

## 核心能力入口 (Command Hub)

从 `${CLAUDE_SKILL_DIR}/scripts/` 里选择合适的 bundled script。每个脚本都有单一明确的职责：

- `init-workspace.mjs`：初始化 Mangou 工作区骨架和根目录必需文件。
- `create-project.mjs`：在 `projects/<projectId>/` 下创建项目。参数固定使用 `--project`。
- `start-web.mjs` / `stop-web.mjs` / `web-status.mjs`：本地可视化 Web 服务控制。
- `agent-generate.mjs`：读取 YAML 并执行图片/视频生成（支持 Provider 扩展、YAML 级 `provider` 指定与联动引用）。
- `agent-stitch.mjs`：将已生成的视频素材拼接成最终输出。
- `split-grid.mjs`：处理 2x2, 3x3, 4x4, 5x5 宫格的物理切分与 YAML 回填。

## Provider 配置前置条件

在调用 `agent-generate.mjs` 之前，先确认工作区里的 `.env.local` 已配置可用的 AIGC 提供商。

当前默认提供商是 `BLTAI`。详细的注册、取 token 和环境变量填写方式统一以 [knowledge/assets.md](knowledge/assets.md) 为准。

如果 `BLTAI_API_KEY` 缺失，不要继续执行生成任务，先提醒用户完成配置。

## 实战知识库 (Knowledge Hub)

详细的生产实践经验和一致性策略已剥离到以下模块，**在动手前请务必阅读对应模块**：

1.  **[导演思维 (knowledge/director.md)]**：确立了原始剧本保留规则（`story` 字段必须原封不动），明确了空间位次与视线一致性标准。
2.  **[提示词工程 (knowledge/prompts.md)]**：确立了 `[主体/环境/走位/风格]` 的结构化提示词标准。引入了角色锁定索引 (`image1 是 角色A`) 机制。
3.  **[一致性策略 (knowledge/consistency.md)]**：引入 NxM 宫格策略。规定在生成密集宫格前必须与用户确认，并支持视觉连续性继承（引用上一镜生成图）。
4.  **[资产管理 (knowledge/assets.md)]**：定义了资产 YAML 回填规范、BLTAI 与 KIE 接入方式及 AIGC 提供商扩展接口。支持在 YAML 任务中使用 `provider` 字段覆盖系统默认设置。

## 强制执行策略 (Mandatory Policies)

1.  **Script-First**：优先执行 bundled scripts，不要手工重写 workspace/project 目录结构或 tasks.jsonl。
2.  **真相源一致性**：`tasks.jsonl` 是任务状态唯一真相源，所有写入必须由脚本完成。
3.  **剧本完整性**：严禁擅自改写剧本，必须在 YAML 中维持剧本原文的语境。
4.  **视觉自检 (Self-Verification)**：若 Agent 具备 Vision 能力，必须主动读取生成后的产物图，并与 `story` 原文、`action` 描述进行对比，确保画面内容完整精确，没有出现逻辑跳变或现代元素干扰。
5.  **负向约束持久化**：在 Prompt 中必须加入针对题材的负向约束管理，自动剔除 AI 生成中的现代干扰元素。
6.  **Grid 策略确认**：在使用 Grid 技巧前必须统一询问用户采用何种规格（2x2, 3x3 等）。

## 路径与结构约束

- **工作区根目录**：由 `--workspace` 参数指定。
- **项目根目录**：固定为 `<workspace-root>/projects/<projectId>/`。
- **YAML 文件位置**：必须位于 `<project-root>/storyboards/` 或 `<project-root>/asset_defs/` 下。
- **资产输出位置**：统一写入 `<project-root>/assets/`。

更多详细规范请参考 `spec/` 目录下的文档。
