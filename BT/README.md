# BASE-TEMPLATE

<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>

A reusable **agent-driven UI/UX vibe coding** starter. Use it as the foundation every time you start a new frontend project with AI coding agents.

**Recommended: [Claude Code](https://docs.anthropic.com/en/docs/claude-code)** — but works with a variety of AI coding agents.

## How to use this template (quickstart)

1. **Copy this template** into a new repo or folder for your project.
2. **Install dependencies:** `npm install`
3. **Fill project docs** (replace every `{{PLACEHOLDER}}`):
   - `docs/project-brief.md` — goals, audience, brand, constraints
   - `docs/design-system.md` — colors, type, spacing, components
4. **Start the app:** `npm run dev`
5. **Start your AI agent** and point it at `AGENTS.md` (most agents pick it up automatically).
6. **Follow** `docs/workflows.md`: plan → design → build → review → iterate.
7. **Add skills later** under `skills/` when you have them.

> Using a different agent? Open `AGENTS.md` for project instructions — most agents pick it up automatically.

## Quick Start

1. **Create your project from this template**
   ```bash
   # example: copy the folder, then
   cd YOUR-NEW-PROJECT
   npm install
   ```

2. **Fill placeholders** in `docs/project-brief.md` and `docs/design-system.md`.

3. **Run the app**
   ```bash
   npm run dev
   ```

4. **Start your AI agent** — Claude Code recommended:
   ```bash
   claude
   ```

5. **Vibe code** — describe the UI you want; agents should follow `docs/workflows.md` and `AGENTS.md`.

## Supported Platforms

| Agent                                                         | Status                     |
| ------------------------------------------------------------- | -------------------------- |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | **Recommended**            |
| [Codex CLI](https://github.com/openai/codex)                  | Supported                  |
| [OpenCode](https://opencode.ai/)                              | Supported                  |
| [GitHub Copilot](https://github.com/features/copilot)         | Supported                  |
| [Cursor](https://cursor.com/)                                 | Supported                  |
| [Windsurf](https://codeium.com/windsurf)                      | Supported                  |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli)     | Supported                  |
| [Cline](https://github.com/cline/cline)                       | Supported                  |
| [Roo Code](https://github.com/RooCodeInc/Roo-Code)            | Supported                  |
| [Continue](https://continue.dev/)                             | Supported                  |
| [Amazon Q](https://aws.amazon.com/q/developer/)               | Supported                  |
| [Augment Code](https://www.augmentcode.com/)                  | Supported                  |
| [Aider](https://aider.chat/)                                  | Supported                  |

## Prerequisites

- [Node.js](https://nodejs.org/) 24+
- An AI coding agent (see [Supported Platforms](#supported-platforms))

## Tech Stack

- **Next.js 16** — App Router, React 19, TypeScript strict
- **shadcn/ui** — Radix primitives + Tailwind CSS v4
- **Tailwind CSS v4** — oklch design tokens
- **Lucide React** — default icons

## How It Works

This template is organized for **vibe coding with agents**:

1. **Brief** — capture product goals, audience, and constraints in `docs/project-brief.md`
2. **Design system** — define tokens and components in `docs/design-system.md` + `src/app/globals.css`
3. **Plan** — page map, component inventory, interaction models (`docs/workflows.md`)
4. **Build** — specs first, small parallel builder tasks (worktrees), always-green builds
5. **Review** — visual QA across breakpoints and states; iterate

Agents read `AGENTS.md` as the single source of truth. Platform-specific rule files are generated from it.

## Project Structure

```
src/
  app/              # Next.js routes
  components/       # React components
    ui/             # shadcn/ui primitives
  lib/utils.ts      # cn() utility
  types/            # TypeScript interfaces
  hooks/            # Custom React hooks
public/
  images/           # Project images
  videos/           # Project videos
  seo/              # Favicons, OG images
docs/
  project-brief.md  # Project goals & constraints (template)
  design-system.md  # Design tokens & components (template)
  conventions.md    # Code style and patterns
  workflows.md      # Vibe coding workflows
skills/             # Agent skills (placeholder — add your own)
scripts/
  sync-agent-rules.sh  # Regenerate agent instruction files
AGENTS.md           # Agent instructions (single source of truth)
CLAUDE.md           # Claude Code config (imports AGENTS.md)
GEMINI.md           # Gemini CLI config (imports AGENTS.md)
```

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # ESLint check
npm run typecheck # TypeScript check
npm run check     # Run lint + typecheck + build
```

### If using docker

```bash
docker compose up app --build # build and run the app
docker compose up dev --build # run the app in dev mode on port 3001
```

## Updating Agent Rules Across Platforms

| What                 | Source of truth | Sync command                       |
| -------------------- | --------------- | ---------------------------------- |
| Project instructions | `AGENTS.md`     | `bash scripts/sync-agent-rules.sh` |

Edit `AGENTS.md`, then run the sync script. Agents that read `AGENTS.md` natively need no regeneration.

## Skills

The `skills/` folder is intentionally empty except for a placeholder README. Add your own agent skills when ready; do not invent skills in this template by default.

## License

MIT
