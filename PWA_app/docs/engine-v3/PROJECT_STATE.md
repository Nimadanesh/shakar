# Project State — Engine V3

Last verified: 2026-10-22
Work branch: `engine_v3`
Branch base: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Latest source fix: `49656d583c43bc8bd7fe3478e0ee4ad5ab5c225e` (single-token lint cleanup in `contract.ts`)
Latest completed baseline run: [Run #6](https://github.com/Nimadanesh/shakar/actions/runs/39676945092), tested commit `49656d583c43bc8bd7fe3478e0ee4ad5ab5c225e`.

## Mission

Maximize the probability that a professional Divar user reaches the best genuinely relevant ads quickly. Optimize real-user result quality, not model sophistication, code volume, or passing synthetic tests alone.

The human owner acts primarily as a blinded/consistent end-user evaluator: run requested hunt scenarios, grade actual top-result relevance and critical constraint behavior, and report unexpected output. The technical agent owns code investigation, architecture, experiments, implementation, measurement, and go/no-go decisions.

## Verified repository state

- `engine_v3` was created from current `main` SHA `10f3c40d70748ff27d6928eaed0875e10dab1c56`.
- No engine/product feature changes have been made in V3. One minimal static cleanup changed `let j = i - 1` to `const j = i - 1` in `src/lib/server/hunt/contract.ts`; this is behavior-preserving and removed one lint error.
- Hosted runner used Node `v24.21.0` with npm `11.19.0`; `npm ci` succeeded.
- Run #6 outcomes: focused portable hunt/search suite PASS; full portable test suite PASS; TypeScript typecheck PASS; production build PASS; ESLint FAIL (8 errors, 38 warnings); overall job FAIL because ESLint failed.
- Remaining lint errors are `react-hooks/set-state-in-effect` in eight UI files: `KaminDetailSheet.tsx:77`, `BottomTabBar.tsx:23`, `MarketSheet.tsx:45`, `HomeCityUpdateNudge.tsx:87`, `HuntProgress.tsx:110`, `SearchSheet.tsx:47`, `HomeCityRow.tsx:26`, and `useProfile.ts:114`. Do not broaden V3 into unrelated UI cleanup.
- `npm ci` reported 30 dependency vulnerabilities (2 low, 6 moderate, 20 high, 2 critical). No automated dependency upgrade/audit fix was applied.
- Three historical research harnesses are explicitly NOT RUN because frozen inputs are external to the repo: `ge2-ads.json`, `experiment-b-probe-v1.json`, and Experiment A contracts/captures/grades/snapshot data under `/home/hatch/workspace`. They are excluded from portable CI, not counted as passing.
- Synthetic benchmark remains 16 cases (`2026-10-09-v1`), a seed benchmark rather than representative live-market evidence.
- The public evaluation repo `Nimadanesh/shakar-eval-tmp-20261012` currently exposes only Phase 1 review/packet artifacts on main; no current R1/R2 handoff files were found there. Last-known project context: R1 capture complete, R1a joined 138/138 grades (mean nDCG@5 A=0.5007, B=0.5539), R1b not started/reported; a later R2 review discussed 12 questions around service intent (S3), transaction direction (S4), and variant detection (S1). These are last-known notes, not proof of current artifact state. Frozen artifacts must remain immutable.
- Historical architecture and quality docs now clearly label stale status as historical and point to V3 controls. Full code-level reconciliation remains pending.

## Current phase

**Phase 0 — portable execution baseline established; formal exit pending source/evaluation reconciliation.**

Verified:
- focused and full portable tests pass;
- typecheck and production build pass;
- lint debt is localized and documented;
- no product behavior changes were made;
- failure hypotheses are ranked in [FAILURE_REGISTER.md](./FAILURE_REGISTER.md).

Not yet verified:
- current R1/R2 handoff beyond last-known context;
- golden harness execution with the exact frozen inputs/mapping;
- live Divar candidate recall and current human top-result quality.

## Next action

Follow [FAILURE_REGISTER.md](./FAILURE_REGISTER.md): service intent is already covered by mocked-provider tests, so do not add duplicate fixtures or heuristics. Recover/trace the latest R2 evidence if available; otherwise define a separate, read-only observation plan to determine whether any current failure is in retrieval, detail allocation, or ranking. Keep frozen R1 artifacts untouched. Do not change `main`, deploy, or claim live quality gains without paired human-judged evidence.
