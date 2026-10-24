# Engine V3 — Current Handoff

Updated: 2026-10-23
Branch: `engine_v3`
Starting baseline: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Current source/test head: 2054d6b9f18fcdf52b996a94852ff81c7da0bf84

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


## Follow-up after explicit trailer live check — 2026-10-22

- [Live run 39758555126](https://github.com/Nimadanesh/shakar/actions/runs/39758555126) on commit `554686fa7d58932e0835b5b32475b4ea6dd34435` added query `کفی تریلی` to the bounded observation harness.
- `کفی تریلی`: 49 ads seen, 48 after duplicate collapse, 8 detail checks, 7 confirmed, 0 near misses, 1 rejected, no stale data. Trailer/flatbed examples remained eligible, supporting the counter-intent.
- `کفی ماشین` returned four top candidates; the three human-graded candidates remained present and retain grade 3. New ungraded lead: `Aafm5Bsf`, `پک کامل روکش صندلی ، کفی ، دورفرمان` (description indicates a three-piece set including a 3D floor mat).
- Next: human-grade `Aafm5Bsf` and a blinded source-matched sample of rejected flatbed candidates. Do not infer a population-level gain from the capped sample.
- Baseline run [39758554980](https://github.com/Nimadanesh/shakar/actions/runs/39758554980) passed focused tests, portable suite, typecheck, and build; ESLint failed with eight unrelated UI `react-hooks/set-state-in-effect` errors. Stay on `engine_v3`; no merge/deploy.


## E3 handoff update — `Aafm5Bsf` graded (2026-10-22)

- Human grade for `Aafm5Bsf` (`پک کامل روکش صندلی ، کفی ، دورفرمان`): provisional grade **2** (the evaluator marked it as a draft). The floor mat is truly included, but only as one of three components in a complete package. This is relevant but not exact, consistent with E34; E17 remains 3 because the floor covering is co-titled as an item in a two-item listing.
- Keep product presence, listing focus, and condition annotations distinct. `gaZjj5GY` remains relevance grade 3 despite a stain.
- Next: build the source-ID-matched blinded packet from frozen E3 allocation records (exact titles/excerpts), with both floor-mat positives and flatbed/trailer-family controls. Do not infer which records the current guard rejected merely from the old allocation report. Then inspect whether any relevant positive is falsely rejected and whether known flatbed negatives are correctly rejected for this intent.
- Stay on `engine_v3`; no merge, deployment, production allocation change, or broad quality claim.


## Latest handoff — source-matched human grades (2026-10-22)

- The latest human-grade addendum is [E3-HUMAN-GRADE-ADDENDUM-PIANO-KAFI-2026-10-22.md](evaluations/E3-HUMAN-GRADE-ADDENDUM-PIANO-KAFI-2026-10-22.md). P01–P06 and K01 now have exact source ad ID/title/rank matches to live artifact `engine-v3-live-observation-20`, run [39767995345](https://github.com/Nimadanesh/shakar/actions/runs/39767995345).
- Do not infer quality uplift: this artifact is an unjudged bounded observation, not a paired baseline run. The human grades are separate labels.
- Evidence gap: the artifact only contains truncated description excerpts, and the repository tree contains no frozen full-detail capture for P02/P05. The baseline check run [39767995269](https://github.com/Nimadanesh/shakar/actions/runs/39767995269) emitted no artifact. The evaluator's grades remain recorded, but the cited acoustic/mechanical identity evidence cannot be independently verified from these immutable sources alone.
- Next step: search for an existing frozen full-detail source outside this repository. If none exists, stop the source-verification attempt and retain an explicit evidence-gap note; do not reconstruct ad details from memory or treat a fresh live fetch as a frozen record.
- Code source/test head: `3bf9bc12df7e50bb018950e17c19c6cb08991138`. Latest branch HEAD is documentation-only. Focused tests, full portable suite, typecheck, and build passed on run 39767995269; ESLint remains failing on 8 unrelated UI hook-rule errors. No search behavior changes, allocation changes, main merge, or deployment.

## Continuation — 2026-10-23

- Current code head at handoff: `70a077e06e069b3d40f1b0673b5289c3194b5539` on `engine_v3`; `main` untouched. Recent buyer-seeking changes are scoped to negative repair/replacement-history product hunts after the broader rejection version broke two existing transaction-direction tests.
- Baseline run [39911832644](https://github.com/Nimadanesh/shakar/actions/runs/39911832644): focused + full portable tests, typecheck, build PASS; ESLint FAIL only on 8 existing UI hook-rule errors (37 warnings).
- Live run [39911832666](https://github.com/Nimadanesh/shakar/actions/runs/39911832666) failed because a Divar request timed out; no observation artifact was produced. Do not claim current-head live confirmation.
- Next: fresh bounded read-only live replay with the same budget and Mizan disabled; if successful, check the four acceptance conditions recorded in PROJECT_STATE, including seller-seeking and ordinary transaction-direction controls. Then build a new blinded human packet for explicit negative history / UNKNOWN history / service / buyer-seeking roles. Keep frozen evaluations immutable; no merge, deployment, or production changes.


## Continuation — bounded live role-boundary evidence (2026-10-23)

- Run [39911832666, attempt 2](https://github.com/Nimadanesh/shakar/actions/runs/39911832666) succeeded on `70a077e`; inspect report summary at [E3-LIVE-OBSERVATION-BUYER-BOUNDARY-2026-10-23.md](evaluations/E3-LIVE-OBSERVATION-BUYER-BOUNDARY-2026-10-23.md).
- Targeted negative-history query rejected the sampled repair-service ad and the sampled buyer-seeking ad; a separate exact-phrase scenario kept two product listings at `near`, while explicit exchange controls remained `exact`.
- Still unverified: seller-seeking refrigerator eligibility, ordinary transaction-direction/ranking parity against a paired baseline, and human-rated relevance uplift. The observation is unjudged and budgeted to 8 details. Do not broaden the guard or declare the acceptance gate complete from this artifact alone.
- Next: prepare a blinded, source-ID-matched packet from these new observation records and existing frozen positives/negatives; separately run the missing seller/ordinary-search regression controls. Preserve frozen evaluation artifacts; stay on `engine_v3`, no merge/deploy.


## Current handoff — negative-history and seller-role controls (2026-10-23)

- [Live observation run 39913211370](https://github.com/Nimadanesh/shakar/actions/runs/39913211370) passed as an execution and produced artifact `engine-v3-live-observation-85`. The seller-role query `فروشنده یخچال` retained two selected listings, and ordinary `یخچال` retained the same two. This does not prove correct role discrimination; one title is explicitly mixed seller/buyer, while resolver `roleMode` is `seek-seller` and `queryRole` remains `product`.
- The same bounded artifact rejected the two checked service/buyer examples for `پیانو تعمیر یا تعویض نشده است`, kept two unknown-history piano listings as `near`, and returned two exact explicit-exchange examples. Details and caveats are in [E3-LIVE-ROLE-REGRESSION-2026-10-23.md](evaluations/E3-LIVE-ROLE-REGRESSION-2026-10-23.md).
- Baseline [run 39913211263](https://github.com/Nimadanesh/shakar/actions/runs/39913211263): focused tests, full portable suite, typecheck, and production build PASS; ESLint FAIL (8 errors / 37 warnings), with errors in existing UI hook-rule locations. This is not a clean CI pass.
- Next: request human grades for blinded packet [BRH-2026-10-23-A](evaluations/BRH-2026-10-23-A-BLIND.md); do not reveal its internal key before grades. No engine change until source-level judgments support it. No merge/deployment.


## Handoff update — blinded grades and recovered B02 (2026-10-23)

- Current branch HEAD at this update: `3784412e8dfb57b9b508396df8e2b5beacab6bdd` on `engine_v3`; `main` remains untouched.
- Owner's grades and interpretation: [BRH-2026-10-23-A-HUMAN-GRADES.md](evaluations/BRH-2026-10-23-A-HUMAN-GRADES.md).
- Source change: `a65b7d3` narrows mid-description `به دنبال` role detection; `68b61b3` adds unit tests. The successful read-only live artifact from run [39915083572](https://github.com/Nimadanesh/shakar/actions/runs/39915083572) shows `پیانو اصلی بتهوون اصلی` now survives as `near` instead of the earlier `no-match`. It is not yet exact: `قطعات` and `اورجینال` remain missing lexical evidence.
- Portable tests, typecheck and build passed on baseline run [39915088347](https://github.com/Nimadanesh/shakar/actions/runs/39915088347); ESLint remains red on existing UI hook-rule errors. Live run [39915087951](https://github.com/Nimadanesh/shakar/actions/runs/39915087951) timed out against Divar and produced no artifact.
- Next bounded task: inspect the existing absence/attribute contract and add paired unit cases for explicit negative replacement history, UNKNOWN history, and the phrase `بدون دستکاری` only if evidence supports a narrow interpretation. Do not add a global synonym, do not convert UNKNOWN into absent, and do not change ranker/global retrieval based on this six-item packet alone. No merge/deploy.

## Continuation — replacement-history polarity characterization (2026-10-23)

- Test-only commit [9a5553445251bd72329e0dd50a43971aa5587d61](https://github.com/Nimadanesh/shakar/commit/9a5553445251bd72329e0dd50a43971aa5587d61) adds three cases to `semantics-r8.test.ts`: explicit `تعویض نشده` → `absent`; explicit `تعویض شده` → `present`; bare `بدون دستکاری` → `unknown` for the replacement-history attribute.
- No production logic changed. This deliberately does NOT turn `بدون دستکاری` into a global synonym for `تعویض نشده`, and it does not attempt to promote the B02 listing to exact: its missing MUST evidence (`قطعات`, `اورجینال`) remains a separate issue.
- The code-path audit confirms `unknown` and `implied` absence polarity cap an otherwise exact result to near; only `absent` is added as positive condition evidence, while `present` is handled as contradiction. The current evidence does not justify adding a fourth polarity or widening the synonym bridge.
- Validation status for commit `9a55534`: not yet independently observed from CI in this session. The baseline workflow is configured for pushes touching `PWA_app/src/**`; its status must be checked before treating the tests as passing.
- Next: inspect the focused/full CI result for `9a55534`. If the characterization tests pass, prepare a separate narrowly scoped evidence test for the combined B02 phrase without altering global absence semantics; if they fail, diagnose the exact polarity mismatch first. No merge to `main`, deployment, or live-service mutation.

## Continuation — B02 phrase characterization (2026-10-23)

- Test-only commit [cd5c7ad760c4749eef545a4289c4750e9f78e546](https://github.com/Nimadanesh/shakar/commit/cd5c7ad760c4749eef545a4289c4750e9f78e546) extends the replacement-history polarity tests:
  - the full human-accepted B02 wording (`بدون تغییر و جابه‌جایی و دستکاری`) remains `unknown` for `تعویض`;
  - explicit positive replacement evidence still resolves to `present` even beside `بدون دستکاری`;
  - explicit negative replacement evidence remains `absent` beside that phrase.
- This is characterization, not a production fix. It documents the current conservative contract and prevents a future generic synonym from overriding direct positive/negative evidence. The human grade 3 for B02 is not discarded; rather, the engine's present absence-attribute model cannot currently encode that broader human judgment as a distinct supporting-but-not-conclusive state.
- CI/status lookup returned no published checks for test commit `9a55534`; this session cannot claim either pass or fail. The new test commit `cd5c7ad` also needs hosted validation.
- Decision: do not add a new polarity or scoped rule yet. First validate these cases in CI and collect at least paired human-graded positive/negative examples where `بدون دستکاری` appears with and without explicit replacement evidence. No merge to `main`, deployment, or live-service mutation.



## Handoff — seller-role paired human review packet (2026-10-23)

- Prepared new blinded packet [BRH-2026-10-23-B](evaluations/BRH-2026-10-23-B-BLIND.md) from the bounded live seller-role/ordinary-search observation. Its internal mapping is [BRH-2026-10-23-B-INTERNAL-KEY.md](evaluations/BRH-2026-10-23-B-INTERNAL-KEY.md); do not share that key before grades are returned.
- The packet compares the same two observed refrigerator listings against `فروشنده یخچال` and ordinary `یخچال`. This pairing directly tests whether human relevance changes with transaction intent; it intentionally contains repeated source listings and only four judgments.
- The observation's engine output was identical for both queries, while the resolver reported `roleMode: seek-seller` for the first and `none` for the second. That is a diagnostic concern, not yet a confirmed user-facing defect. Wait for independent grades before changing role logic.
- No source code changed. The packet and mapping are documentation-only commits on `engine_v3`; `main` and deployment remain untouched. Existing baseline result still stands: focused tests, portable suite, typecheck and build passed on the cited older source SHA; ESLint remains red on known UI hook-rule errors. This does not validate a new source SHA.
- Next: collect grades for B01–B04; then join them to the internal key and decide whether a narrowly scoped role correction is justified. Do not unblind BRH-A retroactively or modify its frozen artifacts.


## Human grades received — BRH-2026-10-23-B (2026-10-23)

- Owner grades: B01=1, B02=2, B03=3, B04=2. Each of the two unique ads scored one grade lower under `فروشنده یخچال` than under ordinary `یخچال`.
- The live engine returned the same two listings in the same order for both queries. This supports a narrow role-intent investigation, not a population-level quality claim.
- Code inspection found `effectiveWantsSellers` returns true both for `roleMode: seek-seller` and default `none`; current role assessment also does not represent a positive seller-seeking listing role. Existing test coverage verifies that an explicit buyer-cue ad falls below a seller offer, but these live examples are not recognized the same way: one is a mixed `خریدوفروش` title and the other is an exchange listing.
- Next: add paired characterization tests for these two exact textual patterns and ordinary-query controls; inspect the existing role/score contract before any production logic change. Do not add a global rejection rule. No main merge or deployment.

## Continuation — BRH-2026-10-23-B paired replay tests (2026-10-23)

- Test-only commit [1f92885932686eea9a9df8568147d24d7372a148](https://github.com/Nimadanesh/shakar/commit/1f92885932686eea9a9df8568147d24d7372a148) adds two pipeline-level paired replay cases to `pipeline.test.ts`.
- Under `فروشنده یخچال`, the test ensures both human-reviewed candidates remain available: the mixed buying/catalogue ad (grade 1) and the barter offer (grade 2). Under ordinary `یخچال`, it ensures both remain eligible, including the barter offer (grade 3) and mixed catalogue (grade 2).
- These are recall-preserving guard tests only; they do not assert that rank order or matchKind now matches the human grades. No production logic changed.
- GitHub combined-status lookup returned no statuses, and the commit-workflow lookup returned no workflow runs. Therefore tests have **not** been independently confirmed passing or failing in hosted CI. Do not infer success from empty status results.
- Next: obtain actual focused test/CI evidence for this new source commit, then use the observed grade-vs-rank mismatch to design a separate ranking/role test before considering production changes. No merge to `main`, deployment, or live-service mutation.


## Continuation — latest source CI and bounded live controls (2026-10-23)

- Source head: [5efe71e90e1f02be4f1bd90e094585056d5782eb](https://github.com/Nimadanesh/shakar/commit/5efe71e90e1f02be4f1bd90e094585056d5782eb), clause-scoped replacement-history polarity.
- Baseline run [39919088080](https://github.com/Nimadanesh/shakar/actions/runs/39919088080): Vitest completed with **849 passed, 7 skipped**; typecheck/build completed. Workflow is red only at the ESLint step, which reports 8 existing React hooks errors and 37 warnings (45 findings total). Do not describe this as a test failure; do not describe the whole workflow as green.
- Read-only live observation run [39919087995](https://github.com/Nimadanesh/shakar/actions/runs/39919087995) succeeded. Its bounded seller-seeking and ordinary refrigerator controls returned the same two unrelated live listings in the same order (فروش یخچال and فروش یخچال سامسونگ A), both exact; these are unjudged observations and do not validate the two human-graded B-packet listings or establish a ranking-quality improvement.
- Current paired replay tests still protect candidate recall only (toContain); they do not assert ordering or matchKind. The human-graded B packet has only two unique ads/four judgments: barter offer outranks mixed buy/sell catalogue under both seller-seeking and generic fridge intent. Treat this as a narrowly scoped hypothesis, not a general ranking rule.
- Next implementation step: add ranking assertions for the exact paired replay and test a bounded explicit mixed-transaction cue. Preserve both candidates; do not turn every occurrence of خرید into buyer intent or globally demote barter/exchange listings. Only retain a production change if role-direction regression tests and generic product controls pass. No merge to main, deployment, or live mutation.


## Continuation — BRH paired ranking correction and validation (2026-10-23)

- Production commits: [4bb37434eaccc52b3c97e684ea83c247096ac5b0](https://github.com/Nimadanesh/shakar/commit/4bb37434eaccc52b3c97e684ea83c247096ac5b0) introduced a narrow mixed buy/sell listing cue and ranking penalty; [51c379c3c1742566540d024345931aebdadc7091](https://github.com/Nimadanesh/shakar/commit/51c379c3c1742566540d024345931aebdadc7091) narrowed that cue to the title only after the first change caused the acoustic-piano regression to fail. This avoids treating ordinary explanatory description text as proof that the listing is a mixed transaction catalogue.
- Hosted baseline run [39920561386](https://github.com/Nimadanesh/shakar/actions/runs/39920561386) for source SHA `51c379c3c1742566540d024345931aebdadc7091`: focused suite **256 passed, 6 skipped**; full portable suite **849 passed, 7 skipped**; production build compiled and TypeScript/build generation completed. The acoustic-piano regression now passes. Workflow remains red only at ESLint: 8 React hooks errors and 37 warnings, consistent with the known existing lint debt; do not report the workflow as fully green.
- Paired BRH human-grade ordering assertions no longer appear among test failures in the latest full suite, and both candidates remain eligible in the paired cases. The bounded live-observation workflow [39920561481](https://github.com/Nimadanesh/shakar/actions/runs/39920561481) succeeded, but its live listings are not human-graded and are not proof of a quality gain.
- This is a very small sample (two unique refrigerator ads, four judgments). The title-only phrase detector is deliberately narrow, but it is still a heuristic and needs more varied examples before any broader claims. Preserve recall and avoid global barter/exchange penalties.
- Current state: branch `engine_v3`; latest source SHA `51c379c3c1742566540d024345931aebdadc7091`. No merge to `main`, deployment, or live-service mutation. Next: add/collect a small paired human-reviewed set covering mixed buy/sell title variants, direct offers, barter offers, and descriptions that merely discuss buying/selling; verify score/matchKind plus ordering, then decide whether this cue generalizes. Keep the existing ESLint debt separate from search-quality changes unless explicitly authorized.


## Continuation — observation 110/111 and baseline 137 reviewed (2026-10-23)

- Read-only artifact review is recorded in [BRH-2026-10-23-RUN110-111-137-OBSERVATION-REVIEW.md](evaluations/BRH-2026-10-23-RUN110-111-137-OBSERVATION-REVIEW.md).
- Run 111 confirms the harness whitespace-regex fix (paint-hint candidates 0 → 3 versus run 110), but the two inspected Samand candidates still have no explicit exchange cue and are not a complete contradiction control. The target-side contradiction gate remains open.
- Baseline 137 is tests/typecheck/build passed but ESLint failed (8 known UI errors, 37 warnings). Do not call it fully green or expand scope to lint cleanup.
- Next: make the next bounded observation select or explicitly fail to capture a candidate with the joint evidence (exchange relation + target Samand + target-scoped paint contradiction). Preserve fixed detail budgets and the existing human-grade distinctions. Continue the blinded seller-role review before proposing any role/ranking change.
- No engine semantics changed in this review. No merge to `main`, deployment, or live-service mutation.


## Continuation — targeted exchange-observation selector updated (2026-10-23)

- Observation-only test-harness change: [638fec1953e8eae43885187818f19e6369de385c](https://github.com/Nimadanesh/shakar/commit/638fec1953e8eae43885187818f19e6369de385c) updates `live-divar-observation.test.ts` to prioritize titles jointly matching Samand + a paint cue + an explicit exchange cue. If no joint title exists, it alternates paint-cue and exchange-cue candidates within the existing two-detail scenario budget, then fills remaining slots from the candidate list without duplicate ad IDs. The artifact now records paint, exchange, and joint-candidate counts plus the selection method.
- This is strictly observation/test tooling. No production semantics, ranking, candidate scoring, detail budget, main branch, or deployment changed.
- Validation is **pending**: no workflow run was returned for commit `638fec1` by the available commit-run lookup, and this session has not run the repository test suite locally. Do not treat the selector as tested or the contradiction control as captured until a fresh live-observation artifact is inspected.
- Next: run the dedicated live observation and baseline validation on this exact source SHA; verify the detail candidate pool actually includes the paired target-side control. If not, preserve the result as “not captured” and do not infer polarity correctness. Baseline ESLint debt remains separate.


## Continuation — run 113 reviewed; follow-up selector awaits observation (2026-10-23)

- Run [39940161861](https://github.com/Nimadanesh/shakar/actions/runs/39940161861) succeeded on `638fec1953e8eae43885187818f19e6369de385c`. Artifact `engine-v3-live-observation-113` shows 90 candidates across 4 pages, 3 paint-cue titles, 17 exchange-cue titles, and no title with the full Samand+paint+exchange intersection. Its two inspected details were a paint-only Samand and a Zantia listing that mentions exchange with Samand; target-scoped paint contradiction is **not captured**.
- Full review appended to [BRH-2026-10-23-RUN110-111-137-OBSERVATION-REVIEW.md](evaluations/BRH-2026-10-23-RUN110-111-137-OBSERVATION-REVIEW.md).
- Follow-up observation-only commit [10c36a92eddf4510e7d20f4afcef89ca1b032eff](https://github.com/Nimadanesh/shakar/commit/10c36a92eddf4510e7d20f4afcef89ca1b032eff) prioritizes Samand+exchange titles before paint-only candidates when a title with all three cues is absent. It retains the fixed detail budget and adds a diagnostic count. **Not yet executed or validated.**
- Next: run the live observation on exactly `10c36a9`, inspect the artifact, then run baseline validation if the workflow allows. If the control is still absent, record “not captured”; do not widen paint/negation rules or alter ranking. Baseline 137 ESLint debt remains separate.
- No main merge, deployment, production semantics or ranking changes.


## Current handoff — run 114 artifact reviewed (2026-10-23)

- Run [39940796881](https://github.com/Nimadanesh/shakar/actions/runs/39940796881) passed on `10c36a92eddf4510e7d20f4afcef89ca1b032eff`; artifact `engine-v3-live-observation-114` inspected.
- Selector outcome: 90 ads / 4 pages; 3 paint cues; 17 exchange cues; 17 Samand+exchange title candidates; zero joint Samand+paint+exchange titles. Details were a Zantia exchange listing mentioning Samand and `معاوضه با تاکسی برون شهری سمند`, whose `بدون رنگ` detail does not unambiguously scope the paint statement to the target Samand.
- Decision: keep exchange-polarity gate **closed**. Control is not captured / referent unresolved. Do not infer success/failure from this artifact, and do not continue blindly stacking title heuristics. Next useful step is a source-matched, explicitly target-scoped human-reviewed example, or a bounded observation design that distinguishes the offered listing from the exchange counterpart while preserving the detail budget.
- Flatbed exchange: two exact sanity-control results. Negative repair-history/service control: two rejected examples. Piano history scenario: no relevant history witness. Refrigerator role comparison: same two listings/order across seller-seeking and generic queries; unjudged, no ranking change justified.
- No production behavior change, merge to `main`, or deployment.


## Current handoff — source-matched exchange evidence audited (2026-10-23)

- Audited the locked Run 102/105/106/109 human packets and the source artifacts, then documented the result in [the observation review](evaluations/BRH-2026-10-23-RUN110-111-137-OBSERVATION-REVIEW.md) and [PROJECT_STATE](PROJECT_STATE.md).
- Confirmed mappings: S04 `gaaTiMpU` grade 3 = target Samand + explicit exchange + target-side `بدونه رنگ`; S03 `gaCLax_r` grade 2 = `بدون نقطه` is not paint evidence; S01 `gabTyjBD` grade 2 = paint-free phrase belongs to the offered Pride; S02 `gabvxlgd` grade 2 = no paint evidence; V01 `gaYj6KeD` grade 0 = explicit paint contradiction on a Peugeot, but its offered/requested direction conflicts with the query and confounds the test.
- **Decision:** the current human evidence covers positive, unknown, wrong-side, missing, and a direction-confounded contradiction, but still lacks a clean contradiction case with the exchange direction correctly matched. Run 114's `معاوضه با تاکسی برون شهری سمند` remains ambiguous and does not fill the gap.
- Next useful work is one new blind, source-ID-mapped live case with explicit paint evidence about the same target vehicle under a valid exchange relation. A synthetic counterfactual can separately test code behavior, but must be labeled synthetic and cannot substitute for live human evidence.
- Do not add more title-selection heuristics blindly; preserve fixed detail budget and the closed integration gate. No production semantics/ranking, `main`, deployment, or human grades changed.


## Current handoff — isolated contradiction state and synthetic controls (2026-10-23)

- `exchangeTargetEvidence.ts` now has an isolated `contradicted` result only for caller-supplied complete contradiction phrases on the target's own segmented side. Positive+contradictory phrases on the same target side return `unknown`; opposite-side evidence stays unknown; generic color mention is not contradiction.
- Synthetic-only tests were added in `exchangeTargetEvidence-brh-run101.test.ts`. They are unit counterfactuals, **not** live Divar evidence and do not replace the missing blind human-grade case.
- Code: [9799adb](https://github.com/Nimadanesh/shakar/commit/9799adb318d71876cff638737d2ceb60f9dba6bd). Tests: [fc40b86](https://github.com/Nimadanesh/shakar/commit/fc40b8604e06c3e9b1c4c15f42b4c651ce6afd66).
- Validation observed so far: focused hunt/search tests passed on run [39942219988](https://github.com/Nimadanesh/shakar/actions/runs/39942219988); full suite, typecheck, ESLint and build had not yet finished when recorded. Run [39942237959](https://github.com/Nimadanesh/shakar/actions/runs/39942237959) for the test commit was pending at note time.
- Next: inspect both baseline run outcomes and address any test/type failures before proceeding. Do not connect this helper to ranking. Then collect a clean, direction-matched, human-reviewed live contradiction example; preserve the fixed detail budget and keep `main`/deployment untouched.


## Latest handoff update — 2026-10-23, Samand replay run #116

- Latest observation/config commit: [a61658c](https://github.com/Nimadanesh/shakar/commit/a61658cba82621b0dbae3b263fcd8ae9b0bb2b59). The previous run's actual pagination had already reached 8 pages; its static report limits incorrectly said 4. This commit fixes the reported ceiling and per-scenario `maxPages` metadata.
- Live run [#116](https://github.com/Nimadanesh/shakar/actions/runs/39943428579) succeeded: `معاوضه سمند رنگ دارد`, 8/8 pages, 186 ads, 32 Samand+exchange candidates, zero titles with Samand+exchange+paint together. Detail calls: 2 for this scenario, 8 globally.
- Source `ga4iPfzH` is a direction/ownership trap: paint and replaced-hood evidence belongs to the offered motorcycle, while the Samand is the counterparty. Source `galu34HS` has no paint evidence about the Samand. Neither provides the missing clean, direction-matched contradiction.
- Baseline run [#145](https://github.com/Nimadanesh/shakar/actions/runs/39943428525): focused tests, full portable suite, typecheck and build pass; ESLint remains failed due to 8 known unrelated UI errors and 37 warnings.
- **Next action:** do not add more page widening or connect the isolated helper to ranking. Prepare a compact blinded human review around transaction direction and which entity each attribute describes. Keep `UNKNOWN` distinct; no merge to `main`, deployment, or production mutation.


## Handoff — blinded exchange-attribute ownership packet C (2026-10-23)

- Prepared [BRH-2026-10-23-C-BLIND.md](evaluations/BRH-2026-10-23-C-BLIND.md) from the exact frozen description excerpts in live observation run [39943428579](https://github.com/Nimadanesh/shakar/actions/runs/39943428579). Internal source mapping is in [BRH-2026-10-23-C-INTERNAL-KEY.md](evaluations/BRH-2026-10-23-C-INTERNAL-KEY.md); do not expose it before judgments are returned.
- The two cases target a narrow human-evaluation question: separate the offered motorcycle's paint/hood history from the requested white Samand/other counterpart (C01), and distinguish Xantia condition evidence from missing Samand condition evidence (C02).
- The packet asks structured attribution questions rather than reusing the old 0–3 relevance grades. It omits source IDs, ranks, and engine labels. It is a two-ad diagnostic packet, not a representative quality estimate.
- Expected evidence limits are explicit in the key: C01 is wrong-side attribute evidence; C02 has no target-side paint evidence. Neither fills the clean target-side contradiction gap. Do not infer a grade or quality result before the evaluator returns judgments.
- No production source or ranking logic changed. The existing contradiction helper remains isolated; the integration gate remains closed. No `main` merge, deployment, live-service mutation, or frozen-grade edit.
- Next: collect the C01/C02 ownership judgments, record them without editing the blind packet, then reassess whether a different source-capture strategy is warranted. Do not widen the detail budget or add title heuristics solely to force a contradiction example.


## Packet C judgment update — 2026-10-23

- Judgments recorded in [BRH-2026-10-23-C-JUDGMENT-RECORD.md](evaluations/BRH-2026-10-23-C-JUDGMENT-RECORD.md). The blind packet remains unchanged.
- C01 and C02 both have no explicit paint/body evidence about the requested Samand. C01's bodywork statements refer to the offered car; C02's engine/chassis statements refer to the offered Xantia. Neither is a target-side contradiction case.
- Correction: earlier handoff wording called C01's offered vehicle a motorcycle. That was wrong. The frozen excerpt's motorcycle phrase is a price comparison; the hood, fender, AC, clutch-plate, and car references describe a passenger car, model year 1384. Exact make is not established. The internal key has been corrected.
- These two judgments do not establish inter-rater agreement or close the clean contradiction evidence gap. Keep UNKNOWN distinct. No engine/ranking changes, main merge, deployment, or live-service mutation.

## Continuation — Samand exchange candidate-pool observability (2026-10-23)

- Re-inspected the frozen run 116 artifact and the selector in `live-divar-observation.test.ts`. The 8-page / 2-detail Samand scenario saw 186 candidates, including 32 Samand+exchange title candidates, but the artifact retained only aggregate counts and the two selected detail records. This made it impossible to make a source-informed next selection from the full title pool.
- Observation-only commit [6e15829](https://github.com/Nimadanesh/shakar/commit/6e1582966462431556af3219b957ff8357a91b51) adds a bounded inventory of up to 40 Samand+exchange candidate IDs and exact titles to the live-observation artifact. It does not change candidate selection, detail-fetch budget, retrieval limits, production code, ranking, or grades.
- The commit was verified on `engine_v3`; combined status lookup returned no CI checks, so validation is **not yet confirmed**. No new live observation has run on this commit. Do not treat the inventory as captured until a fresh artifact exists.
- Next: run the same read-only observation with the unchanged 8-page/2-detail scenario budget, inspect the exact title inventory, then decide whether any candidate merits a blinded detail review. If no direction-matched contradiction candidate is evident, record the gap and stop rather than stacking another heuristic. Keep `UNKNOWN` distinct; no merge to `main`, deployment, or production mutation.

## Run 117 reviewed; next bounded query prepared (2026-10-23)

- Run [#117](https://github.com/Nimadanesh/shakar/actions/runs/39945846455) succeeded on `6e1582966462431556af3219b957ff8357a91b51`. It respected the 8-page / 2-detail Samand scenario budget and recorded the new bounded title inventory (30 Samand+exchange titles).
- The title pool had zero joint Samand + paint + exchange title cues. The two inspected details repeat the previously judged pattern: C01's paint claims belong to the offered car; C02's engine/chassis claims belong to the offered Xantia. Neither is a target-Samand contradiction.
- Review: [BRH-2026-10-23-RUN117-OBSERVATION-REVIEW.md](evaluations/BRH-2026-10-23-RUN117-OBSERVATION-REVIEW.md).
- Observation-only follow-up commit [9de158e](https://github.com/Nimadanesh/shakar/commit/9de158e946e271d968f4dfaf0b673e451b1e5a3f) changes only the scenario query to `معاوضه با سمند بدون رنگ`. Scenario ID and 8-page / 2-detail budget remain unchanged. This query change alters the retrieval distribution; do not describe the next run as a paired comparison.
- No new run or CI result for [9de158e](https://github.com/Nimadanesh/shakar/commit/9de158e946e271d968f4dfaf0b673e451b1e5a3f) is confirmed yet. Inspect the next artifact before any blind packet or rule change. If no candidate has clear exchange direction, target-side paint ownership, and explicit contradiction, record the gap and stop. No ranking change, merge, or deployment.


## Run 118 reviewed — explicit no-paint query (2026-10-23)

- Read-only observation [run #118](https://github.com/Nimadanesh/shakar/actions/runs/39946256433) completed successfully on commit [9de158e](https://github.com/Nimadanesh/shakar/commit/9de158e946e271d968f4dfaf0b673e451b1e5a3f). Query: `معاوضه با سمند بدون رنگ`; 8/8 list pages, 193 ads seen, 1 duplicate collapsed, 192 candidates after filters. Detail budget remained 2 for this scenario and 8/8 globally.
- The title inventory surfaced 84 Samand+exchange candidates, 11 paint-hint candidates, and 5 joint title-cue candidates. This changes the observed candidate pool compared with run 117; it is not a paired quality comparison.
- D01 (`gaXvBpp8`, `تیبا ۹۵ بیرنگ دوگانه معاوضه با سمند دوگانه سفید`) explicitly describes the offered Tiba as `بدون رنگ`, while the requested Samand is described as white. White color is not proof of paint history. D02 (`ga_KqrRw`, `سمند معاوضه‌با فیدلیتی پرایم بدون رنگ`) has ambiguous attribute ownership: the short description says `ماشین ... بدون رنگ` but does not identify which side.
- Prepared blinded packet [BRH-2026-10-23-D-BLIND.md](evaluations/BRH-2026-10-23-D-BLIND.md) and separate internal mapping [BRH-2026-10-23-D-INTERNAL-KEY.md](evaluations/BRH-2026-10-23-D-INTERNAL-KEY.md). Await independent judgments. These two title-selected ads do not establish a clean target-Samand contradiction.
- Keep the exchange-target helper isolated; no ranker change, production semantic change, merge to `main`, or deployment. Preserve `UNKNOWN` as distinct from support and contradiction. Do not use engine labels as human relevance judgments.


## Packet D judgments received — 2026-10-23

- Human judgments for [BRH-2026-10-23-D-BLIND.md](evaluations/BRH-2026-10-23-D-BLIND.md) are recorded in [BRH-2026-10-23-D-JUDGMENT-RECORD.md](evaluations/BRH-2026-10-23-D-JUDGMENT-RECORD.md).
- D01: offered Tiba is explicitly `بدون رنگ`; requested Samand is only described as white. This is wrong-side evidence, not support or contradiction about Samand.
- D02: transaction direction is inferred from title convention and the `بدون رنگ` referent remains ambiguous. Samand paint status is unresolved.
- Both judgments align with the internal mapping. The packet adds attribution evidence but no clean direction-matched contradiction witness. Keep `UNKNOWN` distinct and the helper isolated; no selector/ranking/query semantics change, no merge, and no deployment.
- Stop pursuing this specific title-cue path rather than stacking heuristics. Wait for an explicit, source-matched target-side contradiction; synthetic fixtures remain unit tests only.


## Packet A — current engine alignment audit (2026-10-23)

- The already-locked grades `A01=2, A02=0, A03=2, A04=0, B01=1, B02=3` were matched to existing engine observations; the blind packet was not regraded.
- Full audit: [BRH-2026-10-23-A-CURRENT-ENGINE-ALIGNMENT.md](evaluations/BRH-2026-10-23-A-CURRENT-ENGINE-ALIGNMENT.md). Source grades remain in [BRH-2026-10-23-A-HUMAN-GRADES.md](evaluations/BRH-2026-10-23-A-HUMAN-GRADES.md).
- A02/A04 controls align with rejection; A01/A03 are relevant-but-unverified `near` results; B01 is a potential over-inclusion at human grade 1, insufficient for a broad consultation hard-reject. A01's later A01-like observation was not the exact same source listing, so do not claim exact per-ID corroboration.
- B02 was recovered from `no-match` to `near` after the scoped buyer-cue fix. Current tests preserve UNKNOWN for its “بدون تغییر و جابه‌جایی و دستکاری” wording; engine still lacks explicit MUST evidence for `قطعات` and `اورجینال`. Human grade 3 is not equivalent to a full engine match.
- Latest code-bearing baseline [run #147](https://github.com/Nimadanesh/shakar/actions/runs/39946256547): focused tests, full portable suite, TypeScript and build PASS; ESLint still FAILS on the known 8 unrelated UI hook-rule errors (37 warnings).
- Next gate: prepare a paired, source-matched human-reviewed set contrasting ambiguous “بدون دستکاری/بدون تغییر”, explicit original/no-replacement claims, and explicit replacement claims. Until that evidence exists, keep UNKNOWN distinct, do not add global synonyms or broad consultation rejection, and do not change ranking/production behavior. No `main` merge or deployment.


## Replacement-history paired-evidence gate — bounded capture outcome (2026-10-23)

- Follow-up report: [BRH-2026-10-23-REPLACEMENT-HISTORY-CAPTURE-GAP.md](evaluations/BRH-2026-10-23-REPLACEMENT-HISTORY-CAPTURE-GAP.md).
- A dedicated read-only workflow was added; it caps each observation at 2 list pages / 2 detail reads and keeps `MIZAN_SHADOW=0`. Four bounded probes completed across `پیانو قطعات تعویض شده`, broad `پیانو` discovery, and `پیانو تعویض شده` discovery.
- No probe captured a specific piano listing whose own text explicitly says parts were replaced. Selected results were parts ads, a repair/maintenance service, a lightly used piano with no history claim, a styled-piano/cabinet listing, a piano book, and a toy piano. These are not a valid explicit-replacement control; no new human-review packet was issued and no grades were inferred.
- Reuse locked B02/P03 grade 3 and A01/P01 grade 2 only as already-recorded historical judgments; do not regrade. Keep UNKNOWN distinct and do not infer replacement history from low use, clean appearance, technician inspection, or generic sales language.
- Stop this particular bounded query path rather than adding title heuristics. Next valid gate requires a source-captured, specific piano listing with explicit replacement of a component, distinguishable from spare parts and repair service, before a paired blind packet can be completed.
- Baseline [run #39949779598](https://github.com/Nimadanesh/shakar/actions/runs/39949779598) on SHA `053d0e8`: focused/full portable tests, TypeScript and production build passed; ESLint remains failed on the known 8 unrelated UI hook-rule errors (37 warnings). Latest retrieval-query-only SHA `50a32cb` baseline [run #39949945856](https://github.com/Nimadanesh/shakar/actions/runs/39949945856) completed: focused/full portable tests, TypeScript, and production build passed; ESLint failed on the known 8 unrelated UI hook-rule errors (37 warnings). Live follow-up [run #39949945854](https://github.com/Nimadanesh/shakar/actions/runs/39949945854) succeeded but still captured no explicit-replacement control.
- Test harness/workflow only. No production ranking/semantics change, no `main` merge, no deployment, and no frozen grade/key edits.


## BRH-2026-10-23-B — grading and next action

- The packet has already been graded by the owner: B01=1, B02=2, B03=3, B04=2. Grades are in [BRH-2026-10-23-B-HUMAN-GRADES.md](evaluations/BRH-2026-10-23-B-HUMAN-GRADES.md); keep the blind packet and key frozen.
- Read [BRH-2026-10-23-B-RECONCILIATION.md](evaluations/BRH-2026-10-23-B-RECONCILIATION.md) before touching role ranking. The old observation's code SHA `a65b7d3cfe055cf0c868080de033bbb9a3a6bf9f` predates the owner-confirmed head `d3d424d78d5fe95710a3c9cdff538661eba93be6` by 142 commits, including changes to pipeline and its tests. Current test source asserts the human-preferred order, but has not been rerun in this step.
- Next: focused tests on current branch, then deterministic paired fixture with the exact two listings and emitted score breakdowns. Only propose code changes if current code reproduces the inverted order. No hard reject; mixed listings remain eligible. No `main` merge or deployment.


## Handoff — conjoined mixed-title detector (2026-10-23)

- Open draft PR [#25](https://github.com/Nimadanesh/shakar/pull/25), base `engine_v3`, branch `diagnostic/brh-fridge-conjoined-mixed-role`.
- Shared title-only detector is wired into both current pipeline mixed-role checks and all three reconstructed mixed-cue fields in `live-role-regression-observation.test.ts`.
- Regression coverage includes `فروش و خریدار` and `فروش وخریدار`; mixed listings remain eligible and the direct offer is required to rank first. The live diagnostic cue assertion covers the joined form.
- No new penalty, hard rejection, retrieval change, frozen-grade edit, `main` merge, or deployment.
- **Validation remains pending.** The available GitHub connection exposes workflow reads but no workflow-dispatch action; workflows only auto-trigger on `engine_v3` pushes. Local clone was blocked by DNS/network unavailability. Do not claim tests or live observation passed.
- Next gate: run focused/full portable tests, typecheck, build, and the bounded role-regression live workflow with four details total and Mizan disabled; inspect the emitted report and confirm both B-pair order tests pass before deciding whether to keep the PR draft or revise.

## Continuation — PR #25 merged; validation readout (2026-10-23)

- PR [#25](https://github.com/Nimadanesh/shakar/pull/25) merged into `engine_v3`; merge SHA `f32561fe4cbc1733b8b89feaf023d07a1317ea39`.
- Baseline [39968450657](https://github.com/Nimadanesh/shakar/actions/runs/39968450657): focused hunt/search tests, full portable suite, typecheck, and production build passed. ESLint remains the known unrelated failure (8 UI errors, 37 warnings); do not label the whole workflow green.
- Live role observation [39968450800](https://github.com/Nimadanesh/shakar/actions/runs/39968450800) completed successfully with the 4-detail cap and Mizan disabled. Neither exact historical paired target was found in the 8-page query sets, so this run does not validate the new cue on those ads or provide a human-quality comparison.
- Replacement-history follow-up [39968450511](https://github.com/Nimadanesh/shakar/actions/runs/39968450511) completed successfully but found no explicit component-replacement control. The rare-evidence gap remains open; do not repeat the same bounded query path or infer history from generic repair/sale wording.
- **Next bounded task:** characterize the existing mixed-transaction cue matrix (registered issue 16) with title-only positive, negative, and ordinary controls, preserving both paired refrigerator candidates. Treat this as a diagnostic/test/evidence task first; no new scoring penalty, hard rejection, frozen-grade change, `main` merge, or deployment without source-grounded paired evidence.


## Handoff — PR #39 merged and validated; next bounded role characterization (2026-10-23)

- Current source/test head: `2054d6b9f18fcdf52b996a94852ff81c7da0bf84`.
- PR [#39](https://github.com/Nimadanesh/shakar/pull/39) is merged into `engine_v3`. It normalizes installment and retail-context cues before comparing them to normalized listing text.
- Baseline [40004257638](https://github.com/Nimadanesh/shakar/actions/runs/40004257638): focused tests PASS (301 passed / 8 skipped), full portable suite PASS (894 passed / 9 skipped), typecheck PASS, production build PASS. ESLint still fails on 8 known unrelated UI hook-rule errors (37 warnings); workflow overall is therefore not fully green. The three data-dependent external harnesses remain NOT RUN, not passing.
- Source replay confirms B11 role `product`, `near` + capped, rank 2 behind the actual buyer; B12 and E02 controls pass.
- Live [40004257788](https://github.com/Nimadanesh/shakar/actions/runs/40004257788) succeeded and uploaded `engine-v3-live-observation-130`. It is bounded/unjudged; no E4 human grade or E5 paired comparison was produced.
- Next task: characterize the residual live candidate `gaLNJNwu` (`فروشگاه /خریدار یخچال ساید دوقلو هتلی خراب سوخته`), observed as `unknown`/rank-1 `exact` for `فروشنده یخچال`, while its description solicits broken refrigerators to buy. Build a deterministic paired fixture: this buyer/shop hybrid, a clean seller positive, and an ordinary-search control. Assert current role/ranking first; only then decide whether a narrow buyer cue is justified. Do not promote bare `خریدار` globally because seller copy can mention a buyer.
- Do not mutate frozen grades/captures or claim human-quality uplift. Keep `main` untouched; no deployment or merge without explicit authorization. The technical agent owns the next diagnostic and code decision; ask the owner for grades only if a fresh, blinded human packet is actually needed.


## Current continuation — PR #40 draft, validation pending (2026-10-23)

- Draft PR [#40](https://github.com/Nimadanesh/shakar/pull/40), branch `fix/brh-shop-buyer-hybrid-title-20261023`, adds one narrow title cue for `فروشگاه خریدار` and a paired pipeline test against a clean seller.
- Trigger/inspect focused and full portable baseline on the PR branch, then typecheck/build. The GitHub connection available in this session does not expose workflow dispatch, so do not claim these checks ran until the owner supplies workflow results.
- Review the cross-mode counter-risk: current mixed-listing penalty applies in ordinary hunts too. Do not merge automatically after tests pass; compare the expected product-search consequence against evidence. Keep the PR draft.
- Latest base baseline remains [40004257638](https://github.com/Nimadanesh/shakar/actions/runs/40004257638): focused/full portable tests, typecheck and build pass; ESLint fails on 8 known unrelated UI errors / 37 warnings. Latest live observation [40004257788](https://github.com/Nimadanesh/shakar/actions/runs/40004257788) is bounded and unjudged.
- No frozen-grade edits, no `main` changes, no deployment, no merge without explicit authorization.

## Handoff — PR #40 merged; validation readout (2026-10-23)

- PR [#40](https://github.com/Nimadanesh/shakar/pull/40) is reported merged by the owner. Verified workflow source/test SHA: `3b58b3285ff00ca79859d6dfda85552d93c895e`.
- Baseline [40005149903](https://github.com/Nimadanesh/shakar/actions/runs/40005149903): focused hunt/search suite PASS; full portable suite PASS; TypeScript typecheck PASS; production build PASS. ESLint still fails on the known unrelated UI `react-hooks/set-state-in-effect` errors, so the workflow is not fully green. Do not represent external-data harnesses as passed when their frozen inputs are unavailable.
- Live [40005149996](https://github.com/Nimadanesh/shakar/actions/runs/40005149996) succeeded; artifact `engine-v3-live-observation-131` contains the standard observation and role-regression report. The role report confirms the hybrid title cue fires for `gaLNJNwu`, and the candidate is near/capped; the direct seller ranks first in both `فروشنده یخچال` and ordinary `یخچال` samples. Observation is bounded and unjudged, not an E4 human grade or E5 paired comparison.
- The PR #40 characterization gate is complete: narrow normalized `فروشگاه خریدار` cue, deterministic paired regression, portable checks/build pass, and bounded live trace agrees with expected ordering. Keep broad `خریدار` substring logic out; do not add a hard rejection or expand the pattern without another source-grounded paired case.
- Next technical action: inspect the current registered mixed-transaction cue matrix/issue 16 and choose only the highest-value unresolved case with real positive and negative source controls. If no such evidence exists, document the gap rather than adding a heuristic. Frozen grades and captures remain immutable. `main` and deployment remain out of scope.

## Continuation — bounded mixed-transaction gap capture (PR #28, 2026-10-23)

- Draft [PR #28](https://github.com/Nimadanesh/shakar/pull/28) adds a read-only, max-six-detail capture for the remaining mixed-transaction matrix cells; it is **not merged** and no production behavior is changed.
- Initial capture [run 39974457063](https://github.com/Nimadanesh/shakar/actions/runs/39974457063) succeeded on the PR merge ref and artifact `engine-v3-mixed-transaction-gap-capture` (ID `12510678292`) contained six unique listing snapshots across three refrigerator scenarios, two pages/query, six details total, Mizan disabled. It found compact `خریدوفروش` and spaced `خرید و فروش` examples plus a buyer-seeking listing; the selected pool did **not** contain a clean barter/exchange listing or a buyer-seeking target in the explicit buyer query. All data is ungraded and `productionRank=null`.
- To fill the barter gap rather than blind-grade a packet missing its target case, the barter-condition scenario query was narrowed to `یخچال معاوضه` on the PR branch in commit `3384237c22a1fa1cba4c3c816b9706362de482e7`. Bounded capture run [40006314727](https://github.com/Nimadanesh/shakar/actions/runs/40006314727) was queued/in progress at handoff; inspect its final status and artifact before making a blind packet.
- Do not grade engine labels as relevance. Keep listing IDs/internal cue labels out of the blind packet; store the mapping separately. If the targeted query still fails to find a barter case, report the gap and retain existing source-matched exchange controls instead of inventing a live listing.
- PR #28 remains draft. Do not merge it or deploy without explicit authorization. `main` remains untouched.

## Gap-capture rerun complete — target barter still absent (2026-10-23)

- Targeted bounded rerun [40006314727](https://github.com/Nimadanesh/shakar/actions/runs/40006314727) succeeded on PR #28 head `3384237c22a1fa1cba4c3c816b9706362de482e7`; artifact `engine-v3-mixed-transaction-gap-capture` ID `12523753208`. Six details / six unique IDs across three fridge scenarios; two list pages per scenario; Mizan disabled.
- The `یخچال معاوضه` query still did not return a clean barter listing in its selected two-detail pool. It did return a new shop/buyer-like title variant `Aax4Mkwa` (“فروشگا/خریدار/دوقلو یخچال ساید خراب سوخته کل مناطق”) and a direct shop seller `QaNCuMKq`. The explicit `خریدار یخچال` query selected two seller/product offers, not a buyer-seeking listing. This is a bounded retrieval/candidate-selection gap, not a global absence claim.
- Supplemental four-item blind packet: [BRH-2026-10-23-GAP-CAPTURE-131-BLIND.md](evaluations/BRH-2026-10-23-GAP-CAPTURE-131-BLIND.md); separate mapping: [BRH-2026-10-23-GAP-CAPTURE-131-MAPPING.md](evaluations/BRH-2026-10-23-GAP-CAPTURE-131-MAPPING.md). Query contexts in the packet were checked against the raw capture. Do not open the mapping until grades are locked.
- Existing human-graded sale/exchange refrigerator control remains the best current source-matched barter example; do not fabricate a fresh barter listing. The new packet is supplementary and all engine outputs remain ungraded diagnostics.
- PR #28 remains draft and unmerged. No ranking behavior, `main`, or deployment changed.


## Handoff — supplemental mixed-role grades locked (2026-10-23)

- The owner returned the four blind grades: **X01=1, X02=1, X03=1, X04=1**. Locked record and rationale: [BRH-2026-10-23-GAP-CAPTURE-131-HUMAN-GRADES.md](evaluations/BRH-2026-10-23-GAP-CAPTURE-131-HUMAN-GRADES.md). Blind packet [BRH-2026-10-23-GAP-CAPTURE-131-BLIND.md](evaluations/BRH-2026-10-23-GAP-CAPTURE-131-BLIND.md) remains unchanged; source join is separate in the mapping file.
- Interpretation: 4/4 grade 1 on a non-random E4 sample. X01 is a buyer/dismantler-style offer, not an exchange; X02 and X04 are seller offers under a buyer-seeking query; X03 is a retail seller under an exchange query. The grades show these four surfaced results are weak for the exact contexts but do not prove a single shared code cause or justify expanding cues.
- The bounded capture did not find a clean barter listing; use the existing human-graded sale/exchange control. Do not add a broad buyer rule, hard rejection, or ranking penalty from this packet.
- Next technical step: inspect the current role-control tests and source-matched matrix for a remaining falsifiable gap with both positive and negative controls. If none exists, document the evidence gap rather than stacking title heuristics. PR #28 remains draft/unmerged; no production behavior, `main`, or deployment changed.


## Current handoff — Issue 16 Retargeted Capture 03 (2026-10-24)

- Durable human scores recorded separately from the diagnostic key in [I16-RETARGETED-CAPTURE-03-HUMAN-GRADES.md](evaluations/I16-RETARGETED-CAPTURE-03-HUMAN-GRADES.md): 32/36 across I16-R01–R12 (ten 3s, two 1s).
- Human/motor comparison and the two controlled follow-up hypotheses are in [I16-RETARGETED-CAPTURE-03-RECONCILIATION.md](evaluations/I16-RETARGETED-CAPTURE-03-RECONCILIATION.md).
- Keep the two primary issues separate: (1) I16-R05, grade 3, rejected as appliance-not-home-goods; (2) I16-R03 and I16-R12, grade 1 each, catalyst listings retained for a whole-car hunt. The grade-3 near cases I16-R01/R06/R08 are a separate under-scoring signal.
- Next: design two preregistered controlled tests with unseen IDs only, each with positive and negative controls; freeze the blinded packet before opening its key. No ranking or hard-rejection changes until failures repeat across independent ads and controls remain healthy.
- PR #41 remains Draft/unmerged. Keep main untouched; no merge or deployment. Phase 1 remains active. Baseline status is not all-green: portable tests/typecheck/build are the relevant gates, while the known ESLint UI errors must be reported separately.


## Current handoff — Issue 16 Capture 05F grades locked (2026-10-24)

- Human grades are recorded in [I16-CAPTURE-05F-FRESH-SUBSET-GRADED.md](evaluations/I16-CAPTURE-05F-FRESH-SUBSET-GRADED.md); the source-ID/engine join is separate in [I16-CAPTURE-05F-FRESH-SUBSET-INTERNAL-KEY.md](evaluations/I16-CAPTURE-05F-FRESH-SUBSET-INTERNAL-KEY.md).
- Locked grades: B01=1, B02=3, B03=1, B04=1, B05=1, B06=1, B07=3; mean 1.57/3. The blind packet remains unchanged.
- Capture 05F repeats the wrong-item-kind symptom across catalyst listings, catalyst repair service, and body-parts inventory. A body-parts listing (B04) received engine score 2.8333/`near` but human grade 1. The whole-vehicle buyer/exchange and dealer controls (B02/B07) were grade 3 but engine `near`; preserve buyer-role behavior and do not conflate transaction direction with item kind.
- B06 is a healthy negative control: tire-only exchange was rejected and human grade 1. Exclude source `gapYR7Ug` from analysis because it overlaps concurrent Capture 04B. The seven blind rows were freshness-reconciled; duplicate 05F workflow invocations are not independent samples.
- Next technical step remains evidence-led characterization of the item-kind boundary, not a global keyword or buyer rule. Before any code change, inspect the current typed-kind/head-kind tests and design a small deterministic paired fixture covering (a) whole-vehicle sale/buyer positives, (b) part-only and service negatives, and (c) vehicle/part mentions in the opposite role or description. The evidence collection itself does not authorize a behavior change.
- PR #42 remains Draft/open and unmerged; no engine/ranking change, merge, deployment, or `main` change. Keep Issue 16 evidence-only until the paired characterization is reviewed.


## Continuation — Issue 16 item-kind code-path characterized (2026-10-24)

- Inspected the current `kindLexicon.ts`, `kindLexicon.test.ts`, and pipeline evaluation path on the Issue 16 branch. The vehicle-category bridge can resolve the hunt kind to `vehicle`, but `adKindForTitle` only classifies a small set of title heads. The kind gate intentionally no-ops when the ad head is unknown; it is reached after MUST evidence is present. This explains a plausible route for wrong-kind ads to survive, but does not by itself prove a safe lexicon patch.
- Wrote the source-based code-path analysis and preregistered paired-fixture plan in [I16-CAPTURE-05F-ITEM-KIND-CHARACTERIZATION.md](evaluations/I16-CAPTURE-05F-ITEM-KIND-CHARACTERIZATION.md). It separates known vehicle-head positives from unknown catalyst/body-parts heads and explicitly preserves the human-grade-3 whole-vehicle buyer/dealer controls plus the B06 tire-only negative.
- Important caveat: predicted `adKindForTitle` outcomes are code inspection, not a claimed runtime trace. Next: recover exact source snapshots from the internal key/raw capture, then add a deterministic characterization fixture that logs query kind, ad kind, gate verdict, semantic verdict, and final verdict. If immutable descriptions are missing, record the gap rather than reconstructing them.
- No source/test behavior changes, no engine/ranking changes, no workflow run claimed. PR #42 remains Draft/open/unmerged; `main` untouched; no deployment.


## Issue 16 characterization fixture added — validation pending (2026-10-24)

- Added evidence-only characterization assertions to `kindLexicon.test.ts` in commit `03520ed119e6198e2604ad0d0b360f0be9481590`. The tests document current unknown title-head outcomes for all seven source-matched 05F titles, retain the known `فروش پراید` vehicle-head positive, and demonstrate that category fallback `vehicle` plus unknown ad head currently yields no kind-gate verdict.
- These assertions intentionally characterize the gap; they are not a proposed final contract. They do not alter runtime behavior and must be replaced/refined alongside any future approved fix rather than mistaken for a passing quality solution.
- No test run is claimed: this session's GitHub connection does not expose workflow dispatch or local test execution. Next: validate the branch's focused test workflow if an automatic run is available; then add the full-pipeline paired fixture only after exact snapshots and expected baseline verdicts are source-matched. Keep PR #42 Draft/open; no merge, deployment, or `main` change.


## Deterministic validation path added (2026-10-24)

- Added `.github/workflows/engine-v3-issue16-kind-characterization.yml` in commit `a8953f4cf2ddf9212b67a5c826d176a5b85b5363`. Unlike the bounded live-capture workflows, it runs only the deterministic `kindLexicon.test.ts` suite on relevant PR changes; it does not call Divar or use live-observation environment flags.
- GitHub's commit-associated workflow-run query currently returns no run for that commit, so validation is still pending and no pass is claimed. If PR checks do not appear, inspect the PR's check suite/trigger state rather than assuming the tests passed.
- Scope remains characterization only: the added assertions document current behavior and are not an endorsed fix. No production code changed. PR #42 remains Draft/open/unmerged; `main` untouched; no deployment.


## Correction — validation workflow (2026-10-24)

The temporary `.github/workflows/engine-v3-issue16-kind-characterization.yml` was removed in commit `e2163611e297b2a8e86a24d56ff071337518b7cd` because no run was observed. The characterization tests remain unexecuted; no pass is claimed. PR #42 stays Draft and unmerged; no production behavior change, deployment, or `main` change.


## Validation update — focused kind-lexicon suite passed (2026-10-24)

- Updated `.github/workflows/engine-v3-issue16-capture05f.yml` to run `npx vitest run src/lib/server/hunt/kindLexicon.test.ts --reporter=verbose` before its bounded capture, and included that test file in the workflow path filter. This provides an automatic validation path instead of the removed temporary workflow.
- On PR head commit `0439ceb71f234990cf54a52bcfea94a42eba4604`, GitHub Actions run [40077450054](https://github.com/Nimadanesh/shakar/actions/runs/40077450054) completed `npm ci` and the **kind-lexicon unit/characterization test step succeeded**. The overall workflow is not yet complete because the bounded 05F live capture is still running; therefore this is a focused test-step pass, not a claim that the whole workflow or full-pipeline fixture passed.
- Updating PR #42 caused other pre-existing capture workflows whose path filters match the cumulative PR diff to start as well (runs 40077450012, 40077450018, 40077450020, 40077450044, 40077450077). Their observations are not independent samples and must not be merged into the existing graded evidence without artifact reconciliation.
- Next: let the bounded runs reach terminal states, inspect only the relevant test step and reports, and then implement a source-grounded deterministic paired fixture. No production behavior change, merge, deployment, or `main` change. PR #42 remains Draft/open/unmerged.


## Capture 05F selector audit and focused validation (2026-10-24)

- Auditing raw artifact `12552478200` exposed capture-cell selection errors: a body-parts inventory was labelled `whole-clean` because later vehicle names appeared in its title; a tire-only exchange was labelled `whole-with-part-mention`; and the FMC511 whole-vehicle dealer offer was labelled `other-part` because of the substring `موتور`. These are capture-helper errors, not engine verdict changes.
- Corrected `isCell` in `live-issue16-capture-05f.test.ts` to prioritize part heads and anchor whole-vehicle matches to the title head, with an explicit FMC511 dealer control. This changes diagnostic selection only, not production code.
- On branch head `99172c9ca8dc9ace47953dc40245ba8f5829d45f`, [run 40077666348](https://github.com/Nimadanesh/shakar/actions/runs/40077666348) completed successfully: the focused `kindLexicon.test.ts` step passed, the bounded Capture 05F step completed, and artifact `12554390133` was uploaded.
- The corrected selector now reports the whole-car-with-secondary-part-mention cell as `missing-cell` rather than falsely using the tire-only exchange. That positive counter-control remains an evidence gap. Seven other raw cells were captured; no human grades have been assigned, and these rows must not be merged into the locked graded sample or counted as independent of duplicate workflow runs.
- Next: capture a valid whole-car listing with a secondary part mention, then construct the deterministic full-pipeline paired fixture from immutable source snapshots. Do not change production behavior before that. PR #42 remains Draft/open/unmerged; no deployment; `main` untouched.


## Capture 05F rerun — rim/whole-car positive remains missing (2026-10-24)

- Bounded run [40078480388](https://github.com/Nimadanesh/shakar/actions/runs/40078480388) completed successfully on PR head `19f6b781019748a57356fb83ccdac9091eb521b3`. The focused `kindLexicon.test.ts` step passed and Capture 05F uploaded raw artifact `12553809257`.
- The adjusted retrieval query `پراید رینگ اسپرت` still yielded `missing-cell` for `whole-with-part-mention` after two pages / 50 ads. This is a bounded retrieval/selector gap, not evidence that no such Divar listing exists. Do not keep changing query terms blindly.
- This artifact again captured seven diagnostic rows against the fixed target `خرید و فروش خودرو`: a clean Dena sale, a whole-car damaged-vehicle buyer, two catalyst-only offers, a catalyst repair/buy/sell service, a bumper inventory offer, and a complete engine offer. All seven were engine-eligible `near`; the catalyst/service/parts rows are raw diagnostics, not new human grades. This repeat corroborates the existing symptom but is not an independent human-quality sample.
- Next: stop live-query iteration for this cell. Build the deterministic paired characterization from exact immutable snapshots already present in the locked 05F internal key and raw artifacts, explicitly marking the whole-car-with-secondary-part-mention case as unavailable unless an exact source snapshot can be recovered. Include grade-3 whole-vehicle buyer/dealer positives, part/service negatives, and the grade-1 tire-only exchange negative; assert current query-kind, ad-kind, gate, semantic, and final outcomes before proposing any behavior change. If the secondary-mention positive cannot be source-matched, keep that as an explicit test limitation rather than fabricating it.
- No production behavior or ranking change. PR #42 remains Draft/open/unmerged; `main` untouched; no deployment.


## Continuation — HEAD_KIND three-reader audit (2026-10-24)

- Added [I16-HEAD-KIND-THREE-READER-AUDIT-2026-10-24.md](evaluations/I16-HEAD-KIND-THREE-READER-AUDIT-2026-10-24.md), commit `a2591d59c09acfcc6b0ddb0da820642f8107d412`. This is documentation/diagnosis only; no production code, ranking, or eligibility behavior changed.
- The three readers are ad title-head classification, query-subject resolution, and the same-kind co-offered-marker guard. A `HEAD_KIND` entry is not safe merely because it correctly labels a part-headed ad.
- Key counter-risk: mapping `کاتالیزور` to `vehicle-part` can make a direct catalyst hunt resolve to the broad `vehicle-part` kind, causing existing same-kind part markers (e.g. battery/disc/brake markers) to be skipped. A catalyst-specific hunt may then admit a different part. Also, a dictionary entry alone does not repair `خرید فروش کاتالیزور`, because production `adKindForTitle` does not skip leading `خرید`.
- `بدنه` remains too ambiguous for a broad entry. `لوازم یدکی` is a stronger shadow-test candidate but still needs the query-subject and same-kind marker counter-tests.
- Next: extend the test-only shadow matrix with direct specific-part queries, unrelated same-kind part controls, and role-prefixed title cases. Keep B02/B07/D02/D05/D07 whole-vehicle positives and B06 tire-only negative intact. The whole-car-with-secondary-part-mention source cell remains missing; do not fabricate it or substitute the tire-only exchange.
- No production lexicon/marker edits, rank changes, merge, deployment, or `main` change. PR #42 remains Draft/open/unmerged.


## Follow-up — test-only same-kind counter-risk captured (2026-10-24)

- Extended `issue16-shadow-kind.test.ts` in commits `c7af4487bd3f47e9756aa26ffd02ea94ec8d84ec` and `62185a97f51797d3e2e215215c4d43a2598972bd`. The added assertions compare current vehicle-category fallback with a hypothetical `vehicle-part` query kind and show that the existing `دیسک` part marker is rejected under the current kind but skipped by the same-kind marker guard under the hypothetical broad part kind.
- This is a **counter-risk characterization**, not a recommendation to preserve the current behavior or a production change. It demonstrates why a new `HEAD_KIND` entry can affect direct part hunts, not only whole-car false positives.
- A commit-associated workflow query for the latest test commit returned no runs. The new assertions are therefore **not yet validated**; do not claim they passed. The previously reported 131-test green run predates these additions.
- Next: obtain a real focused test run through the existing workflow path, or inspect the relevant PR check suite if available. If no run is triggered, report validation pending rather than adding another workflow or inferring success. PR #42 stays Draft/open; no production logic, ranking, merge, deployment, or `main` change.


## Continuation — paired shadow-kind controls prepared (2026-10-24)

- Created isolated test branch `experiment/issue16-shadow-paired-20261024` from merged `engine_v3` commit `c2f7eaf5232addab48752d61cfa5622fc232a039`. No PR was opened, because the Capture 05F workflow's PR path filter includes the shadow test and could start a live Divar capture unintentionally.
- Extended `PWA_app/src/lib/server/hunt/issue16-shadow-kind.test.ts` only. The shadow parser's local role-cue list now includes `پخش`, allowing the source-matched D08 exhaust/catalyst title to expose its principal part head after the distribution cue.
- Added a source-title paired table covering B01–B07 and D02/D03/D05/D07/D08. It asserts candidate shadow kind and the corresponding kind-gate verdict separately: part-only controls should reject for a broad vehicle hunt; known whole-vehicle controls should pass; unknown FMC511 dealer head remains unknown/no-op. These are test-only candidate outcomes, not production behavior and not human grades.
- This extends the existing full-pipeline characterization on `engine_v3`; it does not modify `kindLexicon.ts`, `pipeline.ts`, production ranking, or the merged branch.
- Validation is pending. No local runner/network access is available in this session, and no Actions run has been claimed. Safest validation is to manually run **Engine V3 Baseline** on branch `experiment/issue16-shadow-paired-20261024`; this workflow does not perform live Capture. Inspect the focused Vitest output for `issue16-shadow-kind.test.ts` and `kindLexicon.test.ts` before deciding the next step.
- The genuine whole-car-with-secondary-part-mention control is still missing from the locked source set. Do not claim that counter-control is covered, and do not promote the candidate parser or change production classification until an exact-source positive is found or the cell is explicitly closed as unavailable and the risk is reviewed.
- `main` remains untouched; no deployment, production behavior change, or merge was performed.

## Issue 16 paired shadow validation — Baseline #168 (2026-10-24)

- Current branch head: `d45b370df78f5d3e0367d31c7364a146e19513c6` on `engine_v3`; `main` remains `10f3c40d70748ff27d6928eaed0875e10dab1c56`, untouched.
- Baseline [run #168](https://github.com/Nimadanesh/shakar/actions/runs/40088623923) completed on the current head. Focused hunt/search tests passed (316), full portable suite passed (909), TypeScript typecheck passed, and production build passed. ESLint failed in its separate step; this is not an all-green CI run. The test counts are each one higher than run #167.
- The added `issue16-shadow-kind.test.ts` assertions are validated by the focused/full test steps. They remain **test-only shadow outcomes**, not production classifications, live retrieval outcomes, or human relevance grades.
- Evidence still blocks a production lexicon change: the exact-source positive for a whole-vehicle listing whose secondary part mention must not trigger rejection remains missing. Synthetic title examples in the shadow test are parser-behavior checks only and must not be represented as source-matched evidence.
- Keep `HEAD_KIND`, `PART_MARKERS`, the production parser, ranking, and eligibility unchanged. Preserve B02/B07/D02/D05/D07 whole-vehicle controls, B06 tire-only negative, and the direct-specific-part same-kind counter-risk. Unknown remains no-op.
- Next: seek the missing positive only in immutable, source-identifiable capture records already available; do not iterate live search terms blindly or reconstruct listing text. If no exact source snapshot is recoverable, explicitly close the source-recovery attempt as unavailable and retain the risk in the decision record. A production fix still requires a safe three-reader design and source-grounded paired controls.
- No production behavior change, merge, deployment, or `main` change.

## Issue 16 — source-backed part-marker control recovered (2026-10-24)

- New audit: [I16-SECONDARY-PART-POSITIVE-RECOVERY-2026-10-24.md](evaluations/I16-SECONDARY-PART-POSITIVE-RECOVERY-2026-10-24.md).
- The missing semantic positive was found in the already-frozen 05D blind packet: D05, source ad `gacTnnuH`, human grade 3. Its whole-vehicle title is `دنا پلاس توربو اتومات بدون رنگ 1400 فروش فوری`; its body mentions `کمک فنر` and `تایر` secondarily. This directly exercises existing `PART_MARKERS` vocabulary while preserving a clean whole-vehicle subject.
- A test-only regression was added to `issue16-shadow-kind.test.ts`: source-backed D05 must not mismatch/reject, paired with source-backed B04 body-parts inventory (human grade 1), which must still reject. These assertions target `assessModelSpecificity` itself, unlike the existing shadow title parser assertions.
- This is a post-capture audit of immutable, human-graded source text; it does not alter original cell labels, IDs, or grades. It partially closes the positive-control gap, but does not establish a safe production `HEAD_KIND` change. The three-reader counter-risk and transaction-prefix parsing remain separate.
- The new test has been committed on `engine_v3`; its CI run must be checked before treating the regression as validated. Keep production logic, ranking, eligibility, and `main` unchanged. No merge/deploy authorized.

### Regression CI status after source-control recovery

- The first two runs after adding the new source-backed regression failed in the focused and full test steps: [#40089229618](https://github.com/Nimadanesh/shakar/actions/runs/40089229618) and [#40089346829](https://github.com/Nimadanesh/shakar/actions/runs/40089346829). Typecheck and build passed on #40089346829; ESLint still failed separately. The connector did not expose downloadable job logs, so the precise failing assertion could not be verified from logs.
- The test-only pair was refined: the negative now uses source-backed H05F-B03, whose subject-leading `چراغ` is an existing `PART_MARKERS` entry, instead of assuming `بدنه` is already a production marker. The positive now uses the full Dena Plus Turbo automatic query terms so unrelated variant demotion does not confound the marker guard test.
- Rerun [#40089436758](https://github.com/Nimadanesh/shakar/actions/runs/40089436758) is underway on test commit `93109026e28a7cccbd359be884be1a8d697b86fe`. Do not call the new regression validated until the focused and full suite steps pass. All changes remain test/documentation-only; production logic and `main` remain untouched.

## Issue 16 — paired regression confirmed by Baseline #171 (2026-10-24)

- User-reported run [Baseline #171](https://github.com/Nimadanesh/shakar/actions/runs/40089436758) on test commit `93109026e28a7cccbd359be884be1a8d697b86fe` completed: focused tests **318 passed**, full portable suite **911 passed**. This is exactly +2 in each count relative to Baseline #168 (316 focused / 909 full).
- The source-backed paired control in `issue16-shadow-kind.test.ts` is validated by the focused and full test steps. The positive uses frozen, human-grade-3 D05 whole-vehicle evidence with secondary existing part markers; the negative uses frozen H05F-B03 parts-inventory evidence with a subject-leading existing marker.
- The workflow's overall failure remains attributable to the separate ESLint step, per the reported run; do not describe CI as fully green. Typecheck/build status should only be repeated if independently confirmed for #171.
- The test pair is now evidence-backed and regression-tested, but it validates the current guard behavior only. It does **not** resolve the production `HEAD_KIND` three-reader design risk or transaction-role-prefix parsing, and does not authorize a production lexicon/parser/ranking/eligibility change.
- Next safe step: update the Issue 16 decision/audit record to distinguish (a) recovered and validated marker-guard positive/negative controls from (b) unresolved production design risks; then continue a read-only source-grounded three-reader/role-prefix audit. No production code, merge, deploy, or `main` change without explicit approval.

## Issue 16 — specific-part same-kind counter-risk diagnostic (2026-10-24)

- Added a synthetic test-only counterexample in `PWA_app/src/lib/server/hunt/issue16-shadow-kind.test.ts`: the listing subject is `دیسک ترمز پراید سالم`, while `کاتالیزور` appears only secondarily in the body. Current `vehicle` query kind rejects on the `دیسک` marker; hypothetical `vehicle-part` causes the shared-kind guard to skip that marker and the mismatch disappears.
- This is a mechanism-level diagnostic fixture only, not a source ad, human grade, or claim of a measured production false positive.
- Baseline #172 on test commit `f60241139d96be2bba82e274ffdbab0a04ce93f4` was triggered and is pending: https://github.com/Nimadanesh/shakar/actions/runs/40090307284
- Audit addendum updated in [I16-HEAD-KIND-THREE-READER-AUDIT-2026-10-24.md](evaluations/I16-HEAD-KIND-THREE-READER-AUDIT-2026-10-24.md). The decision remains no production lexicon/parser/ranking/eligibility change; no merge, deployment, or `main` modification.

### Baseline #172 outcome — Issue 16 counter-risk diagnostic (2026-10-24)

- Run [#172](https://github.com/Nimadanesh/shakar/actions/runs/40090307284) completed on test commit `f60241139d96be2bba82e274ffdbab0a04ce93f4`.
- Focused hunt/search tests, full portable suite, TypeScript typecheck, and production build all passed. ESLint failed in its separate step, so the workflow is **not fully green**.
- The GitHub job summary exposed step conclusions but not test counts, and downloadable job logs were unavailable in this session. Do not claim exact #172 test counts from this inspection.
- The synthetic third-reader counterexample therefore passed the automated suites: it documents a mechanism-level false-acceptance risk if a direct part query is broadened to the shared `vehicle-part` kind. It is not a real listing or human-quality finding.
- Next: do a bounded, read-only characterization of current production versus shadow outcomes for the frozen role-prefix titles (including `خرید فروش کاتالیزور`, `فروش لوازم یدکی...`, and `خریدار خودرو تصادفی`), keeping item-kind and transaction-role verdicts separate. No production change, merge, deployment, or `main` modification.
