# Engine V3 — Current Handoff

Updated: 2026-10-21
Branch: `engine_v3`
Starting baseline: `10f3c40d70748ff27d6928eaed0875e10dab1c56`

## Mission
Improve real Divar search result quality for professional users. The human owner evaluates product output; the technical agent independently owns investigation, architecture, experiments, and implementation decisions.

## Verified state
- Branch `engine_v3` exists from current `main`.
- V3 contains control docs only; no engine source changes have been made.
- Remote inspection found an existing 16-case synthetic benchmark (`2026-10-09-v1`), golden-benchmark scripts/gate, and separate human-evaluation artifacts in `Nimadanesh/shakar-eval-tmp-20261012`.
- Existing architecture/roadmap docs contain stale baseline pointers; they must be reconciled against current code.
- The separate human-evaluation repo includes a 60-observation real-ad packet/replay. Its artifacts and prior pinned candidates must remain immutable. Verify current R1/R2 state before any new evaluation action.
- No tests/build/typecheck/lint/live hunts were executed. Local clone failed due to unavailable GitHub DNS from the container; its Node 22.16.0 also fails the package's declared Node >=24 prerequisite.

## Must preserve
- Do not change `main` or deploy without explicit authorization.
- Do not alter, overwrite, or rerun completed frozen human-evaluation captures just to improve results.
- Keep unknown evidence distinct from satisfied/violated.
- Do not claim live quality improvement without paired human-judged evidence.
- Treat user grades as evidence, not as technical instructions.
- Do not treat source review or synthetic tests as proof of production quality.

## Current phase
Phase 0 — baseline trustworthiness, in progress. See `PROJECT_STATE.md`, `BASELINE_AUDIT.md`, and `ROADMAP.md`.

## Next action
Obtain an authorized Node >=24 execution environment, verify the exact checked-out SHA, and run the existing checks with outputs recorded. Do not implement features before the baseline gate. Do not deploy or mutate external services.

## Session close checklist
- [ ] Branch/head and changed files verified
- [ ] Tests/checks explicitly recorded as run/not run
- [ ] Evaluation artifacts preserved and their status recorded
- [ ] Decisions and roadmap updated if evidence changed them
- [ ] Next action and acceptance gate stated
