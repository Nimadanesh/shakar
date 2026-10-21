# Baseline Audit — Engine V3

Audit date: 2026-10-21
Audited repository: `Nimadanesh/shakar`
Audited main SHA: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
V3 branch: `engine_v3`

## Executive finding

V3 should not begin with a rewrite. The repository already contains a substantial deterministic search pipeline, semantic assessments, a synthetic benchmark, a golden-evaluation harness, and a separate human-evaluation artifact repository. The highest-value first move is to reconcile stale documentation, preserve frozen evidence, and run the existing checks in a compatible local environment before making a narrowly targeted quality change.

This audit was performed by remote source/artifact inspection. **No tests, build, live Divar hunt, or local runtime execution were performed.** The container cannot resolve GitHub for a local clone, and its Node version is 22.16.0 while `PWA_app/package.json` requires Node >=24. Do not interpret source inspection as a test pass.

## Repository and documentation observations

1. Current `main` is `10f3c40d...`, merged from `feat/engine-v2` on 2026-10-21.
2. `PWA_app/docs/engine-architecture.md` identifies its scope as main @ `4fe671e`, so its baseline pointer is stale relative to the audited main SHA. Some content may still be accurate, but its commit claim cannot be trusted without reconciliation.
3. `PWA_app/docs/SEARCH-QUALITY-ROADMAP.md` is dated 2026-10-09 and records an older main SHA/branch context. Treat it as historical strategy, not current status.
4. `PWA_app/docs/output-quality.md` is a useful historical flaw/fix ledger, but every "done" claim should be checked against current source and tests before reuse.
5. `PWA_app/AGENTS.md` is mostly UI/redesign-oriented. It gives useful no-drive-by-refactor and verification guidance, but it is not a sufficient search-engine development contract. The V3 rules in this directory are the governing quality-specific overlay.
6. `PWA_app/package.json` provides `test`, `lint`, `typecheck`, `build`, and `check` scripts and declares Node >=24.

## Existing engine / test assets found

- Core engine: `PWA_app/src/lib/server/hunt/pipeline.ts`, `definition.ts`, `contract.ts`, `semantics.ts`, `kindLexicon.ts`, `mizan.ts`.
- Divar retrieval boundary: `PWA_app/src/lib/server/divar/provider.ts`, `divarClient.ts`, `taxonomy.ts`, plus cache/throttle modules.
- Existing unit/regression coverage includes pipeline, definition, semantics, kind lexicon, Mizan, contract gates, recall metrics, runs, and slug capture.
- Synthetic benchmark: `PWA_app/src/lib/server/hunt/search-quality-benchmark.ts`, version `2026-10-09-v1`, with 16 cases and hard-negative examples. Its own comments explicitly say it is a seed benchmark, not a statistically representative live benchmark.
- Metric/harness scripts: `PWA_app/scripts/golden-benchmark.py`, `golden-benchmark-gate.py`, `grades-to-idkeyed.py`, plus experiment-specific scripts. The golden harness refuses missing/mismatched/positional grades rather than emitting partial metrics. Its gate has not been executed by this audit.
- Evaluation web app and API exist under `PWA_app/src/app/eval` and `PWA_app/src/lib/server/eval`.

## Existing human-evaluation evidence to protect

Separate repository: [`Nimadanesh/shakar-eval-tmp-20261012`](https://github.com/Nimadanesh/shakar-eval-tmp-20261012).

The retained packet README describes 60 real Divar ad observations across 6 queries × 10 ads, full detail text for the retained ads, blinded/randomized annotation packets, and a mapping manifest. It notes duplicate-title groups and warns that these observations are not independent; the pool only covers ads that reached the retained detail sample.

The Phase 1 review artifacts report that the replay covered all 60 observations and that the compared Phase 1.4 vs Phase 1.3 mapping had 59 unchanged and 0 changed, with one explicit rejection. That report explicitly does **not** claim quality improvement from the replay; it says there were no independent human relevance judgments at the time of that report. Newer human-evaluation work may exist, so current grade/capture status must be verified before drawing conclusions.

Prior context also identifies pinned candidates:
- A: `1278fa42c3d1d1626b1f13ad8cd2a32bad903ef2`
- B: `17fc2e55948060b48ca07e958bdf8696f866b1b`

Do not rerun completed capture cells, modify pinned candidates, alter mappings/grades, or change denominator rules. Locate and read the current R1/R2 handoff before scheduling any further evaluation. Treat all separate evaluation repos as read-only unless a specific new artifact is intentionally created.

## Quality risks that remain hypotheses pending current-code/runtime verification

- Whether category, city, price, transaction, MUST and MUST-NOT behavior are all enforced on the actual current route, including unknown/stale detail cases.
- Whether the candidate/detail budget systematically starves relevant but weak-title ads.
- Whether related-but-distinct concepts are still conflated by global synonym expansion.
- Whether kind, service intent, and transaction-role assessments over-fire or under-fire on current real data.
- Whether current Mizan integration is active in any target runtime; architecture docs say shadow-only and no production endpoint, but configuration must be inspected rather than assumed.
- Whether the ranking's top results improve on human grades. Neither code shape nor synthetic fixtures establish that.

## Environment limitation and next gate

The remote source connector allowed code and artifact inspection, but the execution container could not clone GitHub because DNS/network resolution failed. Container Node is v22.16.0; the package declares >=24. Therefore no trustworthy fresh test/build status can be reported from this environment.

**Phase 0 is not complete.** The next gate is to obtain an authorized execution environment with Node >=24, run focused search tests, full tests, typecheck, lint, build, and the golden harness gate where its inputs are available, and record exact outputs. Do not start feature implementation merely because the source review looks plausible.
