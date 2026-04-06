# Mangou Installation

## Packages

- 基础技能包：`https://www.mangou.art/downloads/mangou.zip`
- runtime 包：`https://www.mangou.art/downloads/mangou-runtime.zip`

## When runtime is required

只有在下面这些场景才需要 `mangou-runtime.zip`：

- 运行 `bun run src/main.ts ...`
- 启动本地 dashboard / mirror server
- 使用 `workspace_template/`

只读知识库或让 Agent 先规划 YAML 时，基础技能包通常够用。

## Install steps

1. 安装 `mangou.zip`
2. 需要执行 CLI 或 dashboard 时，再下载 `mangou-runtime.zip`
3. 把 `mangou-runtime.zip` 解压后的内容合并到技能根目录，与 `SKILL.md` 同级
4. 确认技能根目录至少包含这些内容：

```text
<skill-root>/
  SKILL.md
  INSTALL.md
  COMMANDS.md
  knowledge/
  src/
  workspace_template/
  dist/
```

## Runtime requirements

- `bun`
- `ffmpeg`
- `ffprobe`

如果缺这些依赖，不要继续执行生成命令。
