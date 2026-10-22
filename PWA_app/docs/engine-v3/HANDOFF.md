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


## Latest allocation experiment — 2026-10-22

- Current branch/reporting commit: `a1233202cb20918ac012bfd0ec3c916f16fe0506` on `engine_v3`.
- Read-only paired experiment [run](https://github.com/Nimadanesh/shakar/actions/runs/39740034802) completed successfully and emitted artifact `engine-v3-detail-allocation-multi-4`. It records allocation-disagreement candidates for both `کفی ماشین` and `تعمیر یخچال`.
- The tested comparison remains baseline top-100 by title strength versus top-80 plus 20 evenly spaced ranks 101–200. Previous top-20 reporting showed no visible top-20 changes for either query. Aggregate exact/near engine verdicts vary but are not human-quality evidence.
- Blinded packet E01–E20 is prepared from 5 sampled baseline-only and 5 sampled alternative-only candidates per query, randomized together with titles and description excerpts. The allocation labels and mapping are withheld pending grades.
- Baseline check [run](https://github.com/Nimadanesh/shakar/actions/runs/39740035012): focused tests, full portable suite, TypeScript typecheck, and production build PASS; ESLint FAIL remains due to unrelated existing UI debt (8 errors / 38 warnings).
- No production allocation change, merge, deployment, or frozen-evaluation mutation occurred.

## Next action

The allocation comparison is closed: preserve the current allocation; do not promote 80/20 on this evidence. The corrected human grades and source-matching audit are in `evaluations/E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md`. Continue with `evaluations/E3-QUERY-INTENT-KAFI-01.md`: source records are now pinned and the current code path has been audited. A narrow `floorMatFlatbedConflict` guard and focused/pipeline tests have now been added on `engine_v3`; CI is in progress. Next, verify the test results, fix any genuine regression, then run a bounded read-only live replay and blinded human review including rejected candidates. Do not globally map `کفی` to a part/accessory kind. Do not merge to main or deploy. No production allocation change, main merge, or deployment.


## Human review received — packet integrity caveat (2026-10-22)

- Raw grades recorded in [E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md](evaluations/E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md), commit `68d6d44a7f7f19539e0f63bd051d3b1ed5ba58e7`.
- Human evaluator graded all 10 `تعمیر یخچال` examples exact. For `کفی ماشین` with explicit intent **automotive floor mats**, E17 and E19 are exact and the other eight are irrelevant, including E14 (a vehicle sold with a flatbed/bar).
- Integrity audit found the presented packet was not reliably balanced 5 candidates per arm per query and some titles/descriptions were paraphrased. Preserve the raw grades as valid ad judgments, but do not use them to estimate per-arm quality or approve 80/20 allocation.
- Correct next step: prepare a source-matched balanced packet, reuse grades only where exact source candidate identity is confirmed, collect missing grades, then reveal the allocation mapping. Production allocation remains unchanged.


## Allocation decision after human grades — 2026-10-22

- Human grades E01–E34 and the source-matching audit are recorded in [E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md](evaluations/E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md), latest commit `ffc3793c0bea8ce7c93f185f927855933a718a0e`.
- For `کفی ماشین` with explicit intent automotive floor mats, the 8 sampled baseline-only and 8 sampled alternative-only candidates each contain one exact floor-mat result and seven irrelevant trailer/flatbed-family results (1/8 exact each). The alternative has no observed human-quality advantage. Refrigerator candidates were relevant in both arms; small unequal samples do not establish superiority.
- The two methods' top 20 were identical in both queries. **Do not promote the 80/20 allocation; preserve the existing allocation.**
- Next: treat `کفی ماشین` as a query-understanding issue—distinguish automotive floor mats from trailer flatbeds and trailer services—then design a narrow paired test with positive floor-mat controls and hard negative trailer cases. No behavior change, merge, or deployment until explicitly authorized and supported by paired evidence.


## Current E3 handoff — `کفی ماشین` (2026-10-22)

- Read the full evaluation record: [E3-QUERY-INTENT-KAFI-01.md](evaluations/E3-QUERY-INTENT-KAFI-01.md).
- Guard additions were observed in [bounded live run 39756287700](https://github.com/Nimadanesh/shakar/actions/runs/39756287700), commit `97bf6101c779f903f613cca0c1a5ae22f89ffa82`. Query results: 49 ads seen, 48 after duplicate collapse, 8 detail checks, 3 confirmed, 2 near misses, 5 rejected; no stale data.
- Human grades: `gaYfODFa` = 3, `gaZjj5GY` = 3, `gaZftRr4` = 3. For `gaZjj5GY`, preserve relevance grade 3 and record the driver-side stain separately as a condition observation; do not penalize relevance for condition.
- Frozen prior controls: `gaYjJe4y` and `gaXjCsU5` are positive grade-3 controls; `gaA3NPYd` is a grade-0 hard negative for the floor-mat intent. Reuse only exact source-ID matches.
- Next: build a blinded packet of exact source-matched rejected flatbed/trailer candidates and retained positives; then run the explicit `کفی تریلی` live counter-intent and verify relevant trailer listings remain eligible. Do not broaden the cue list without false-rejection review.
- Validation caveat: [workflow 39756287701](https://github.com/Nimadanesh/shakar/actions/runs/39756287701) passed focused tests, portable suite, typecheck, and build, but ESLint failed on eight unrelated UI `react-hooks/set-state-in-effect` errors. Do not call this a clean CI pass.
- Stay on `engine_v3`. No merge, deployment, production allocation change, or overall search-quality claim.
