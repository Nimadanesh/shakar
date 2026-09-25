# Workflows — Vibe Coding with Agents

Step-by-step workflows for designing and building original UI/UX with AI agents in BASE-TEMPLATE.

## Guiding Principles

These separate a polished product UI from a "close enough" mess. Internalize them — they should inform every decision.

### 1. Completeness Beats Speed

Every builder agent must receive **everything** it needs: design tokens, layout intent, content, states, breakpoints, and asset paths. If a builder has to guess a color, font size, or padding value, the spec failed. Take the extra minute to specify one more property.

### 2. Small Tasks, Perfect Results

When an agent gets "build the entire features section," it glosses over details. When it gets a single focused component with exact token and behavior specs, it nails it.

- Simple banner (heading + button)? One agent.
- Complex section with 3 card variants and unique hover states? One agent per variant + one for the section wrapper.
- **Complexity budget:** if a builder prompt exceeds ~150 lines of spec, split it.

### 3. Foundation First

Nothing feature-level ships until foundation exists: global CSS tokens, fonts, base layout shell, shared primitives. This is sequential and non-negotiable. Everything after can be parallel.

### 4. Spec Files Are the Source of Truth

Every non-trivial component gets a short spec **before** a builder is dispatched. The builder receives the spec **inline** in its prompt. The file also persists as an auditable artifact.

Suggested path: `docs/specs/<component-name>.spec.md` (create `docs/specs/` when you start building).

### 5. Build Must Always Compile

Every builder runs `npx tsc --noEmit` (or project typecheck) before finishing. After merges, `npm run build` must pass. A broken build is never acceptable, even temporarily.

### 6. Design Behavior, Not Only Appearance

UI is alive: hover, focus, scroll, load, empty, error. Spec **appearance and behavior** — triggers, before/after, transition timing.

### 7. Original Work Only

This template is for **original** product UI from the project brief and design system — not reverse-engineering third-party sites.

---

## Workflow A — Start a New Project

1. Copy BASE-TEMPLATE into a new repo/folder.
2. `npm install`
3. Fill `docs/project-brief.md` (`{{PLACEHOLDER}}`s).
4. Fill `docs/design-system.md`; implement tokens in `src/app/globals.css` and fonts in `src/app/layout.tsx`.
5. Update `layout.tsx` metadata (`title`, `description`).
6. Confirm `npm run check` passes on the empty shell.
7. Open your agent with `AGENTS.md` loaded; begin Workflow B.

---

## Workflow B — Plan → Design → Build → Review → Iterate

### Phase 0: Align

- [ ] Read project brief + design system
- [ ] Confirm in-scope pages and primary flows with the user
- [ ] List open questions; do not invent brand-critical decisions

### Phase 1: Plan

Produce a short plan (chat or `docs/specs/PLAN.md`):

1. **Page map** — routes and purpose
2. **Section inventory** — top-to-bottom per page
3. **Component inventory** — shared vs page-specific
4. **Interaction model** per section — static | click | hover | scroll | time
5. **Content needs** — real copy, placeholders, images
6. **Risks** — motion, responsive complexity, a11y

### Phase 2: Design foundation

Do this yourself (orchestrator), not a swarm:

1. Tokens in `globals.css` aligned to `design-system.md`
2. Fonts in `layout.tsx`
3. Shell layout (nav/footer placeholders if needed)
4. Essential `ui/` primitives via shadcn as required
5. Verify: `npm run build`

### Phase 3: Spec → dispatch → merge (core loop)

For each section (top to bottom):

#### Step 1 — Spec

Write `docs/specs/<name>.spec.md`:

```markdown
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

## States & behaviors
- default / hover / focus / disabled / loading / empty / error
- Triggers, transitions, motion notes

## Content
- Copy, image paths, aria labels

## Acceptance
- [ ] Matches design system
- [ ] Responsive checks
- [ ] `npx tsc --noEmit` clean
```

#### Step 2 — Dispatch builders

- **Simple section:** one builder
- **Complex section:** one builder per subcomponent, then wrapper
- Each builder gets: full spec inline, token context, target path, typecheck instruction
- Prefer **git worktrees** per parallel builder
- Do not wait — extract/spec the next section while builders run

#### Step 3 — Merge

- Merge worktree branches into mainline
- Resolve conflicts with full product context
- After each merge: `npm run build`
- Fix type errors immediately

### Phase 4: Assemble

- Wire sections in `src/app/**/page.tsx` (keep pages thin)
- Page-level behavior: sticky nav, scroll regions, providers
- Verify: `npm run build`

### Phase 5: Visual QA & iterate

- [ ] Desktop 1440 — section by section
- [ ] Tablet 768
- [ ] Mobile 390
- [ ] Keyboard focus order and focus rings
- [ ] Hover/active states
- [ ] Empty/loading/error if applicable
- [ ] Reduced motion sanity check
- Log gaps → fix specs → fix components → re-QA

### Phase 6: Handoff checklist

- [ ] Brief and design system still accurate
- [ ] No `{{PLACEHOLDER}}` left in shipped UI copy (unless intentional)
- [ ] `npm run check` green
- [ ] Known limitations documented for the user

---

## Workflow C — Iterate on an Existing Screen

1. Reproduce the issue or goal in one sentence.
2. Identify owning component(s) and whether the design system must change.
3. If tokens/patterns change → update `design-system.md` + `globals.css` first.
4. Patch the smallest component; avoid unrelated refactors.
5. Visual QA the affected breakpoints/states.
6. `npm run check`

---

## Workflow D — Multi-Agent Orchestration

1. Orchestrator owns brief, design system, plan, and merge authority.
2. Each teammate: **own worktree/branch**, own file ownership when possible.
3. Shared files (`globals.css`, `page.tsx`): only orchestrator or serialized edits.
4. Inline full specs in builder prompts — do not say "go read the doc" without pasting critical bits.
5. Merge continuously; never batch ten long-lived diverging branches.

---

## Pre-Dispatch Checklist

Before dispatching any builder:

- [ ] Spec written with structure, tokens, states, content, acceptance
- [ ] Interaction model identified
- [ ] Responsive behavior noted for mobile and desktop at minimum
- [ ] Assets/paths identified or explicitly placeholder
- [ ] Prompt under ~150 lines of spec; else split
- [ ] Builder told to run typecheck before finish

---

## What NOT to Do

- **Don't skip the foundation** — building sections on default tokens and "fixing colors later" creates thrash
- **Don't give builders vague aesthetic prompts only** — "make it modern" without tokens/spacing is not a spec
- **Don't bundle unrelated sections** into one agent
- **Don't approximate tokens** — use names from the design system
- **Don't ship default-only states** for interactive UI
- **Don't reverse-engineer third-party sites** into this template
- **Don't leave the build broken** between merges

---

## Completion Report (template)

When a major slice is done, report:

- Sections / components built
- Specs written
- Build status (`npm run check`)
- Visual QA notes (breakpoints, residual gaps)
- Design system updates made
- Open questions for the user
