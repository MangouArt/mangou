# Mangou Readonly Viewer Refactor Plan

## 目标

- 将 dashboard 收敛为真正的只读可视化 viewer。
- 保留 Agent 侧单一 CLI 入口，避免让 Agent 自行拼装执行链路。
- 删除已经失效的任务管理 / 提交 / 审阅交互。
- 用更简单的事件批处理替代 `useVFS` 轮询兜底。

## 决策

### 1. tasks.jsonl

- 统一只保留 `scripts/tasks-jsonl.mjs` 这一套实现。
- 所有任务函数都以 `projectRoot` 为入参。
- `task id` 基于 `type + provider + input + ref` 的稳定序列化结果生成。
- 更新事件复用同一个稳定 `task id`。
- 提交态事件若命中已存在任务，拒绝重复提交。

### 2. dashboard

- 删除分镜/资产的生成确认、参数表单、任务弹窗、历史记录依赖。
- `StoryboardDetail` 和 `ResourcePanel` 只保留当前 YAML 投影结果的展示能力。
- 删除 store 中与“导演 agent 控制台”相关但 viewer 不再使用的状态。

### 3. agent-generate

- 拆分内部模块，但保留单一 CLI 入口 `scripts/agent-generate.mjs`。
- Agent 仍然只调用 CLI，不需要自行组合内部模块。
- 内部模块只服务 CLI 编排，不暴露给 Agent 作为操作接口。

### 4. http server

- 收敛为只读可视化服务。
- 删除任务相关 API 与 YAML latest 回填 API。
- 保留项目、VFS、SSE、静态资源、meta 等 viewer 所需接口。

### 5. useVFS

- 删除 `setInterval` 轮询兜底。
- 改为 VFS 事件触发后的单次批处理刷新。
- 由 hook 内部统一合并短时间多次变更，避免 UI 抖动。

## 执行顺序

1. 收敛 `tasks.jsonl` 实现。
2. 删除 dashboard 提交/任务/历史交互。
3. 收缩 store 与无用 hook/API。
4. 模块化 `agent-generate`，保留单一 CLI 入口。
5. 精简 `http-server` 到只读 viewer。
6. 用事件批处理重写 `useVFS` 刷新。
7. 跑测试与类型检查，修正回归。
