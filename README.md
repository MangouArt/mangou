# Mangou AI Studio

[中文版本](./README.zh-CN.md)

Mangou is an AI comic production workspace for local agent workflows.

It packages project bootstrapping, YAML organization, task tracking, local visualization, image generation, and video stitching into an installable `SKILL + scripts + web` bundle for repeatable creation inside your own workspace.

Website: `https://www.mangou.art`

## License

This project is released under [`FSL-1.1-Apache-2.0`](./LICENSE).

That means:

- Source code is visible, modifiable, and redistributable
- Competitive SaaS commercial hosting is not allowed
- The license automatically converts to Apache-2.0 on the change date

For commercial partnerships or licensing questions, contact `business@mangou.art`.

## What Mangou Does

- Initialize a local Mangou workspace
- Create projects with a standard directory structure
- Maintain `tasks.jsonl` as the task source of truth
- Run a local web UI for inspection and control
- Generate images or videos from YAML definitions
- Stitch scene outputs into final videos

## Who It Is For

- Teams or individuals using a code agent that can install or call local `SKILL`s
- Creators who want project state stored in local files instead of a hosted backend
- Workflows that need an auditable, replayable, scriptable AIGC pipeline

## Requirements

- Node.js `>= 18.18`
- npm `>= 9`
- `ffmpeg` available in your system `PATH`
- At least one configured AIGC provider

## Quick Start

If you are using an Agent capable of running tools and shell commands, just copy & paste the following prompt to your AI:

```text
下载技能包：https://www.mangou.art/downloads/mangou.zip 
请帮我安装并配置 Mangou AI 漫剧导演插件。
```

*(This prompt is kept in Chinese to ensure the AI uses the correct paths, but you can interact with it in English afterwards. The AI will download, extract, and configure everything automatically).*

## For Developers

If you want to hack on the source code or build the skill manually, follow these steps:

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in your provider settings as needed. The example file does not include real keys.
If you use BLTAI, set `BLTAI_API_KEY` in `.env.local`. The detailed signup and token flow is documented in [`knowledge/assets.md`](./skill-src/mangou/knowledge/assets.md).

### 3. Build the skill bundle

```bash
npm run build
npm run build:skill
```

Build outputs:

- Directory bundle: `bundled-skills/mangou/`
- Zip bundle: `bundled-skills/mangou.zip`

### 4. Install into your agent skill directory

Mangou does not depend on a single agent vendor. If your agent supports local directory-based skills, copy `bundled-skills/mangou/` into the corresponding skill directory.

Example:

```bash
mkdir -p /absolute/path/to/your-workspace/.claude/skills
cp -R bundled-skills/mangou /absolute/path/to/your-workspace/.claude/skills/
```

If your agent supports zip installation, you can also use `bundled-skills/mangou.zip`.

### 5. Initialize a workspace

```bash
node .claude/skills/mangou/scripts/init-workspace.mjs --workspace .
```

### 6. Create a project

```bash
node .claude/skills/mangou/scripts/create-project.mjs \
  --workspace . \
  --project demo \
  --name "Demo Project"
```

### 7. Start the local web UI

```bash
node .claude/skills/mangou/scripts/start-web.mjs --workspace . --port 3000
```

Open `http://localhost:3000`.

## Workspace Layout

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

Notes:

- `tasks.jsonl` is the single source of truth for task state
- `storyboards/` and `asset_defs/` store YAML definitions
- `assets/` stores generated outputs
- `projects.json` stores only the project index

## Common Commands

```bash
# Frontend development
npm run dev

# Type checking
npm run typecheck

# Test suite
npm test

# Build frontend and skill bundle
npm run build
npm run build:skill

# Full pre-release verification
npm run ci
```

## Script Entrypoints

The built skill contains these core scripts:

- `init-workspace.mjs`
- `create-project.mjs`
- `start-web.mjs`
- `stop-web.mjs`
- `web-status.mjs`
- `agent-generate.mjs`
- `agent-stitch.mjs`
- `split-grid.mjs`

Responsibilities are intentionally split:

- Scripts initialize the workspace, start services, call upstream APIs, and persist task state
- The web layer provides visualization and read-only APIs
- The agent edits YAML, assembles parameters, and invokes scripts

## Distribution

Recommended release artifact:

- `bundled-skills/mangou.zip`

This is the bundle intended for agents that support local skill installation.

## Security

- Do not commit `.env.local`
- Do not leak real API keys into screenshots, logs, or release archives
- For vulnerability reports, see [`SECURITY.md`](./SECURITY.md)

## Contributing And Support

- Contribution guide: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Code of conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- Security policy: [`SECURITY.md`](./SECURITY.md)
- Changelog: [`CHANGELOG.md`](./CHANGELOG.md)

Issue tracker:

- `https://github.com/MangouArt/mangou/issues`

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=MangouArt/mangou&type=Date)](https://star-history.com/#MangouArt/mangou&Date)
