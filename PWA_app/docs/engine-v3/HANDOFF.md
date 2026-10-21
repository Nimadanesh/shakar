# Engine V3 — Current Handoff

Updated: 2026-10-22
Branch: `engine_v3`
Starting baseline: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Latest source fix: `49656d583c43bc8bd7fe3478e0ee4ad5ab5c225e`

## Mission

Improve real Divar search result quality for professional users. The human owner evaluates product output; the technical agent independently owns investigation, architecture, experiments, and implementation decisions.

## Verified state
- Branch `engine_v3` remains isolated from `main`.
- The only product-source change so far is a behavior-preserving lint cleanup in `src/lib/server/hunt/contract.ts`: `let j = i - 1` → `const j = i - 1`.
- [Baseline run #6](https://github.com/Nimadanesh/shakar/actions/runs/39676945092) checked that source SHA on hosted Node `v24.21.0`.
- `npm ci`: PASS.
- Focused portable hunt/search tests: PASS.
- Full portable test suite: PASS.
- TypeScript typecheck: PASS.
- Production build: PASS.
- ESLint: FAIL — 8 errors and 38 warnings; all eight errors are `react-hooks/set-state-in-effect` in UI files, not the engine. The prior `prefer-const` issue in `contract.ts` is fixed.
- Three historical research harnesses are NOT RUN because their frozen inputs are external to the repo. They are explicitly excluded from portable CI, not represented as passing.
- Dependency installation reported 30 vulnerabilities (2 low, 6 moderate, 20 high, 2 critical). No dependency upgrades were applied.
- No live Divar hunt or paired human-quality comparison has been run by this workflow. Build/test success is not search-quality evidence.
- The evaluation repo's current main branch only shows Phase 1 review/packet artifacts. Last known R1a status is 138/138 grades joined; A mean nDCG@5 0.5007, B 0.5539; R1b was not started/reported. A later R2 review had 12 questions around S3 service intent, S4 transaction direction, and S1 variant detection. These are last-known notes; current artifact status must be verified before any new eval action.
- Frozen candidates, captures, grades and mappings remain immutable.

## Must preserve
- Do not change `main` or deploy without explicit authorization.
- Do not alter, overwrite, or rerun completed frozen human-evaluation captures just to improve results.
- Keep unknown evidence distinct from satisfied/violated.
- Do not claim live quality improvement without paired human-judged evidence.
- Treat user grades as evidence, not as technical instructions.
- Do not treat source review or synthetic tests as proof of production quality.

## Current phase
Phase 0 — baseline trustworthiness. Portable checks have genuine results, but the phase exit gate is not yet signed off: stale architecture docs and current evaluation-artifact status must be reconciled, and the golden harness inputs need a safe reproducibility plan.

## Next action
Reconcile architecture/quality docs against current source, verify current R1/R2 artifact status without mutation, then create a prioritized failure register and choose one narrow, measurable search-quality experiment. Avoid unrelated UI refactors. Do not implement a broad rewrite.

## Session close checklist
- [x] Branch/head and changed files verified
- [x] Portable tests, typecheck, lint and build outcomes recorded
- [ ] Evaluation artifacts' current R1/R2 status verified without mutation
- [ ] Architecture/quality docs reconciled
- [ ] First experiment and acceptance gate recorded
- [ ] Next action and go/no-go stated
