# 层次结构规范 (Workspace & Project)

本文件描述了 Mangou 的物理文件层级结构及各目录职责。

## 1. 分层结构

Mangou 采用两层物理隔离结构：**工作区 (Workspace)** 与 **项目 (Project)**。

```text
<workspace_root>/          # 工作区根目录 (如 ~/Mango_Files)
  .claude/skills/mangou/   # 本技能的安装目录
  config.json              # 全局配置文件
  projects.json            # 项目清单索引
  projects/                # 【项目中心】
    <project_id>/          # 单个项目目录
      project.json         # 项目元信息
      tasks.jsonl          # 任务状态真相源
      storyboards/         # 分镜配置目录
      asset_defs/          # 资产定义目录
      assets/              # AIGC 产物存放处 (images/, videos/)
      output/              # 最终全片导出目录
```

## 2. 目录职责

### 2.1 工作区 (Workspace)
- **.claude/skills/mangou/**: 存放所有的 bundled scripts（脚本）与 knowledge 库。
- **config.json**: 存储全局 AIGC Provider 的 API KEY、Proxy 等环境配置。

### 2.2 项目 (Project)
- **storyboards/**: 仅存放分镜 YAML。脚本通过扫描此目录的排序来决定拼接全片的顺序。
- **asset_defs/**: 存放核心资产定义（角色、场景、道具）。
- **assets/**: 动态目录。所有生成的图片和视频分镜文件都会根据 YAML ID 自动命名并存入此处。
- **tasks.jsonl**: 记录本项目所有 AIGC 历史，严禁手动删除。

## 3. 路径约束

- **相对路径优先**: 在所有 YAML 配置和脚本参数中，路径必须相对于 **项目根目录 (Project Root)**。
- **严禁跨项目引用**: 项目 A 的分镜不应直接引用项目 B 的 `assets/` 路径。
- **VFS 映射**: 给 Agent 的预览通常映射在 `/` 下。

## 4. 重点文件规范

### 4.1 project.json
描述单个项目的基本信息，位于 `projects/<projectId>/project.json`。
- `schemaVersion`: 结构版本，当前为 `1`。
- `id`: 项目标识。
- `name`: 项目名称。
- `description`: 项目描述。

### 4.2 tasks.jsonl
项目级任务状态数据库，位于 `projects/<projectId>/tasks.jsonl`。
- 详见 **[任务追踪与真相源](tasks.md)**。

### 4.3 config.json (Workspace Level)
存储工作区全局基础配置（位于工作区根目录）。
