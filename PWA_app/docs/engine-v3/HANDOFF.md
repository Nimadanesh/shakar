# Engine V3 — Current Handoff

Updated: 2026-10-22
Branch: `engine_v3`
Starting baseline: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Latest workflow configuration commit: `c1e4ee15af972d5f31d3225f9f29b77ec93008e4`

## Mission

Improve real Divar search result quality for professional users. The human owner evaluates product output; the technical agent independently owns investigation, architecture, experiments, and implementation decisions.

## Verified state
- Branch `engine_v3` remains isolated from `main`; no product or engine source files have been changed in V3.
- The hosted Node 24 workflow has now run. [Run #4](https://github.com/Nimadanesh/shakar/actions/runs/39676527704) checked commit `76216d62017afbaa23820afc85e0c34885a95fc9`.
- `npm ci`: PASS. Runtime was Node `v24.21.0`, npm `11.19.0`.
- Focused portable hunt/search tests: PASS.
- Full portable test suite: PASS.
- TypeScript typecheck: PASS.
- Production build: PASS.
- ESLint: FAIL — 9 errors and 38 warnings; overall job is failed. Eight errors are `react-hooks/set-state-in-effect` in UI files; one is `prefer-const` in `src/lib/server/hunt/contract.ts:163`.
- Three historical research harnesses are NOT RUN because their frozen inputs are external to the repo: `ge2-ads.json`, `experiment-b-probe-v1.json`, and Experiment A contracts/captures/grades/snapshot files under `/home/hatch/workspace`. They are explicitly excluded from portable CI, not represented as passing.
- Dependency installation reported 30 vulnerabilities (2 low, 6 moderate, 20 high, 2 critical). No dependency upgrades were applied.
- Latest workflow trigger paths are scoped to code/build inputs so edits to these control documents do not cause unnecessary repeated CI runs.
- No live Divar hunt or paired human-quality comparison has been run by this workflow. Build/test success is not search-quality evidence.
- Existing architecture/roadmap docs have stale baseline pointers. Verify current R1/R2 status before any new evaluation action; frozen candidates, captures, grades and mappings remain immutable.

## Must preserve
- Do not change `main` or deploy without explicit authorization.
- Do not alter, overwrite, or rerun completed frozen human-evaluation captures just to improve results.
- Keep unknown evidence distinct from satisfied/violated.
- Do not claim live quality improvement without paired human-judged evidence.
- Treat user grades as evidence, not as technical instructions.
- Do not treat source review or synthetic tests as proof of production quality.

## Current phase
Phase 0 — baseline trustworthiness. Execution has produced useful results, but phase exit is not approved while evaluation artifact status and stale documentation remain unreconciled and lint failures remain recorded.

## Next action
Inspect `contract.ts:163` and the current evaluation handoff, reconcile architecture/quality docs against current code, and create a prioritized failure register with one narrow, measurable first search-quality experiment. Avoid unrelated UI refactors. Do not implement a broad rewrite or touch frozen evaluation artifacts.

## Session close checklist
- [x] Branch/head and changed files verified
- [x] Portable tests, typecheck, lint and build outcomes recorded
- [ ] Evaluation artifacts' current R1/R2 status verified without mutation
- [ ] Architecture/quality docs reconciled
- [ ] First experiment and acceptance gate recorded
- [ ] Next action and go/no-go stated
