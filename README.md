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

## Installation Model

Mangou uses three separate install surfaces:

- **Skill:** installed into your agent via `vercel-labs/skills` or `mangou.zip`
- **Runtime:** installed separately from `mangou-runtime.zip` when you need Bun CLI execution
- **Dashboard:** shipped as a standalone npm package

This keeps the skill lightweight enough for agent installers while preserving the full local runtime.

Repository rule:

- `skill-src/mangou/` is the only skill-document source inside this repository.
- `packages/dashboard/` is the only dashboard package source inside this repository.
- The repository-root `dist/` directory is build output only.
- The repository root no longer carries a `SKILL.md` shim or symlink.
- The short GitHub install path lives in `MangouArt/mangou-ai-motion-comics`.

## Quick Start

If you are using an Agent capable of running tools and shell commands, just copy & paste the following prompt to your AI:

```text
Install Mangou from the lightweight skill repo with npx skills.
If I need to generate assets or videos, install mangou-runtime.zip too.
```

Manual fallback:

```text
https://www.mangou.art/downloads/mangou.zip
https://www.mangou.art/downloads/mangou-runtime.zip
```

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
If you use BLTAI, set `BLTAI_API_KEY` in `.env.local`. Detailed signup and token flows are documented in:
- **JieKou AI (Recommended)**: [`knowledge/provider-jiekou.md`](./skill-src/mangou/knowledge/provider-jiekou.md)
- **KIE AI**: [`knowledge/provider-kie.md`](./skill-src/mangou/knowledge/provider-kie.md)
- **BLTAI**: [`knowledge/provider-bltai.md`](./skill-src/mangou/knowledge/provider-bltai.md)

### 3. Build the skill bundle

```bash
npm run build
npm run build:skill
```

Build outputs:

- Zip bundle: `bundled-skills/mangou.zip`
- Unified runtime bundle: `bundled-skills/mangou-runtime.zip`

### 4. Install into your agent skill directory

Preferred:

```bash
npx skills add MangouArt/mangou-ai-motion-comics -a claude-code -y
```

Local development fallback:

```bash
npx skills add ./skill-src/mangou --agent claude-code
```

Fallback:

- Install `bundled-skills/mangou.zip` as the base skill
- Merge `bundled-skills/mangou-runtime.zip` into the same skill root when you need Bun CLI execution

### 5. Install dashboard separately

The local read-only dashboard is not part of the base skill package anymore.

Target install model:

```bash
npx @mangou/dashboard
```

### 6. Quick Start (CLI)

All commands are unified at the `src/main.ts` entry point. Usage is identical in both development and skill environments:

```bash
# Initialize project
bun run src/main.ts project init --name my-story

# Create content
bun run src/main.ts storyboard generate --path storyboards/shot1.yaml --type image

# Enable Visual Mirror
bun run src/main.ts server start --port 3000
```

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

## CLI Commands

The built skill follows a resource-action pattern:

- `project init`: Initialize a new project directory.
- `project stitch`: Assemble storyboard clips into a final video.
- `storyboard generate`: Render images or videos for a specific storyboard YAML.
- `storyboard split`: Physically split a grid storyboard image.
- `asset generate`: Render an asset image.
- `server start`: Launch the local visualization server.

Responsibilities are intentionally split:

- CLI commands manage the workspace, invoke AIGC APIs, and persist task state.
- The web layer provides real-time visualization.
- The agent (director) edits YAML, assembles parameters, and triggers CLI tasks.

## Distribution

Recommended release artifact:

- `bundled-skills/mangou.zip`
- `bundled-skills/mangou-runtime.zip`
- `MangouArt/mangou-ai-motion-comics`

Use `MangouArt/mangou-ai-motion-comics` as the standalone lightweight repo for the short GitHub install path.
In the main `mangou` repository, use `skill-src/mangou/` directly for local `npx skills add` testing.
Do not point `skills add` at the repository root, or the installer may copy the entire repo into the agent skill directory.
Use `mangou.zip` as the canonical fallback base skill package.
Download `mangou-runtime.zip` separately when you need Bun CLI and workspace templates.

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
