---
name: agent-handoff
description: Preserve durable decisions, assumptions, validation, and remaining work so another coding-agent session can continue safely.
compatibility: opencode
metadata:
  opencode/autoinvoke: "true"
---

# Agent Handoff Skill

Use this skill when a task may be continued by another coding-agent session.

## Rules
- Keep durable decisions in repository docs, not only in chat.
- Before finishing a non-trivial task, update the most relevant doc (`docs/brief.md`, `docs/designSystem.md`, or `docs/specs/*` when present) if behavior or durable decisions changed.
- Record important assumptions and unresolved risks.
- Do not document behavior that does not exist.
- Keep names, routes, and identifiers consistent with the current codebase; treat legacy or placeholder references as debt unless changing them is safe and explicitly required.

## Handoff summary
A useful handoff answers:
1. What changed?
2. Why was it changed?
3. Which files/areas are affected?
4. What checks were run?
5. What remains?
6. Which assumptions must be preserved?

## Continuity rule
The next agent must inspect the actual diff and repository source of truth before making further changes. Previous-agent prose never replaces source code or canonical docs.
