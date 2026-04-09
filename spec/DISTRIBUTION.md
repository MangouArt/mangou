# Mangou Distribution Specification

Mangou 的分发必须统一遵守 **“单一内容源，三种安装入口”** 的原则。不要为 SkillHub、zip、npm 维护三套不同内容。

## 1. 单一真相源 (SSOT)

Mangou 的编辑源只允许来自以下三类目录：

- `skill-src/mangou/`
  - 技能入口与知识文件。
- `src/`
  - Bun CLI runtime 与生成逻辑。
- `packages/dashboard/`
  - dashboard npm 包源码与启动入口。

`bundled-skills/` 只是构建产物，绝不能作为编辑源。
`skills/` 与 `skill-repos/` 不再保留在主仓库中。
主仓库根目录也不再保留 `SKILL.md` 软链接或兼容副本。
仓库根 `dist/` 只是 dashboard 的构建输出，不是编辑源。

## 2. 三层产物模型

### 2.1 Skill Layer

职责：让 Agent 发现并激活 Mangou。

内容：
- `SKILL.md`
- `INSTALL.md`
- `COMMANDS.md`
- `knowledge/`
- 必要的 bootstrap / doctor 脚本

约束：
- 必须保持轻量，可被 `vercel-labs/skills` 直接复制或软链接安装。
- 不允许把完整 runtime 源码和 dashboard 全量塞进 skill 根目录。

### 2.2 Runtime Layer

职责：执行真正有副作用的本地能力。

内容：
- Bun CLI (`src/main.ts` 及其依赖)
- `workspace_template/`
- 本地任务执行逻辑
- ffmpeg / provider / backfill 相关运行时能力

约束：
- CLI 继续保持 Bun 脚本形态。
- 不要求先改造成 Node CLI。
- runtime 可以通过独立压缩包分发。

### 2.3 Dashboard Layer

职责：提供只读可视化页面。

内容：
- dashboard 前端静态产物
- 独立 npm 包启动入口

约束：
- dashboard 必须可以独立安装与升级。
- dashboard 不是 skill 入口的一部分。
- dashboard 不负责生成任务，不替代 Bun CLI。

## 3. 安装入口职责

### 3.1 `vercel-labs/skills`

目标：让 Mangou 被标准 skills 安装器直接安装。

必须满足：
- 独立轻量 skill 仓库 `MangouArt/mangou-ai-motion-comics` 的仓库根就是 skill 根目录
- 该目录安装后即可被 Agent 识别
- skill 内的说明必须清楚区分：
  - 这是技能入口
  - 真正执行生成任务需要 Bun runtime
  - dashboard 需要单独安装 npm 包

安装结果：
- `vercel-labs/skills` 负责把 skill 目录安装到 agent 的 skills 路径
- Mangou 不要求 `vercel-labs/skills` 负责安装完整 runtime

### 3.2 zip 包

目标：给不走 `vercel-labs/skills` 的环境提供手动安装。

必须保留两类产物：
- `mangou.zip`
  - 基础 skill 包
- `mangou-runtime.zip`
  - Bun runtime 资源包

约束：
- `mangou.zip` 必须与 `vercel-labs/skills` 安装的 skill 内容保持同构
- `mangou-runtime.zip` 只承载 runtime，不重复打包 skill 文档

### 3.3 npm 包

目标：单独分发 dashboard 页面。

包定位：
- 推荐包名：`@mangou/dashboard`

职责：
- 安装本地 dashboard
- 提供统一启动命令
- 允许独立升级 dashboard 前端

明确不负责：
- 不负责安装 `SKILL.md`
- 不负责替代 Bun CLI
- 不负责取代 `vercel-labs/skills`

## 4. 目标安装模型

### 4.1 Agent 技能安装

优先路径：

```bash
npx skills add MangouArt/mangou-ai-motion-comics -a claude-code -y
```

结果：
- 安装 skill 入口
- Agent 可以读取 `SKILL.md`、`INSTALL.md`、`COMMANDS.md`
- 若用户只需要技能说明，不需要额外 runtime

开发态本地安装：

```bash
npx skills add ./skill-src/mangou --agent claude-code
```

约束：
- 不要把 `skills add` 指向主 `mangou` 仓库根目录；当前安装器会把整个仓库复制进 agent skill 目录。
- GitHub 分发只使用轻量仓库 `MangouArt/mangou-ai-motion-comics`。

### 4.2 完整本地运行

当用户需要执行下列动作时，必须安装 Bun runtime：

- `mangou project init`
- `mangou storyboard generate`
- `mangou storyboard split`
- `mangou asset generate`
- `mangou project stitch`
- 启动本地 mirror / server

安装来源：
- 手动下载 `mangou-runtime.zip`
- 或由 skill 内 bootstrap 流程引导安装

### 4.3 Dashboard 可视化

当用户需要本地只读页面时，安装独立 dashboard npm 包：

```bash
npx @mangou/dashboard
```

或：

```bash
npm install -g @mangou/dashboard
```

结果：
- 启动本地 dashboard
- dashboard 只负责观察，不负责生成任务

## 5. 目录与构建要求

### 5.1 仓库目录目标态

```text
mangou/
├── skill-src/mangou/              # SSOT: 技能入口
├── src/                           # Bun runtime
├── packages/dashboard/            # dashboard npm 包源码
├── dist/                          # dashboard 构建产物 (不手改)
├── bundled-skills/
│   ├── mangou.zip
│   └── mangou-runtime.zip
```

### 5.2 构建职责

- `build:skill`
  - 产出 `mangou.zip`
  - 产出 `mangou-runtime.zip`
  - 只负责 `mangou` 单仓内构建，不负责跨仓同步
- `build`
  - 产出仓库根 `dist/` 前端构建产物
- `build:dashboard:package`
  - 同步 dashboard npm 包需要的 `packages/dashboard/dist`
- `build:dashboard`
  - 串起 dashboard 构建与 npm 包同步
 - `Mango` 母仓脚本 `npm run mangou:sync-skill`
  - 负责调用 `mangou` 的 `build:skill`
  - 负责把构建后的 skill 内容镜像同步到 `../mangou-ai-motion-comics`

## 6. 约束与非目标

### 6.1 约束

- 不为 npm 维护另一套专用 skill 文档
- 不让 zip 成为新的编辑源
- 不把 dashboard npm 包误写成完整 runtime 安装器
- 不要求先把 Bun CLI 全量重写成 Node CLI

### 6.2 非目标

- 本阶段不要求 npm 包负责安装完整 skill
- 本阶段不要求 `vercel-labs/skills` 自动安装 Bun runtime
- 本阶段不要求把 `mangou-runtime.zip` 废弃

## 7. 实施顺序

1. 维护 `skill-src/mangou/` 作为唯一 skill 文档源。
2. 独立维护 `MangouArt/mangou-ai-motion-comics` 轻量 skill 仓库。
3. 调整 `SKILL.md` / `INSTALL.md`，把安装说明改成：
   - 先装 skill
   - 需要生成时再装 runtime
   - 需要可视化时再装 dashboard npm 包
4. 新建 `@mangou/dashboard` 包，提供独立启动命令。
5. 保持 `mangou-runtime.zip` 继续承载 Bun runtime。
6. 文档与站点统一改成这套口径。
