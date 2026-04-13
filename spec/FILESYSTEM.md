# Mangou Filesystem Specification

Mangou 采用严格的目录结构，确保 Agent、CLI 和 WEB 能够基于物理路径进行零耦合协作。

## 1. 工作区结构 (Workspace)

注意：这里的 `workspaceRoot` 指真实工作区根目录（例如 `Mango/workspace/`），而不是 `mangou/` 仓库根目录。

```text
<workspaceRoot>/
├── projects.json           # 全局项目元数据 (ID, 名称, 创建时间)
└── projects/
    └── {project_id}/       # 单个项目根目录
        ├── storyboards/    # 分镜定义 (YAML)
        ├── asset_defs/     # 资产定义 (YAML)
        │   ├── chars/      # 角色定义
        │   ├── scenes/     # 场景定义
        │   └── props/      # 道具定义
        └── assets/         # 物理媒体资产
            ├── images/     # 生成的图片 (.png, .jpg)
            └── videos/     # 生成的视频 (.mp4)
```

## 2. 媒体资产命名规范
为了避免冲突并保持可追溯性，CLI 在下载媒体文件时应遵循以下命名约定：
- **格式**：`{storyboard_id}_{task_type}_{timestamp}.{ext}`
- **示例**：`scene-001_image_1712246400.png`

## 3. 访问协议
- **Agent/CLI**：直接使用相对路径（如 `./assets/images/xxx.png`）读写。
- **WEB**：通过虚拟 URL 访问：`/api/vfs?projectId={id}&path={relative_path}`。

## 4. 状态同步 (The Watcher)
WEB Server 必须对 `<workspaceRoot>/projects/{project_id}/` 目录进行全量监听。任何 `.yaml` 或媒体文件的 `create/update/delete` 事件都应触发 SSE 推送。
