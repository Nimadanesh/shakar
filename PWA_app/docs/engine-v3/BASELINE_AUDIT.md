# Baseline Audit — Engine V3

Audit date: 2026-10-22
Audited repository: `Nimadanesh/shakar`
Audited main SHA: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
V3 branch: `engine_v3`

## Executive finding

V3 should not begin with a rewrite. The repo already has a deterministic search pipeline, semantic assessments, synthetic benchmark, golden-evaluation harness and separate human-evaluation artifacts. Hosted Node 24 execution is now established. Portable tests, typecheck and production build pass. ESLint still fails on eight existing UI issues. Three historical research harnesses require frozen files not included in the repo. No live Divar or human-judged quality comparison has been run.

## Hosted baseline run

Workflow: [Engine V3 Baseline run #6](https://github.com/Nimadanesh/shakar/actions/runs/39676945092)
- Tested SHA: `49656d583c43bc8bd7fe3478e0ee4ad5ab5c225e`
- Branch: `engine_v3`
- Runtime: Node `v24.21.0`, npm `11.19.0`, Python `3.12.3`
- `npm ci`: PASS (665 packages added; audit reported 30 vulnerabilities: 2 low, 6 moderate, 20 high, 2 critical)
- Focused portable hunt/search tests: PASS
- Full portable test suite: PASS
- TypeScript typecheck: PASS
- ESLint: FAIL — 8 errors, 38 warnings
- Production build: PASS (Next.js 16.2.1; compiled successfully and generated 38 static pages in run #4; run #6 build also passed)
- Overall run: FAIL due to ESLint
- No live Divar hunts or human-judged quality comparisons were run.

### Why the first three runs failed

Three test files read hard-coded local paths absent from a clean hosted runner:
1. `contractDeleteAudit.test.ts` → `/home/hatch/workspace/ge2-ads.json`
2. `contractGate.test.ts` → `/home/hatch/workspace/your_files/experiment-b-probe-v1.json`
3. `expAFeatures.test.ts` → `/home/hatch/workspace/your_files/intended-contracts-v1.json` plus historical round captures/grades and snapshot data.

The workflow excludes only these three tests from portable CI and explicitly labels them NOT RUN / unavailable evidence. It does not claim those checks passed, and it does not copy frozen evaluation data into the public repository. To execute them later, identify an authorized, protected artifact location and add a deliberate reproducible input mechanism without mutating the existing frozen artifacts.

### ESLint inventory

Run #4 had 9 errors; the engine-file `prefer-const` issue was fixed in commit `49656d583c43bc8bd7fe3478e0ee4ad5ab5c225e`. Run #6 reports 8 errors, all `react-hooks/set-state-in-effect`:
- `src/components/kamin/KaminDetailSheet.tsx:77`
- `src/components/layout/BottomTabBar.tsx:23`
- `src/components/market/MarketSheet.tsx:45`
- `src/components/search/HomeCityUpdateNudge.tsx:87`
- `src/components/search/HuntProgress.tsx:110`
- `src/components/search/SearchSheet.tsx:47`
- `src/components/settings/HomeCityRow.tsx:26`
- `src/hooks/useProfile.ts:114`

Run #6 also reports 38 warnings, including unused imports/variables and unused eslint-disable directives. Do not perform broad unrelated UI cleanup as part of search-quality work.

## Existing code and evaluation assets

- Core engine: `PWA_app/src/lib/server/hunt/pipeline.ts`, `definition.ts`, `contract.ts`, `semantics.ts`, `kindLexicon.ts`, `mizan.ts`.
- Divar retrieval boundary: `PWA_app/src/lib/server/divar/provider.ts`, `divarClient.ts`, `taxonomy.ts`, plus cache/throttle modules.
- Synthetic benchmark: `PWA_app/src/lib/server/hunt/search-quality-benchmark.ts`, version `2026-10-09-v1`, 16 cases; source comments say it is a seed benchmark, not representative live-market evidence.
- Golden harness scripts: `PWA_app/scripts/golden-benchmark.py`, `golden-benchmark-gate.py`, `grades-to-idkeyed.py`, plus experiment-specific scripts. The golden gate has not been run because its precise frozen inputs/grade mapping must first be confirmed.
- Evaluation web app/API: `PWA_app/src/app/eval` and `PWA_app/src/lib/server/eval`.
- The public evaluation repo `Nimadanesh/shakar-eval-tmp-20261012` currently has only the Phase 1 packet/review artifacts on its main branch; latest commit visible there is dated 2026-10-12. Prior project context records R1 capture complete and R1a metrics joined 138/138 grades (A mean nDCG@5 0.5007, B 0.5539), R1b not started/reported, and a later R2 review draft with 12 questions around service intent (S3), transaction direction (S4), and variant detection (S1). These are last-known notes; verify before new evaluation action. Preserve all frozen captures/pins.

## Documentation and quality risks

- `PWA_app/docs/engine-architecture.md` identifies its scope as main @ `4fe671e`, so its baseline pointer is stale.
- `PWA_app/docs/SEARCH-QUALITY-ROADMAP.md` is dated 2026-10-09 and records older branch/SHA context; treat as historical strategy.
- `PWA_app/docs/output-quality.md` is a useful historical flaw/fix ledger, but “done” claims must be verified against current source/tests.
- Still unverified: actual-route enforcement of category/city/price/transaction/MUST/MUST-NOT when detail is missing/stale; retrieval budget and below-shortlist recall; concept conflation; kind/service/transaction-role over/under-fire; Mizan's effective runtime role; human top-result quality.

## Phase 0 status and next gate

**Phase 0 is still in progress.** Portable tests, typecheck and build pass at run #6. Lint remains red for unrelated UI issues. Three research harnesses are unavailable due to absent external frozen inputs. No live Divar or paired human-judged test was run.

Next:
1. Reconcile stale architecture/quality docs against current source.
2. Verify latest R1/R2 status and candidate pins without mutation.
3. Establish a safe, reproducible path for frozen inputs before running the golden harness.
4. Build a prioritized failure register and select the first narrow quality experiment with a measurable acceptance gate.

Do not start a broad rewrite, change `main`, deploy, mutate external services, or claim quality gains without paired human-judged evidence.
