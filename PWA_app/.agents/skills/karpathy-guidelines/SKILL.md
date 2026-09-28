---
name: karpathy-guidelines
description: Behavioral guidelines for Shekar Next.js PWA coding work. Use when writing, reviewing, debugging, or refactoring code to surface assumptions, prefer simple solutions, make surgical changes, and verify concrete success criteria.
license: MIT
---

# Karpathy Guidelines — Shekar Adaptation

These guidelines bias toward caution over speed. For trivial tasks, use judgment.
They complement `AGENTS.md`, `docs/conventions.md`, and `docs/workflows.md`; they do not override `docs/brief.md`, `docs/designSystem.md`, or explicit user instructions.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementation:
- State important assumptions internally and surface them when they affect the outcome.
- If multiple interpretations could materially change behavior, do not silently choose one.
- Prefer repository/product context over generic assumptions.
- If something is genuinely unclear, stop and ask a focused question.
- If a simpler approach exists, prefer it and explain the tradeoff when useful.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond the requested goal.
- No abstractions for single-use code unless they clearly reduce complexity.
- No speculative flexibility/configuration.
- No unnecessary error paths for impossible states.
- If the implementation is becoming much larger than the problem warrants, reconsider the approach.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Do not improve adjacent code merely because you notice it.
- Do not refactor unrelated code.
- Do not reformat unrelated lines.
- Match established project style and architecture.
- If unrelated dead code is noticed, mention it rather than deleting it.
- Remove only imports/variables/functions that became unused because of your own change.

Every changed line should have a traceable reason connected to the task, its acceptance criteria, or a necessary consequence of the change.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Translate vague implementation requests into observable outcomes.

Examples:
- "Add validation" → tests prove invalid inputs are rejected and valid inputs remain accepted.
- "Fix the bug" → reproduce it with a test, fix it, then verify the regression test.
- "Redesign this screen" → verify the requested UX outcome plus `docs/designSystem.md` requirements and states.

For multi-step work, maintain a short plan:
1. Step → verification.
2. Step → verification.
3. Step → verification.

Do not declare success because code merely compiles.

## Shekar completion gates
Before declaring a task complete, check:
- Does it respect `AGENTS.md` and the scope in `docs/brief.md`?
- Does it follow `docs/designSystem.md` and tokens in `src/app/globals.css` for UI work?
- Does it follow `docs/conventions.md` (named exports, Server Components by default, `cn()`, Tailwind tokens, mobile-first)?
- Does it follow `docs/workflows.md` (spec before build, foundation first, build stays green)?
- Did the change stay within the user's requested scope?
- Were relevant checks run (`npm run check`), or are failures explicitly documented?

## Conflict rule
If this skill conflicts with a product specification, security requirement, or explicit user instruction, surface the conflict. Never use "simplicity" or "surgical changes" as an excuse to violate a higher-priority requirement.
