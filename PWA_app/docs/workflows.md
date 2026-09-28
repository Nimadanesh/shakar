Workflows — Vibe Coding with Agents

Step-by-step workflows for designing and building original UI/UX with AI agents in BASE-TEMPLATE + Shekar project rules.

Guiding Principles

These separate a polished product UI from a "close enough" mess. Internalize them — they should inform every decision.

1. Completeness Beats Speed

Every builder agent must receive everything it needs: design tokens, layout intent, content, states, breakpoints, and asset paths. If a builder has to guess a color, font size, or padding value, the spec failed. Take the extra minute to specify one more property.

2. Small Tasks, Perfect Results

When an agent gets "build the entire features section," it glosses over details. When it gets a single focused component with exact token and behavior specs, it nails it.





Simple banner (heading + button)? One agent.



Complex section with 3 card variants and unique hover states? One agent per variant + one for the section wrapper.



Complexity budget: if a builder prompt exceeds ~150 lines of spec, split it.

3. Foundation First

Nothing feature-level ships until foundation exists: global CSS tokens, fonts, base layout shell, shared primitives. This is sequential and non-negotiable. Everything after can be parallel.

4. Spec Files Are the Source of Truth

Every non-trivial component gets a short spec before a builder is dispatched. The builder receives the spec inline in its prompt. The file also persists as an auditable artifact. Suggested path: docs/specs/<component-name>.spec.md (create docs/specs/ when you start building).

5. Build Must Always Compile

Every builder runs npx tsc --noEmit (or project typecheck) before finishing. After merges, npm run build must pass. A broken build is never acceptable, even temporarily. Prefer the project quality gate: npm run check.

6. Design Behavior, Not Only Appearance

UI is alive: hover, focus, scroll, load, empty, error. Spec appearance and behavior — triggers, before/after, transition timing.

7. Original Work Only

This template is for original product UI from the project brief and design system — not reverse-engineering third-party sites.

8. Shekar-Specific Principles





Entire app is RTL and Persian-first (UI strings in Persian, code/comments in English).



Dark theme only — never introduce light mode.



All divar-mcp calls are server-side only. Never call MCP from client components.



Filtering pipeline: rule-based first → optional lightweight LLM on limited candidates → cache. Respect ~60 req/min rate limit.



Mobile-first PWA. Keep density compact but readable.



Do not expand MVP scope (no seller chat, no ad posting, no native apps, no complex payments yet).



Workflow A — Start a New Project





Copy BASE-TEMPLATE into a new repo/folder.



npm install



Fill docs/brief.md (or docs/project-brief.md) — already done for Shekar.



Fill docs/designSystem.md (or docs/design-system.md); implement tokens in src/app/globals.css and fonts in src/app/layout.tsx.



Update layout.tsx metadata (title, description) and set dir="rtl".



Confirm npm run check passes on the empty shell.



Open your agent with AGENTS.md loaded; begin Workflow B.



Workflow B — Plan → Design → Build → Review → Iterate

Phase 0: Align





[ ] Read project brief + design system + conventions



[ ] Confirm in-scope pages and primary flows with the user



[ ] List open questions; do not invent brand-critical decisions (OTP provider, payment gateway, exact score weights)

Phase 1: Plan

Produce a short plan (chat or docs/specs/PLAN.md):





Page map — routes and purpose (see brief)



Section inventory — top-to-bottom per page



Component inventory — shared vs page-specific (AdCard, SearchFilters, BottomTabBar, etc.)



Interaction model per section — static | click | hover | scroll | time



Content needs — Persian copy, placeholders, Divar image handling



Risks — MCP rate limits, cost of any LLM stage, RTL edge cases, a11y

Phase 2: Design foundation

Do this yourself (orchestrator), not a swarm:





Tokens in globals.css aligned to designSystem.md (dark-only palette)



Fonts in layout.tsx (Vazirmatn + Inter), dir="rtl"



Shell layout (header + bottom tab bar placeholders)



Essential ui/ primitives via shadcn as required



Verify: npm run build / npm run check

Phase 3: Spec → dispatch → merge (core loop)

For each section (top to bottom):

Step 1 — Spec

Write docs/specs/<name>.spec.md:

# <ComponentName> Specification

## Overview
- **Target file:** `src/components/<ComponentName>.tsx`
- **Page / section:** ...
- **Interaction model:** static | click-driven | hover | scroll-driven | time-driven

## Structure
- Element hierarchy / subcomponents

## Design tokens & layout
- Spacing, type roles, colors (token names, not guessed hex)
- Breakpoint behavior (390 / 768 / 1440)
- RTL notes if any

## States & behaviors
- default / hover / focus / disabled / loading / empty / error
- Triggers, transitions, motion notes

## Content
- Persian copy, image paths, aria labels

## Acceptance
- [ ] Matches design system
- [ ] RTL correct
- [ ] Responsive checks
- [ ] `npx tsc --noEmit` clean (or `npm run check`)

Step 2 — Dispatch builders





Simple section: one builder



Complex section: one builder per subcomponent, then wrapper



Each builder gets: full spec inline, token context, target path, typecheck instruction



Prefer git worktrees per parallel builder



Do not wait — extract/spec the next section while builders run



Remind builders: no MCP from client, no hard-coded hex, UI strings in Persian

Step 3 — Merge





Merge worktree branches into mainline



Resolve conflicts with full product context



After each merge: npm run build / npm run check



Fix type errors immediately

Phase 4: Assemble





Wire sections in src/app/**/page.tsx (keep pages thin)



Page-level behavior: sticky header, fixed bottom tabs, providers



Server-side MCP helpers and any auth/saved-search actions



Verify: npm run build

Phase 5: Visual QA & iterate





[ ] Desktop 1440 — section by section (secondary for MVP)



[ ] Tablet 768



[ ] Mobile 390 (primary)



[ ] Keyboard focus order and focus rings



[ ] Hover/active states



[ ] Empty/loading/error states (Persian copy)



[ ] RTL layout integrity



[ ] Reduced motion sanity check



Log gaps → fix specs → fix components → re-QA

Phase 6: Handoff checklist





[ ] Brief and design system still accurate



[ ] No {{PLACEHOLDER}} left in shipped UI copy (unless intentional)



[ ] npm run check green



[ ] Known limitations documented for the user



[ ] MCP calls are server-only; rate-limit awareness present



[ ] No light theme or LTR regressions



Workflow C — Iterate on an Existing Screen





Reproduce the issue or goal in one sentence.



Identify owning component(s) and whether the design system must change.



If tokens/patterns change → update designSystem.md + globals.css first.



Patch the smallest component; avoid unrelated refactors.



Visual QA the affected breakpoints/states (especially mobile + RTL).



npm run check



Workflow D — Multi-Agent Orchestration





Orchestrator owns brief, design system, plan, and merge authority.



Each teammate: own worktree/branch, own file ownership when possible.



Shared files (globals.css, page.tsx, MCP helpers): only orchestrator or serialized edits.



Inline full specs in builder prompts — do not say "go read the doc" without pasting critical bits.



Merge continuously; never batch ten long-lived diverging branches.



Remind every builder of Shekar constraints (RTL, dark-only, server-only MCP, Persian UI).



Pre-Dispatch Checklist

Before dispatching any builder:





[ ] Spec written with structure, tokens, states, content, acceptance



[ ] Interaction model identified



[ ] Responsive behavior noted for mobile (primary) and desktop at minimum



[ ] Assets/paths identified or explicitly placeholder



[ ] Prompt under ~150 lines of spec; else split



[ ] Builder told to run typecheck before finish



[ ] Shekar rules restated if relevant (RTL, no client MCP, no hard-coded colors, Persian strings)



What NOT to Do





Don't skip the foundation — building sections on default tokens and "fixing colors later" creates thrash



Don't give builders vague aesthetic prompts only — "make it modern" without tokens/spacing is not a spec



Don't bundle unrelated sections into one agent



Don't approximate tokens — use names from the design system



Don't ship default-only states for interactive UI



Don't reverse-engineer third-party sites into this template



Don't leave the build broken between merges



Shekar-specific:





Don't call divar-mcp from the browser



Don't introduce light theme or LTR layouts



Don't expand MVP scope



Don't hard-code hex colors or English UI strings



Completion Report (template)

When a major slice is done, report:





Sections / components built



Specs written



Build status (npm run check)



Visual QA notes (breakpoints, RTL, residual gaps)



Design system updates made



MCP / data-layer notes (if any)



Open questions for the user

