# Mangou Architecture (KISS - Three Pillars)

Mangou 采用 **“以文件系统为总线，以 YAML 为契约”** 的架构。系统由三个互不依赖、各司其职的独立角色组成。

## 1. 角色职责与边界

### Agent (Creative Architect - 创意架构师)
Agent 是系统的最高决策者，它是唯一的“逻辑灵魂”。
- **核心职责**：
  - **结构化设计**：初始化项目目录，规划分镜层级。
  - **创意生产**：直接读写 YAML 文件，编写 Prompt、剧本、资产描述。
  - **任务编排**：决定何时调用 CLI（如 `mangou storyboard generate`），并根据 YAML 状态决定后续步骤。
- **操作边界**：
  - Agent 拥有 YAML 中 `meta`, `content`, `refs` 部分的绝对控制权。
  - 它通过读写磁盘上的物理 YAML 文件与系统其他部分交互。
  - **执行序列**：Agent 修改文件 -> Agent 启动 CLI 任务。

### CLI Tools (Automated Workers - 自动化工人)
CLI 是带有“副作用”的确定性处理器，负责执行耗时、重复、技术性的任务。
- **核心职责**：
  - **任务闭环 (Action & Backfill)**：读取指定的 YAML -> 解析其中的 `provider` 和 `params` -> 调用 AIGC API 或 FFmpeg -> 下载/处理媒体文件 -> **自动将执行结果（状态、本地相对路径、审计信息）写回该 YAML 的 `tasks` 模块**。
  - **原子化操作**：遵循 `mangou <resource> <action>` 格式，保持每个命令的独立性。
- **操作边界**：
  - CLI 只被允许修改 YAML 中的 `tasks` 模块及其子项。
  - 严禁修改 `content` 和 `refs` 模块，以防覆盖 Agent 的创意。
  - 必须通过 `.env` 文件加载 API Keys，严禁将秘钥写入 YAML。

### WEB (Live Mirror - 实时观察镜)
WEB 是一个纯粹的、只读的可视化投影，用于展示系统的当前物理状态。
- **核心职责**：
  - **文件审计**：实时监听 (fs.watch) 项目目录下所有 YAML 和媒体文件的变动。
  - **数据热推送 (SSE)**：一旦文件变化，自动解析 YAML 并通过 SSE 将最新的数据快照推送至浏览器。
  - **只读可视化**：不提供编辑/保存功能。它仅仅是为了让人类直观地看到 Agent 和 CLI 的工作进展。
- **操作边界**：
  - WEB 对文件系统没有任何写权限。
  - 它只是一个“监控器”，将磁盘上的数据“翻译”为 UI。

## 2. 交互契约：物理文件系统 (The File System Bus)

- **唯一真理源**：磁盘上的 YAML 文件是唯一的系统状态。不存在内存中的“全局 Store”。
- **路径基准**：YAML 中引用的所有路径（如图片路径、资产引用）必须相对于 **项目根目录 (Project Root)**。
- **资产语法糖**：
  - `storyboard` 可以引用 `asset_defs/` 下的 YAML 路径。
  - CLI 在运行时应自动读取该 YAML 中的图片作为 AIGC 输入。
- **零耦合通信**：
  - Agent -> CLI: 通过命令行调用，并传递物理路径参数。
  - CLI -> Agent: 通过更新 YAML 文件状态完成任务反馈。
  - 文件系统 -> WEB: 通过文件变化事件触发 UI 更新。
