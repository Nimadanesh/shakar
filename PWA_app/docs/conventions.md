Conventions

Code style, naming, folder structure, and component patterns for BASE-TEMPLATE + Shekar project rules.

Language & Tooling





TypeScript strict — no any; prefer explicit props interfaces



React 19 + Next.js 16 App Router



ESLint via eslint-config-next



Quality gate: npm run check (lint + typecheck + build)

Shekar language rules





All source code, comments, commit messages, and internal docs are in English.



All user-facing UI strings are in Persian.



The entire application is RTL. Set dir="rtl" at the root layout; do not mix LTR layouts unless a specific English-only fragment requires it.

Formatting





2-space indentation



Prefer trailing structure consistent with neighboring files



No drive-by reformatting of unrelated files

Naming







Kind



Convention



Example





Components



PascalCase



HeroSection.tsx





Hooks



use + camelCase



useMediaQuery.ts





Utils



camelCase



formatDate.ts





Types / interfaces



PascalCase



PricingTier





CSS variables



kebab semantic tokens



--primary, --muted-foreground





Files



Match default export or main symbol



button.tsx in ui/





Named exports for components and utils (except Next.js page.tsx / layout.tsx route defaults)



Avoid default exports for shared UI

Folder Structure

src/
app/          # Routes, layouts, globals.css only
components/   # Feature and section components
  ui/         # shadcn / primitive design-system components
hooks/        # Shared React hooks
lib/          # Pure utils (cn, helpers) + server helpers (mcp, db)
types/        # Shared TypeScript types
public/
  images/
  videos/
  seo/
docs/         # Project brief, design system, workflows, conventions
skills/       # Agent skills (user-supplied)
scripts/      # Maintenance scripts

Placement rules





Primitives (Button, Input) → src/components/ui/



Sections / features → src/components/ (or src/components/<feature>/ when a feature grows)



Route-only composition → src/app/**/page.tsx imports sections; keep pages thin



No business logic in ui/ — primitives stay presentational



Server-only helpers (divar-mcp client, DB queries, OTP) → src/lib/ (or src/lib/mcp/, src/lib/db/)

Components





Props: typed interface or type co-located above the component



Use cn() from @/lib/utils to merge class names



Tailwind utility classes only — no inline style={} unless dynamically unavoidable



Prefer composition over giant prop APIs



Client components: add "use client" only when hooks/events require it; default to Server Components

Styling





Design tokens live in src/app/globals.css and are documented in docs/design-system.md (or docs/designSystem.md)



Use semantic tokens (bg-background, text-muted-foreground, bg-primary, etc.) over raw colors



Never hard-code hex values in components. If a new color is needed, add it to the design system first.



Mobile-first breakpoints



Respect prefers-reduced-motion for non-essential animation



Shekar: Dark theme only (no light mode in MVP). High-contrast professional dark palette.

State & Data





Local UI state: React state / context as needed



Server data: follow Next.js App Router patterns for the feature



Do not invent global state libraries unless the brief requires them

Shekar data rules





All calls to divar-mcp must be server-side only (Server Components, Server Actions, Route Handlers, or lib/ server modules). Never call MCP from client components.



Respect the approximate rate limit (~60 requests / minute / IP). Implement basic throttling or queuing if needed.



Description filtering pipeline (cost control):





Rule-based keyword matching first (include / exclude on title + description, normalized Persian text)



Optional lightweight LLM only on a limited set of remaining candidates



Cache frequent search results



Treat MCP data as read-only and potentially incomplete. No phone numbers beyond what the MCP publicly returns.

Authentication & Subscription (Shekar)





Auth: mobile number + OTP. Provider is pluggable; early MVP may use a mock.



Never log or expose OTP codes or secrets.



Guest users may search and view ads. Saved Search, Favorites, Profile, and subscription features require authentication.



Subscription status must be checked server-side before unlocking gated features.



Payment gateway decision is deferred; keep the status model and feature-gating structure ready.

Accessibility





Interactive elements must be keyboard reachable



Prefer native elements (button, a, label) before ARIA



Focus-visible styles via tokens (ring)



Images: meaningful alt (or empty alt for decorative)

Git & Agent Collaboration





Small, focused changes per task



Parallel agents: one worktree/branch per teammate; orchestrator merges



Never commit secrets (.env*)



After editing AGENTS.md, run bash scripts/sync-agent-rules.sh

Imports





Path alias: @/ → src/



Group: external → internal @/ → relative



Do not import from app/ into components/ in ways that create cycles

What Not To Do





Do not reverse-engineer or copy third-party production sites into this project



Do not add dependencies without a clear need and user agreement for non-trivial libs



Do not skip typecheck / build verification after structural UI work



Do not put one-off hex colors or font sizes that bypass the design system without updating the design-system doc



Shekar-specific:





Do not call divar-mcp from the browser



Do not implement LTR layouts or light theme



Do not expand MVP scope (no seller chat, no ad posting, no native apps, no complex payments yet)



Do not hard-code colors or ignore the token system

