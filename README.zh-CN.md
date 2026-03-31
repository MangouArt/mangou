# Mangou AI Studio

[English](./README.md)

Mangou 是一个面向本地 Agent 工作流的 AI 漫剧工作台。

它把项目初始化、YAML 组织、任务追踪、本地可视化、图片生成、视频拼接收敛成一套可安装的 `SKILL + scripts + web` 组合，方便你在自己的工作区里持续创作和自动化执行。

官网：`https://www.mangou.art`

## 许可证

本项目采用 [`FSL-1.1-Apache-2.0`](./LICENSE)。

这意味着：

- 源码可见、可修改、可分发
- 不允许直接拿去做竞争性 SaaS 商用托管
- 到变更日期后自动转为 Apache-2.0

如果你需要商业合作或授权咨询，请联系 `business@mangou.art`。

## 核心能力

- 初始化本地 Mangou 工作区
- 创建项目与标准目录结构
- 维护 `tasks.jsonl` 作为任务真相源
- 启动本地 Web 可视化服务
- 基于 YAML 生成图片或视频
- 将分镜素材拼接成最终视频

## 适用场景

- 你有自己的 code agent，并且它支持安装或调用本地 `SKILL`
- 你希望在本地目录里管理漫剧项目，而不是依赖数据库后台
- 你需要一个可追踪、可回放、可脚本化的 AIGC 工作流

## 环境要求

- Node.js `>= 18.18`
- npm `>= 9`
- `ffmpeg` 可执行文件在系统 PATH 中
- 至少一套可用的 AIGC 提供商配置

## 快速开始

如果你使用的是支持工具调用、能够执行本地脚本的 Agent，你可以直接将以下指令复制并发送给 AI：

```text
下载技能包：https://www.mangou.art/downloads/mangou.zip 
请帮我安装并配置 Mangou AI 漫剧导演插件。
```

AI 会自动帮你完成下载、解压和工作区安装。

## 开发者指南

如果你是开发者，希望深入修改源码或手动构建，请参考以下步骤：

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

按需填写你的模型服务配置。默认示例文件不会包含真实密钥。
如果你使用 BLTAI，请在 `.env.local` 中设置 `BLTAI_API_KEY`。详细注册和取 token 流程统一写在 [`knowledge/assets.md`](./skill-src/mangou/knowledge/assets.md)。

### 3. 构建技能包

```bash
npm run build
npm run build:skill
```

构建后会得到：

- 目录版 skill：`bundled-skills/mangou/`
- 压缩包：`bundled-skills/mangou.zip`

### 4. 安装到你的 agent skill 目录

Mangou 不强绑定某个特定 agent。只要你的 agent 支持“目录形式的本地 skill”，把 `bundled-skills/mangou/` 安装到对应技能目录即可。

常见做法示例：

```bash
mkdir -p /absolute/path/to/your-workspace/.claude/skills
cp -R bundled-skills/mangou /absolute/path/to/your-workspace/.claude/skills/
```

如果你的 agent 支持 zip 包安装，也可以直接使用 `bundled-skills/mangou.zip`。

### 5. 初始化工作区

```bash
node .claude/skills/mangou/scripts/init-workspace.mjs --workspace .
```

### 6. 创建项目

```bash
node .claude/skills/mangou/scripts/create-project.mjs \
  --workspace . \
  --project demo \
  --name "Demo Project"
```

### 7. 启动本地可视化服务

```bash
node .claude/skills/mangou/scripts/start-web.mjs --workspace . --port 3000
```

访问：`http://localhost:3000`

## 工作区结构

```text
<workspace>/
  .mangou/
  config.json
  projects.json
  projects/
    <projectId>/
      project.json
      tasks.jsonl
      storyboards/
      asset_defs/
      assets/
```

说明：

- `tasks.jsonl` 是任务状态唯一真相源
- `storyboards/` 与 `asset_defs/` 存放 YAML 定义
- `assets/` 存放生成产物
- `projects.json` 只保存项目索引

## 常用命令

```bash
# 开发前端
npm run dev

# 类型检查
npm run typecheck

# 运行测试
npm test

# 构建前端与 skill
npm run build
npm run build:skill

# 一次跑完发布前校验
npm run ci
```

## 脚本入口

构建后的 skill 目录里包含这些核心脚本：

- `init-workspace.mjs`
- `create-project.mjs`
- `start-web.mjs`
- `stop-web.mjs`
- `web-status.mjs`
- `agent-generate.mjs`
- `agent-stitch.mjs`
- `split-grid.mjs`

它们的职责边界很明确：

- 脚本负责初始化、启动服务、调用上游、写入任务状态
- Web 负责展示与只读 API
- Agent 负责组织参数、修改 YAML、调用脚本

## 发布物

当前推荐的分发物是：

- `bundled-skills/mangou.zip`

适合直接提供给支持本地技能安装的 agent 环境。

## 安全说明

- 不要提交 `.env.local`
- 不要把真实 API Key 打进截图、日志或压缩包
- 如需报告安全问题，请查看 [`SECURITY.md`](./SECURITY.md)

## 贡献与支持

- 贡献流程：[`CONTRIBUTING.md`](./CONTRIBUTING.md)
- 行为准则：[`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- 安全策略：[`SECURITY.md`](./SECURITY.md)
- 变更记录：[`CHANGELOG.md`](./CHANGELOG.md)

问题反馈请提交 GitHub Issue：

- `https://github.com/MangouArt/mangou/issues`

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=MangouArt/mangou&type=Date)](https://star-history.com/#MangouArt/mangou&Date)
