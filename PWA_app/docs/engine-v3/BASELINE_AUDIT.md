# Baseline Audit — Engine V3

Audit date: 2026-10-22
Audited repository: `Nimadanesh/shakar`
Audited main SHA: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
V3 branch: `engine_v3`

## Executive finding

V3 should not begin with a rewrite. The repo already has a deterministic search pipeline, semantic assessments, synthetic benchmark, golden-evaluation harness and separate human-evaluation artifacts. The first baseline is now executed on GitHub-hosted Node 24. Portable tests, typecheck and production build pass; ESLint fails on existing issues; three historical research harnesses require frozen files not included in the repo. No engine source changes have been made in V3.

## Hosted baseline run

Workflow: [Engine V3 Baseline run #4](https://github.com/Nimadanesh/shakar/actions/runs/39676527704)
- Tested SHA: `76216d62017afbaa23820afc85e0c34885a95fc9`
- Branch: `engine_v3`
- Runtime: Node `v24.21.0`, npm `11.19.0`, Python `3.12.3`
- `npm ci`: PASS (665 packages added; audit reported 30 vulnerabilities: 2 low, 6 moderate, 20 high, 2 critical)
- Focused portable hunt/search tests: PASS
- Full portable test suite: PASS
- TypeScript typecheck: PASS
- ESLint: FAIL — 9 errors, 38 warnings
- Production build: PASS (Next.js 16.2.1; compiled successfully, TypeScript passed during build, 38 static pages generated)
- Overall run: FAIL due to ESLint
- No live Divar hunts or human-judged quality comparisons were run.

### Why the first three runs failed

Three test files read hard-coded local paths absent from a clean hosted runner:
1. `contractDeleteAudit.test.ts` → `/home/hatch/workspace/ge2-ads.json`
2. `contractGate.test.ts` → `/home/hatch/workspace/your_files/experiment-b-probe-v1.json`
3. `expAFeatures.test.ts` → `/home/hatch/workspace/your_files/intended-contracts-v1.json` plus historical round captures/grades and snapshot data.

The workflow now excludes only those three tests from portable CI and explicitly labels them NOT RUN / unavailable evidence. It does not claim those checks passed, and it does not copy frozen evaluation data into the public repository. To execute them later, identify an authorized, protected artifact location and add a deliberate reproducible input mechanism without mutating the existing frozen artifacts.

### ESLint inventory from run #4

Nine errors:
- `src/components/kamin/KaminDetailSheet.tsx:77` — `react-hooks/set-state-in-effect`
- `src/components/layout/BottomTabBar.tsx:23` — same rule
- `src/components/market/MarketSheet.tsx:45` — same rule
- `src/components/search/HomeCityUpdateNudge.tsx:87` — same rule
- `src/components/search/HuntProgress.tsx:110` — same rule
- `src/components/search/SearchSheet.tsx:47` — same rule
- `src/components/settings/HomeCityRow.tsx:26` — same rule
- `src/hooks/useProfile.ts:114` — same rule
- `src/lib/server/hunt/contract.ts:163` — `prefer-const` (`j` is never reassigned)

There are also 38 warnings, including unused imports/variables and unused eslint-disable directives. Do not perform broad unrelated UI cleanup as part of search-quality work. Inspect the single engine-file lint issue in context before deciding whether a minimal cleanup is warranted.

## Repository and documentation observations

1. Current `main` is `10f3c40d...`, merged from `feat/engine-v2` on 2026-10-21.
2. `PWA_app/docs/engine-architecture.md` identifies its scope as main @ `4fe671e`, so its baseline pointer is stale.
3. `PWA_app/docs/SEARCH-QUALITY-ROADMAP.md` is dated 2026-10-09 and records older branch/SHA context; treat as historical strategy.
4. `PWA_app/docs/output-quality.md` is a useful historical flaw/fix ledger, but “done” claims must be verified against current source/tests.
5. `PWA_app/AGENTS.md` is mostly UI/redesign-oriented. V3 control docs provide the search-quality overlay.
6. `PWA_app/package.json` declares Node >=24 and exposes test, lint, typecheck, build and check scripts.

## Existing engine / test assets found

- Core engine: `PWA_app/src/lib/server/hunt/pipeline.ts`, `definition.ts`, `contract.ts`, `semantics.ts`, `kindLexicon.ts`, `mizan.ts`.
- Divar retrieval boundary: `PWA_app/src/lib/server/divar/provider.ts`, `divarClient.ts`, `taxonomy.ts`, plus cache/throttle modules.
- Synthetic benchmark: `PWA_app/src/lib/server/hunt/search-quality-benchmark.ts`, version `2026-10-09-v1`, 16 cases; source comments say it is a seed benchmark, not representative live-market evidence.
- Golden harness scripts: `PWA_app/scripts/golden-benchmark.py`, `golden-benchmark-gate.py`, `grades-to-idkeyed.py`, plus experiment-specific scripts. The golden gate has not been run because its precise frozen inputs/grade mapping must first be confirmed.
- Evaluation web app/API: `PWA_app/src/app/eval` and `PWA_app/src/lib/server/eval`.

## Human-evaluation evidence to protect

Separate repo: [`Nimadanesh/shakar-eval-tmp-20261012`](https://github.com/Nimadanesh/shakar-eval-tmp-20261012).

The retained packet README describes 60 real Divar ad observations across 6 queries × 10 ads, detail text, blinded/randomized annotation packets and a mapping manifest. Duplicate-title groups are not independent samples; the pool only covers ads retained after retrieval/detail sampling.

The Phase 1 review artifacts report that replay covered all 60 observations and comparison of Phase 1.4 vs 1.3 had 59 unchanged and 0 changed, with one explicit rejection. That report did not claim quality improvement and said independent human relevance grades were not yet available at that time. Newer R1/R2 artifacts may exist; verify current state before drawing conclusions.

Prior context identifies pinned candidates:
- A: `1278fa42c3d1d1626b1f13ad8cd2a32bad903ef2`
- B: `17fc2e55948060b48ca07e958bdf8696f866b1b`

Do not rerun completed capture cells, modify pinned candidates, alter mappings/grades or change denominator rules. Treat separate evaluation repos as read-only unless a new artifact is deliberately created.

## Quality risks still to verify

- Whether category, city, price, transaction, MUST and MUST-NOT constraints are enforced on the actual current route when detail is missing/stale/ambiguous.
- Whether candidate/detail budgets starve relevant weak-title ads.
- Whether related-but-distinct concepts are collapsed by global synonym expansion.
- Whether kind, service intent and transaction-role assessments over/under-fire on real data.
- Whether Mizan is active in the target runtime; inspect config rather than assuming.
- Whether top results improve on human grades. Tests/build alone do not establish this.

## Phase 0 status and next gate

**Phase 0 is still in progress.** Real execution confirms the portable test suite, typecheck and build work at the tested SHA. ESLint fails on the listed existing issues. Three data-dependent research harnesses remain unavailable, and no live Divar or human-judged comparative test was run.

Next:
1. Verify current R1/R2 status and artifact pins without mutation.
2. Reconcile stale architecture/quality docs against the current source.
3. Inspect `contract.ts:163` and decide whether the trivial lint fix is safe.
4. Define a code-level prioritized failure register and first narrow quality experiment with a measurable acceptance gate.
5. Run the golden harness only after exact frozen inputs and expected grade mapping are established.

Do not start a broad rewrite, change `main`, deploy, mutate external services, or claim quality gains without paired human-judged evidence.
