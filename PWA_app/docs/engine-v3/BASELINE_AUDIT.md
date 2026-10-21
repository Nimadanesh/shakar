# Baseline Audit — Engine V3

Audit date: 2026-10-22
Audited repository: `Nimadanesh/shakar`
Audited main SHA: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
V3 branch: `engine_v3`
Current source/test head: `b8327e033b96ab40f3568051dcdfaae107de50a0`

## Executive finding

The hosted Node 24 path is working. The latest portable run passes focused tests, full portable tests, typecheck, and production build; ESLint remains red on eight unrelated UI errors and 38 warnings. A bounded read-only live observation has now been run on four critical query families. It exposed two high-severity false-positive patterns, both patched with regression tests. No human-grade paired comparison has been run, so these are verified code/output corrections, not a claim of overall search-quality improvement.

## Latest portable baseline

[Run on SHA `b8327e033b96ab40f3568051dcdfaae107de50a0`](https://github.com/Nimadanesh/shakar/actions/runs/39682413600)
- Runtime: Node `v24.21.0`, npm `11.19.0`
- `npm ci`: PASS
- Focused hunt/search tests: PASS
- Full portable test suite: PASS
- TypeScript typecheck: PASS
- Production build: PASS
- ESLint: FAIL — 8 `react-hooks/set-state-in-effect` errors and 38 warnings
- Overall workflow: FAIL due to ESLint only
- The eight errors are in `KaminDetailSheet.tsx:77`, `BottomTabBar.tsx:23`, `MarketSheet.tsx:45`, `HomeCityUpdateNudge.tsx:87`, `HuntProgress.tsx:110`, `SearchSheet.tsx:47`, `HomeCityRow.tsx:26`, and `useProfile.ts:114`. No unrelated UI cleanup was included.
- The three historical research harnesses remain NOT RUN because their frozen files are external to the repository.

## Bounded live observation

[Run on SHA `f2d94846a24b272616d27b442454d9b2de42ecdb`](https://github.com/Nimadanesh/shakar/actions/runs/39682408569)
- Node `v24.21.0`
- Queries: `پیانو اکوستیک`, `کفی ماشین`, `تعمیر یخچال`, `ماشین بدون رنگ`
- Limits: max 2 list pages and 8 detail fetches per query
- Mizan disabled; no model judging calls
- No Supabase writes: slug-capture data was buffered only to the runner temp directory
- The report is an ungraded observation; it does not compute precision/nDCG or represent a paired candidate pool.

### Findings and patches

1. **Styled acoustic piano false positive.** In the initial observation, `پیانو دیجیتال یاماها طرح آکوستیک` was `exact` for `پیانو اکوستیک`. The new title-scoped style-prefix guard moves that listing to `near`; real acoustic listings remain `exact`. Tests cover the variant, a clean acoustic control, explicit requests for the styled product, and a description-only comparison that must not demote a clean title.
2. **Car parts in a whole-car hunt.** The initial `ماشین بدون رنگ` sample showed `جک ماشین` and `چهار عدد کمک ماشین پراید` as near-misses. The bounded part lexicon now recognizes `جک` and vehicle `کمک` as parts. Pipeline tests assert those are rejected while a whole-car listing mentioning a jack remains exact. In the latest live observation after this patch, neither of those two part listings appeared in the top eight.
3. **Part hunt sanity check.** The first three `کفی ماشین` results were actual floor-mat listings marked exact; unrelated electronics were near, not exact.
4. **Service-intent sanity check.** The top exact results for `تعمیر یخچال` were service offers. This is a positive bounded observation, not evidence that service intent is solved for all language/roles.
5. **Explicit absence sanity check.** A listing explicitly marked `بی‌رنگ` was exact for `ماشین بدون رنگ`; listings with insufficient paint evidence stayed near.

## Still open

- Current R1/R2 artifact status is not independently recoverable from the public evaluation repo; last-known R1a figures are historical context only. Frozen artifacts remain untouched.
- The golden harness has not been run because exact frozen inputs/mappings have not been safely established in the repo.
- Production candidate coverage below the 100-detail cap is unmeasured. The live observation used only 8 details/query.
- No paired human-grade comparison for the new fixes exists.
- Dependency installation previously reported 30 vulnerabilities (2 low, 6 moderate, 20 high, 2 critical); no dependency upgrades were applied.

## Next gate

Run `E3-DETAIL-ALLOCATION-01` from [FAILURE_REGISTER.md](./FAILURE_REGISTER.md): one fixed query/candidate pool, same detail budget, current top-100 allocation versus a small exploration-budget alternative. Do not alter frozen human evaluation data, change `main`, deploy, or claim overall quality gains without fresh human grades.
