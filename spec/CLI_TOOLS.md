# Mangou CLI Tools (AWS Style & Path Resolving)

CLI 工具采用层次化指令集，其设计核心为 **“基于路径的透明代理”**。

## 1. 资源与动作映射 (AWS CLI Style)

### Project (项目管理)
- **`mangou project init --name [name]`**: 建立物理目录结构。
- **`mangou project stitch --id [id]`**: 合成项目最终影片。

### Asset (资产处理)
- **`mangou asset generate --path [yaml_path]`**: 触发资产 YAML 中的生成。

### Storyboard (分镜处理)
- **`mangou storyboard generate --path [yaml_path] --type image|video`**
  - **路径解析步骤 (PRE-EXECUTE)**:
    1. **解析 YAML 引用**: 扫描 `params` 里的字符串。如果是以 `.yaml` 结尾的路径，自动从该 YAML 中读取其生成的最新图片路径。
    2. **编码本地路径**: 如果是图片路径，根据 API 需求转换为 Base64 或执行上传。
  - **执行步骤**: 发起 AIGC 生成任务。
  - **回填步骤 (POST-EXECUTE)**: 任务完成后自动回填 `tasks.latest` 至对应的 YAML 文件。

- **`mangou storyboard split --path [yaml_path]`**: FFmpeg 宫格切分。

## 2. 设计原则 (Core Pillars)

### 1. 指令层次化
遵循 `mangou <resource> <action>`，逻辑清晰。

### 2. 参数透明性
CLI 仅负责将 YAML 中的“物理路径”转化为 API 的“网络输入”。

### 3. 本地化寻址
所有引用的路径均应相对于项目根目录，避免全局 ID 查找带来的二义性。

### 4. 自动回填
CLI 工具成功运行后，必须确保文件系统中的 YAML 是“最终态”，包含完整的审计回填信息。
