<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# BASE-TEMPLATE — Agent-Driven UI/UX Vibe Coding

## What This Is
A reusable starter template for designing and building original UI/UX with AI coding agents. The Next.js + shadcn/ui + Tailwind v4 base is pre-scaffolded. Fill in the project docs, then vibe-code section by section with specs, parallel builders, and visual QA.

## Tech Stack
- **Framework:** Next.js 16 (App Router, React 19, TypeScript strict)
- **UI:** shadcn/ui (Radix primitives, Tailwind CSS v4, `cn()` utility)
- **Icons:** Lucide React (default — extend with custom SVGs as needed)
- **Styling:** Tailwind CSS v4 with oklch design tokens
- **Deployment:** Vercel

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npm run typecheck` — TypeScript check
- `npm run check` — Run lint + typecheck + build

## Code Style
- TypeScript strict mode, no `any`
- Named exports, PascalCase components, camelCase utils
- Tailwind utility classes, no inline styles
- 2-space indentation
- Responsive: mobile-first

## Design Principles
- **Beauty-first** — every pixel matters; polish spacing, type, motion, and hierarchy
- **Spec before build** — write component specs (structure, tokens, states, responsive) before dispatching builders
- **Small tasks, perfect results** — one focused component per builder; split when a prompt exceeds ~150 lines of spec
- **Design system as source of truth** — colors, type, spacing, and components live in `docs/design-system.md` and tokens in `globals.css`
- **Original work** — design and build from the project brief; do not reverse-engineer or copy third-party sites
- **Build must always compile** — every builder verifies `npx tsc --noEmit`; after merges, `npm run build` must pass

## Project Structure
```
src/
  app/              # Next.js routes
  components/       # React components
    ui/             # shadcn/ui primitives
  lib/
    utils.ts        # cn() utility (shadcn)
  types/            # TypeScript interfaces
  hooks/            # Custom React hooks
public/
  images/           # Project images
  videos/           # Project videos
  seo/              # Favicons, OG images, webmanifest
docs/
  project-brief.md  # Goals, audience, brand, constraints
  design-system.md  # Tokens, type, components
  conventions.md    # Code style and folder patterns
  workflows.md      # Plan → design → build → review → iterate
skills/             # Agent skills (add later)
scripts/            # Agent rule sync and project scripts
```

## Agent Behavior
1. **Read project context first** — `docs/project-brief.md`, `docs/design-system.md`, `docs/conventions.md`, `docs/workflows.md`
2. **Plan before coding** — confirm goals, pages, and component inventory with the user when scope is unclear
3. **Foundation first** — tokens, fonts, layout shell, shared primitives before feature sections
4. **Spec → build → merge** — write specs, dispatch small builder tasks (prefer worktrees for parallel work), merge carefully
5. **Visual QA** — desktop (1440), tablet (768), mobile (390); check hover, focus, empty, loading, and error states
6. **No drive-by refactors** — change only what the task requires; match existing patterns

## MOST IMPORTANT NOTES
- When launching agent teams, ALWAYS have each teammate work in their own worktree branch and merge everyone's work at the end, resolving merge conflicts with full orchestrator context.
- After editing `AGENTS.md`, run `bash scripts/sync-agent-rules.sh` to regenerate platform-specific instruction files.
- Skills live in `skills/` (and platform skill dirs when added). Do not invent skills unless the user asks.
- Fill `{{PLACEHOLDER}}` values in docs before starting a real product build.

@docs/conventions.md
@docs/workflows.md
