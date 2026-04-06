<!-- GENERATED FROM skill-src/mangou. DO NOT EDIT HERE. EDIT skill-src/mangou INSTEAD. -->
# 项目目录

## 何时阅读

- 要初始化项目
- 不确定 YAML、产物、任务日志该放哪
- 路径引用出错

## 结构

```text
<workspace_root>/
  .claude/skills/mangou-ai-motion-comics/
  config.json
  projects.json
  projects/
    <project_id>/
      project.json
      tasks.jsonl
      storyboards/
      asset_defs/
      assets/
      output/
```

## 目录职责

- `.claude/skills/mangou-ai-motion-comics/`: skill 入口本体
- `config.json`: 全局 provider 配置
- `projects/<project_id>/storyboards/`: 分镜 YAML
- `projects/<project_id>/asset_defs/`: 资产 YAML
- `projects/<project_id>/assets/`: 图片和视频产物
- `projects/<project_id>/tasks.jsonl`: 任务真相源
- `projects/<project_id>/output/`: 全片导出

## 路径规则

1. 所有 YAML 和命令参数都用相对于项目根目录的路径。
2. 不要跨项目引用别的 `assets/`。
3. 不要手动删除 `tasks.jsonl`。
4. skill 根目录与项目工作区是两个不同层级，不要把 `projects/` 放进 skill 根目录。
