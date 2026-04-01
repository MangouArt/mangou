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
- 编写或修改 `storyboards/*.yaml` 或 `asset_defs/*.yaml` (注：每个 YAML 仅限描述一个分镜)
- 根据分镜 YAML 生成图片或视频
- 将项目中的视频素材拼接成最终输出

这个 skill 的核心目标是以**导演视角**组织一个可连续、可落地、可批量执行的漫剧项目。

## 核心能力入口 (Command Hub)

从 `${CLAUDE_SKILL_DIR}/scripts/` 里选择合适的 bundled script 执行任务。推荐的**标准工作流 (Happy Path)** 如下：

1.  **初始化**：运行 `init-workspace.mjs`。完成后执行 `npm install` 安装 `sharp` 等必需依赖。
2.  **配置验证**：检查 `.env.local`。确保 `BLTAI_API_KEY` 已填入。
3.  **创建项目**：通过 `create-project.mjs --project <id>` 建立目录结构。
4.  **编写任务**：在 `projects/<id>/storyboards/` 下创建 YAML 文件。
    - **必须**为每个分镜分配唯一的 `meta.id`。
    - **必须**在 `tasks` 中指定 `model`（如 `bltai` 推荐使用 `nano-banana-2`）。
5.  **执行生成**：运行 `agent-generate.mjs <path> <image|video>`。支持使用绝对路径或相对于当前目录 (CWD) 的相对路径。
6.  **物理切分 (可选)**：若使用宫格生图，运行 `split-grid.mjs`。
    - `--targets` 参数请提供相对于当前目录 (CWD) 的 YAML 路径列表。
7.  **视频拼接**：运行 `agent-stitch.mjs` 合成全片。

## 核心脚本说明

- `init-workspace.mjs`：初始化工作区。
- `create-project.mjs`：创建项目。使用 `--project` 指定 ID。
- `agent-generate.mjs`：执行 AIGC 任务。**请确保 YAML 中已包含对应 Provider 的 `model` 参数。**
- `split-grid.mjs`：自动化宫格切分。**请使用相对于 CWD 的明确路径。**

## 导演执行规范 (Strict Policies)

1.  **显式定义**：始终在 YAML 中明确 `meta.id` 和 `model`。对于 BLTAI 图像任务，推荐 `nano-banana-2`。
2.  **路径确定性**：在执行脚本参数（如 `--targets`）时，始终提供相对于当前执行目录 (CWD) 的路径。
3.  **脚本驱动**：始终通过 `scripts/` 下的工具维护 `tasks.jsonl` 和项目结构，确保数据一致性。
4.  **真相源自考**：`tasks.jsonl` 是唯一真相源。生成失败时，请检查 YAML 中回填的 `error` 字段以获取详细的修复建议。
- **YAML 文件位置**：必须位于 `<project-root>/storyboards/` 或 `<project-root>/asset_defs/` 下。
- **YAML 核心结构**：每个文件必须是单一分镜对象。
  - **分镜 (storyboards/*.yaml)**:
    ```yaml
    meta:
      id: "s1"
      type: "storyboard"
      version: "1.0"
    content:
      sequence: 1
      story: "剧情原文"
      action: "画面动作描述"
      scene: "场景说明"
      duration: "4s"
    tasks:
      image:
        provider: "bltai"
        params:
          prompt: "..."
    ```
  - **资产 (asset_defs/*.yaml)**:
    ```yaml
    meta:
      id: "char-a"
      type: "character"
      version: "1.0"
    content:
      name: "角色名称"
      description: "外貌与性格描述"
    tasks:
      image:
        provider: "bltai"
        params:
          prompt: "..."
    ```

更多详细规范请参考 `spec/` 目录下的文档，特别是 [故事分镜规范 (spec/storyboard-yaml.md)](spec/storyboard-yaml.md)。
