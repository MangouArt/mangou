# 资产管理 (Asset Management)

## 默认 Provider 配置 (Default Provider Setup)
- **默认提供商**：当前默认图片/视频生成提供商是 `BLTAI`。
- **账号注册**：先访问 `https://api.bltcy.ai/` 注册账号。
- **获取密钥**：再打开 `https://api.bltcy.ai/token`，创建或复制一个形如 `sk-xxxx` 的 API Key。
- **环境变量**：将密钥写入工作区根目录的 `.env.local`：

```env
BLTAI_API_KEY=sk-xxxx
BLTAI_BASE_URL=https://api.bltcy.ai
```

- **执行前检查**：如果 `BLTAI_API_KEY` 为空，Agent 应先提示用户完成配置，再执行 `agent-generate.mjs`。

## 资产 YAML 回填规范 (Asset Back-fill)
- **回填真相源**：生成的资产图（角色基准、场景背景、关键道具）必须及时同步回填到 `asset_defs/` 目录下的 YAML 文件中。
- **YAML 字段更新**：在 `tasks.image.latest` 中记录 `status: success` 和 `output.files` 路径。
- **引用关系**：后续分镜引用这些资产图时，路径应为 `projects/<projectId>/assets/images/...`。

## AIGC 提供商扩展接口 (Provider Extension)
- **标准接口规范**：所有 AIGC 任务均通过 Provider 接口处理。
- **核心方法**：
    - `buildPayload`：从任务参数（Prompt, Images 等）构建特定 Provider 的请求体。
    - `submit`：提交生成任务，返回 `upstream_task_id`。
    - `poll`：周期性轮询任务状态。
    - `extractOutputs`：任务完成后，将 Provider 返回的产物（URL 或 base64）保存为本地文件。
- **Provider 实例**：目前已内置了 `BLTAI`（默认）等提供商。后续如需接入 Midjourney, Stable Diffusion 等新渠道，只需实现上述接口并注册到 Registry。
- **YAML 联动引用**：在 `tasks.image.params.images` 中，支持直接填入资产 YAML 路径（例如 `projects/demo/asset_defs/chars/hero.yaml`）。脚本会自动递归解析该 YAML，提取其 `latest.output` 图片路径。
