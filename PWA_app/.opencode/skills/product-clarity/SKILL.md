---
name: product-clarity
description: Translate informal product requests into grounded implementation intent, scope, acceptance criteria, and safe assumptions before coding.
compatibility: opencode
metadata:
  opencode/autoinvoke: "true"
---

# Product Clarity Skill

Use this skill whenever a user request is informal, incomplete, or outcome-oriented.

## Workflow
1. Read `AGENTS.md` first (single source of truth).
2. Read the relevant project docs before making product decisions: `docs/project-brief.md`, `docs/design-system.md`, `docs/conventions.md`, `docs/workflows.md`, plus `docs/specs/*` when present.
3. Inspect the existing implementation before proposing a change.
4. Derive **Intent**, **Scope**, **Acceptance**, and **Risks**.
5. If repository context supports one low-risk interpretation, state the assumption briefly and proceed.
6. If ambiguity could materially change architecture, data model, auth, security, or major UX, ask one focused clarification.
7. Never ask the user to restate information already present in repository docs.

## Intent translation
- "make this more premium" → inspect hierarchy, spacing, typography, states, interaction quality, and `docs/design-system.md` before changing visuals.
- "make this easier" → identify actual friction in the flow and reduce steps or cognitive load.
- "fix this page" → inspect the whole affected flow, fix the highest-impact defects, and avoid unrelated redesign.
- "make it production ready" → validate behavior, states, responsive UX, accessibility basics, error handling, and `npm run check`.

## Truthfulness / mock-boundary rule
For user-visible claims (status, counts, availability, auth state), never infer real backend truth from UI copy. Preserve the explicit mock/placeholder boundaries defined in the brief or specs. Do not present placeholder content as live data.

## Output discipline
Do not dump this framework into every user reply. Use it to reason and execute. Surface the interpreted intent only when it prevents a meaningful misunderstanding.
