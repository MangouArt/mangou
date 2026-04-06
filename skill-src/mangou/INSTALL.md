# Mangou Installation

## Install order

优先按下面顺序安装：

1. 安装 skill 入口
2. 需要生成任务时安装 Bun runtime
3. 需要本地只读页面时安装 dashboard

## 1. Install the skill

推荐方式：

```bash
npx skills add MangouArt/mangou-ai-motion-comics -a claude-code -y
```

如果你在本地开发 `mangou` 主仓库，也可以改用：

```bash
npx skills add ./skill-src/mangou --agent claude-code
```

如果当前 agent 不走 `vercel-labs/skills`，再使用基础 zip：

```text
https://www.mangou.art/downloads/mangou.zip
```

## 2. Install Bun runtime

- runtime 包：`https://www.mangou.art/downloads/mangou-runtime.zip`
- 自动安装脚本：`node bootstrap-runtime.mjs`

## When runtime is required

只有在下面这些场景才需要 `mangou-runtime.zip`：

- 运行 `bun run src/main.ts ...`
- 启动本地 dashboard / mirror server
- 使用 `workspace_template/`

只读知识库或让 Agent 先规划 YAML 时，基础技能包通常够用。

## Runtime install steps

1. 先确保 skill 已安装
2. 先确认当前技能根目录实际位置，再继续
3. 优先在技能根目录执行 `node bootstrap-runtime.mjs`
4. 如果 bootstrap 不可用，再手动下载 `mangou-runtime.zip`
5. 把 `mangou-runtime.zip` 解压后的内容合并到技能根目录，与 `SKILL.md` 同级
6. 确认技能根目录至少包含这些内容：

```text
<skill-root>/
  SKILL.md
  INSTALL.md
  COMMANDS.md
  knowledge/
  src/
  workspace_template/
```

如果仍然没有 `src/main.ts`，说明 runtime 还没合并成功，不要继续执行 Bun 命令。

## Bootstrap notes

- `bootstrap-runtime.mjs` 会下载 `mangou-runtime.zip` 并自动合并到当前技能根目录。
- 该脚本依赖 `node`，并且解压阶段需要 `python3` 或 `unzip`。
- 如果下载地址需要切换，可设置环境变量 `MANGOU_RUNTIME_URL`。

## 3. Install dashboard

dashboard 将作为独立 npm 包发布，不并入基础 skill 包本体。

目标安装方式：

```bash
npx @mangou/dashboard
```

或：

```bash
npm install -g @mangou/dashboard
```

在 dashboard npm 包正式发布前，不要假设安装了 skill 就自动拥有 dashboard。

## Runtime requirements

- `bun`
- `ffmpeg`
- `ffprobe`

如果缺这些依赖，不要继续执行生成命令。
