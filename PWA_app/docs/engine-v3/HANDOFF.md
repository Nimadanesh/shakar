# Engine V3 — Current Handoff

Updated: 2026-10-22
Branch: `engine_v3`
Starting baseline: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Baseline workflow commit: `84bb3591677e8d8c0f364292fd9b801d59d4a929`

## Mission

Improve real Divar search result quality for professional users. The human owner evaluates product output; the technical agent independently owns investigation, architecture, experiments, and implementation decisions.

## Verified state
- Branch `engine_v3` exists from current `main`.
- No engine source files have been changed in V3.
- A branch-scoped workflow exists at [`.github/workflows/engine-v3-baseline.yml`](https://github.com/Nimadanesh/shakar/blob/engine_v3/.github/workflows/engine-v3-baseline.yml). It selects Node 24, runs `npm ci` and then focused hunt tests, full tests, typecheck, lint, and build.
- GitHub Actions currently reports zero runs for the branch and workflow commit. This means the workflow definition is committed, but execution is not yet verified. Do not claim any check ran or passed.
- Remote inspection found an existing 16-case synthetic benchmark (`2026-10-09-v1`), golden-benchmark scripts/gate, and separate human-evaluation artifacts in `Nimadanesh/shakar-eval-tmp-20261012`.
- Existing architecture/roadmap docs contain stale baseline pointers; they must be reconciled against current code.
- The separate human-evaluation repo includes a 60-observation real-ad packet/replay. Its artifacts and prior pinned candidates must remain immutable. Verify current R1/R2 state before any new evaluation action.
- The local container still cannot clone GitHub and has Node 22.16.0; the hosted-runner path is prepared but has not produced an observed run.

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
Get the workflow to actually start using a supported Actions trigger, then inspect its run and logs. If the run fails, classify the failure (workflow/configuration, install, existing tests, typecheck, lint, or build) and resolve it on `engine_v3`. Do not implement features before the baseline gate. Do not deploy or mutate external services.

## Session close checklist
- [ ] Branch/head and changed files verified
- [ ] Tests/checks explicitly recorded as run/not run
- [ ] Evaluation artifacts preserved and their status recorded
- [ ] Decisions and roadmap updated if evidence changed them
- [ ] Next action and acceptance gate stated
