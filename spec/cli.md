# 单入口 CLI 规范（初版）

## 目标
- 对外统一为单一入口 `scripts/mangou.mjs`。
- Agent 只需要记住一个命令，不需要分辨多个脚本名。
- 内部实现继续保持模块化，不把所有逻辑塞进一个文件。

## 命令树
CLI 采用两级命令树，类似 `aws <domain> <action>`：

```text
mangou workspace init
mangou project create
mangou web start
mangou web stop
mangou web status
mangou generate image <yaml>
mangou generate video <yaml>
mangou stitch <projectRoot?>
mangou grid split <parentYaml>
```

## 全局参数
- `--workspace <path>`：工作区根目录。
- `--project <path|id>`：项目根目录或项目 ID。仅在对应命令需要时使用。
- `--provider <id>`：生成命令显式指定 provider。
- `--json`：输出稳定 JSON，供 Agent 或脚本消费。
- `--verbose`：输出额外日志。

未使用的全局参数不得隐式传给不相关子命令。

## 子命令行为

### `workspace init`
- 调用 `init-workspace.mjs` 的核心实现。
- 默认工作目录为当前目录，`--workspace` 可覆盖。

### `project create`
- 调用 `create-project.mjs` 的核心实现。
- 保留既有参数：
  - `--workspace`
  - `--project`
  - `--name`
  - `--description`

### `web start|stop|status`
- 分别调用 `web-control.mjs` 暴露的对应实现。
- `web start` 支持 `--port`。

### `generate image|video <yaml>`
- `image|video` 是 `generate` 的二级动作，不再与 `<yaml>` 平铺。
- 最终仍调用 `agent-generate.mjs` 的核心实现。
- 参数保持兼容：
  - `--workspace`
  - `--project`
  - `--provider`
  - `--debug`

### `stitch <projectRoot?>`
- 调用 `agent-stitch.mjs` 的核心实现。
- 当显式提供 `<projectRoot>` 时优先使用该路径。
- 未提供时允许维持当前“从 CWD 推断项目根目录”的兼容行为。

### `grid split <parentYaml>`
- 调用 `split-grid.mjs` 的核心实现。
- 保留现有参数：
  - `--grid`
  - `--targets`
  - `--project-root`
  - `--workspace-root`

## 错误处理
- 未知命令必须直接失败，并输出简明 usage。
- 缺失必需参数必须失败，并输出对应子命令的 usage。
- `--json` 模式下，失败输出必须为：

```json
{ "success": false, "error": "..." }
```

## 暴露策略
- Skill 对外只暴露 `scripts/mangou.mjs` 作为命令入口。
- `SKILL.md`、示例命令、`package.json` scripts 必须统一推荐 `scripts/mangou.mjs`。
- 其余脚本只作为内部模块或仓库内开发实现存在，不属于 skill 的公开调用面。

## 非目标
- 不把所有脚本内容合并到一个 God Script。
- 不引入复杂 CLI 框架。
- 不改变现有底层模块的职责边界。
