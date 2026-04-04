# 🎬 Mangou AI Comic Director Plugin

[中文版本](./README.zh-CN.md) | 🌐 [www.mangou.art](https://www.mangou.art)

**Mangou** is a powerful plugin (skill bundle) for AI Agents (like Cursor, Claude Desktop, Cline) that transforms your local workspace into a fully automated AI Comic production studio.

Instead of wrestling with complex UIs online, you simply ask your AI assistant to generate characters, design storyboards, and stitch videos together. Mangou handles the heavy lifting by injecting local workflow tools directly into your Agent's toolkit.

## ✨ What Mangou Empowers Your Agent To Do

- **Local Projects:** Automatically bootstrap standardized comic project directories in your workspace.
- **YAML Driven:** Organize characters, props, scenes, and storyboards as simple YAML files that your Agent can easily read and write.
- **Visual Dashboard:** Launch a real-time local Web UI for you to inspect the Agent's Generation progress.
- **AIGC Generation:** Equip your Agent with the ability to call scripts for rendering images and videos automatically.
- **Video Stitching:** Let your Agent stitch all the generated scene clips into a final comic video.

## 📄 License

This project is released under [`FSL-1.1-Apache-2.0`](./LICENSE).

That means:
- Source code is visible, modifiable, and redistributable.
- Competitive SaaS commercial hosting is not allowed.
- The license automatically converts to Apache-2.0 on the change date.

For commercial partnerships or licensing questions, contact `business@mangou.art`.

## Who It Is For

- Teams or individuals using a code agent that can install or call local `SKILL`s
- Creators who want project state stored in local files instead of a hosted backend
- Workflows that need an auditable, replayable, scriptable AIGC pipeline

## Requirements

- Bun `>= 1.1`
- `ffmpeg` available in your system `PATH`
- At least one configured AIGC provider

## Quick Start

If you are using an Agent capable of running tools and shell commands, just copy & paste the following prompt to your AI:

```text
Download skill package: https://www.mangou.art/downloads/mangou.zip 
Please install and set up the Mangou AI Comic Director skill for me.
```

*(The AI will download, extract, and configure everything automatically).*

## For Developers

If you want to hack on the source code or build the skill manually, follow these steps:

### 1. Install dependencies

```bash
bun install
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
bun run mangou -- workspace init --workspace .
```

### 6. Create a project

```bash
bun run mangou -- project create \
  --workspace . \
  --project demo \
  --name "Demo Project"
```

### 7. Start the local web UI

```bash
bun run mangou -- web start --workspace . --port 3000
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
bun run dev

# Type checking
bun run typecheck

# Test suite
bun test

# Build frontend and skill bundle
bun run build
bun run build:skill

# Full pre-release verification
bun run ci
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

<a href="https://www.star-history.com/?repos=MangouArt%2Fmangou&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=MangouArt/mangou&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=MangouArt/mangou&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=MangouArt/mangou&type=date&legend=top-left" />
 </picture>
</a>
