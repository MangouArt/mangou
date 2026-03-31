# 工作区与项目目录规范（初版）

## 目标
- 明确 `workspace` 与 `project` 两层结构。
- Script 负责工作区基础设施，Agent/Script 在项目内执行任务。
- 前端只关注标准目录，不限制项目内存在额外文件。

## 目录结构
```text
<workspaceRoot>/
  .claude/
    skills/
      mangou/
  .mangou/
    server.pid
    server.port
    server.log
  config.json
  projects.json
  projects/
    <projectId>/
      project.json
      tasks.jsonl
      storyboards/
        <storyboardId>.yaml
      asset_defs/
        chars/
        scenes/
        props/
      assets/
        images/
        videos/
```

## 分层定义
### Workspace
- `workspaceRoot` 为工作区根目录。
- 由初始化脚本创建与管理。
- 存放 `.claude/skills/mangou/`、本地运行时状态、`config.json`、`projects.json`。

### Project
- `projects/<projectId>/` 为单个项目根目录。
- 所有任务、YAML、产物都限制在项目根目录内。

## 标准目录职责
- `projects.json`：项目索引文件。
- `config.json`：工作区配置，至少包含 `workspaceDir`。
- `project.json`：项目元信息。
- `tasks.jsonl`：任务状态唯一真相源。
- `storyboards/`：分镜 YAML。
- `asset_defs/`：资产定义 YAML。
- `assets/`：生成产物。

## 约束
- 所有文件路径统一使用**相对项目根目录**表示。
- `asset_defs/` 与 `assets/` 必须分离，不混放。
- 允许存在非标准目录，UI 与校验器只关注标准目录。

## 读写边界
- Script：管理工作区、启动停止 Web、调用本地 HTTP API、更新任务状态与 YAML 投影。
- Agent：管理项目与脚本调用，不直接操作任务数据库。
- Web：只读展示、提供本地接口、广播文件变化。
- 前端：只读展示，禁止直接写入。
