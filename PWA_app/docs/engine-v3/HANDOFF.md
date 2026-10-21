# Engine V3 — Current Handoff

Updated: 2026-10-21
Branch: `engine_v3`
Starting baseline: `10f3c40d70748ff27d6928eaed0875e10dab1c56`

## Mission
Improve real Divar search result quality for professional users. The human owner evaluates product output; the technical agent independently owns investigation, architecture, experiments, and implementation decisions.

## Current verified state
- Branch `engine_v3` has been created from current `main`.
- Initial commit(s) in this workstream add control documentation only.
- No engine source changes, tests, builds, live searches, deployments, or service mutations have been performed in V3 setup.
- Existing source and evaluation artifacts still need a fresh read-only audit.

## Must preserve
- Do not change `main` or deploy without explicit authorization.
- Do not alter, overwrite, or rerun completed frozen human-evaluation captures just to improve results.
- Keep unknown evidence distinct from satisfied/violated.
- Do not claim live quality improvement without paired human-judged evidence.
- Treat user grades as evidence, not as technical instructions.

## Next action
Read `PROJECT_STATE.md`, then audit current code/tests/evaluation assets read-only. Record exact baseline and test status. Do not implement features until Phase 0 exit criteria are met.

## Session close checklist
- [ ] Branch/head and changed files verified
- [ ] Tests/checks explicitly recorded as run/not run
- [ ] Evaluation artifacts preserved and their status recorded
- [ ] Decisions and roadmap updated if evidence changed them
- [ ] Next action and acceptance gate stated
