# Engine V3 — Current Handoff

Updated: 2026-10-22
Branch: `engine_v3`
Starting baseline: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Current source/test head: `dd58188f09d7c0806f116d49a3b005ff1ba8e408`

## Mission

Improve real Divar search result quality for professional users. The human owner is the independent product evaluator; the technical agent owns the implementation decisions and evidence process.

## Verified state
- `engine_v3` is isolated from `main`; no merge/deploy.
- Latest portable baseline [run #19](https://github.com/Nimadanesh/shakar/actions/runs/39682990792): focused tests PASS, full portable suite PASS, typecheck PASS, build PASS, ESLint FAIL (8 unrelated UI errors, 38 warnings).
- The three external-data historical research harnesses are still NOT RUN; their frozen inputs are not in the repository. Do not call them passed.
- Latest bounded read-only live observation [run #9](https://github.com/Nimadanesh/shakar/actions/runs/39682408569) completed successfully on Node 24.21.0, with four queries, at most two list pages and eight detail fetches per query, Mizan disabled.
- Confirmed fix 1: `پیانو دیجیتال یاماها طرح آکوستیک` changed from `exact` to `near` for `پیانو اکوستیک`; real acoustic-piano listings remained exact. Added a style-prefix check that is based on the listing title and respects the original query if the user explicitly asks for `طرح آکوستیک`. Tests cover both positive and counterexamples.
- Confirmed fix 2: `جک ماشین` and `کمک ماشین پراید` were live near-miss false positives for a whole-car hunt. Added these as bounded part markers. Pipeline test ensures these are rejected while a whole-car listing mentioning a jack stays eligible/exact. Latest live sample no longer shows those two part listings in the top results.
- The `کفی ماشین` bounded sample had three correct floor-mat exact results; some unrelated electronics were only near. The `تعمیر یخچال` sample showed service offers at the top. These observations do not prove general production quality.
- The explicit-absence sample correctly showed an explicitly `بی‌رنگ` car as exact and under-described paint cases as near.
- Detail-allocation experiment [run #1](https://github.com/Nimadanesh/shakar/actions/runs/39683008360) completed read-only: 20 pages / 482 candidates / 120 detail fetches for `ماشین بدون رنگ`. TitleStrength fell to 0 by rank 80 and remained 0 through rank 200. Current top-100 selection yielded 1 exact; the counterfactual top-80 + 20 evenly spaced ranks 101–200 yielded 3 exact, including two explicit `بی‌رنگ` vehicles at title ranks 128 and 138. This is an internal engine-verdict signal, not human relevance proof.
- The next step is a small blinded human grade of the unique results from the two allocations. Do not change production allocation until those grades support the tradeoff.
- No human-grade comparison has been run for the new fixes. Do not claim contest-quality gains until fresh, consistent human top-K grades exist.
- Frozen R1 captures, pinned candidates, grades, mappings, and denominators remain immutable.

## Must preserve
- No `main` changes, merge, deployment, or service mutation without explicit authorization.
- No mutation or rerun of completed frozen evaluation artifacts.
- UNKNOWN remains distinct from satisfied/violated.
- No global synonym expansion or broad rewrite without paired evidence.
- Live observations are ungraded snapshots, not nDCG/precision metrics.

## Current phase
Phase 1 — two critical false-positive families have narrow fixes and deterministic regression tests. Portable tests/typecheck/build pass. Lint debt is unrelated UI work.

## Next action
Collect blinded grades for the small detail-allocation packet, preserving all frozen R1 data. If the two lower-title exact candidates are confirmed relevant and no critical errors increase, prototype a deterministic 80/20 exploration allocation on `engine_v3` only and re-evaluate; do not merge/deploy or claim quality improvement yet. Keep technical direction autonomous and ask the human evaluator only for result grades/observations when needed.
