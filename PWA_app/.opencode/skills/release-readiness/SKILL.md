---
name: release-readiness
description: Verify user-visible behavior, responsive states, accessibility basics, truthful claims, validation results, and final-diff quality before declaring a task done.
compatibility: opencode
metadata:
  opencode/autoinvoke: "true"
---

# Release Readiness Skill

Use before calling a product task complete or preparing a release.

## Checklist
- Requested behavior works in the intended route/flow.
- Loading, empty, error, and success states are handled where relevant.
- Mobile/responsive behavior is checked for UI work (390 / 768 / 1440 per `docs/workflows.md`).
- Accessibility basics are preserved: labels, focus, keyboard/touch targets, semantic structure.
- User-visible claims are truthful and backed by real application state; placeholder or mock content is not shipped as live data.
- If PWA surface was touched (manifest, icons, installability, offline), verify it against the brief.
- Relevant lint/type/test/build/check commands are run when available (`npm run check`).
- The final diff contains no unrelated generated files, secrets, debug logging, or temporary workarounds.
- Documentation is updated only when behavior or durable project decisions changed.

## Failure policy
A failing validation command is not silently ignored. Determine whether it is caused by the change. If it is unrelated or environmental, report it explicitly with the exact command and failure reason.

## Product quality
"Build passes" is not equivalent to "feature is done." Verify the user-visible outcome and the surrounding flow.
