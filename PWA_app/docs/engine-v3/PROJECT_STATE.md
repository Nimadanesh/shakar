# Project State — Engine V3

Last verified: 2026-10-23
Work branch: `engine_v3`
Branch base: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Current source/test head: 2054d6b9f18fcdf52b996a94852ff81c7da0bf84
Latest portable baseline: [Run 39767995269 — source/test SHA `3bf9bc1`](https://github.com/Nimadanesh/shakar/actions/runs/39767995269); focused tests, portable suite, typecheck, and build pass; ESLint fails on 8 pre-existing UI hook-rule errors.
Latest live observation: [Run #9 — SHA `f2d9484`](https://github.com/Nimadanesh/shakar/actions/runs/39682408569)

## Mission

Maximize the probability that a professional Divar user reaches the best genuinely relevant ads quickly. Optimize real-user result quality, not model sophistication, code volume, or passing synthetic tests alone.

The human owner is the independent product evaluator; the technical agent owns code investigation, architecture, experiments, implementation, measurement, and go/no-go decisions. Ask the user for grades only when a concrete fresh sample is ready; never ask them to choose the technical fix.

## Verified repository state

- `engine_v3` remains isolated from `main`. No merge or deployment occurred.
- The earlier behavior-preserving `let` → `const` cleanup remains in `contract.ts`.
- Hosted Node 24 execution is working (`v24.21.0`).
- Latest portable baseline on SHA `b8327e033b96ab40f3568051dcdfaae107de50a0`:
  - focused hunt/search tests: PASS;
  - full portable test suite: PASS;
  - TypeScript typecheck: PASS;
  - production build: PASS;
  - ESLint: FAIL due to 8 existing `react-hooks/set-state-in-effect` errors in unrelated UI files and 38 warnings.
- The three historical research harnesses remain explicitly NOT RUN because their frozen inputs are outside the repo. No result is represented as passing when its data is unavailable.
- The opt-in live workflow uses read-only Divar retrieval, max 2 list pages per query, max 8 detail fetches per query, and disables Mizan shadow calls. It writes a short-lived report artifact; slug captures are buffered only in the runner's temp directory, not written to Supabase.
- Latest live observation on SHA `f2d94846a24b272616d27b442454d9b2de42ecdb` completed successfully across four query families: `پیانو اکوستیک`, `کفی ماشین`, `تعمیر یخچال`, and `ماشین بدون رنگ`. It is a bounded observation, not a human relevance score.
- Detail-allocation experiment [run #1](https://github.com/Nimadanesh/shakar/actions/runs/39683008360) completed on the same query `ماشین بدون رنگ`: 20 list pages, 482 candidates, 120 detail fetches, no stale details. TitleStrength was 2 at rank 1 and 0 by rank 80; ranks 80, 100, 101, 120, 150, and 200 were all 0, so most of the shortlist is a tie resolved by input order.
- On the same candidate pool, the current top-100 allocation produced 1 exact, 39 near, and 60 candidates not returned in the scored output. A counterfactual 80-title-top + 20 evenly spaced candidates from ranks 101–200 produced 3 exact, 41 near, and 56 not returned, including two additional engine-exact cars at title ranks 128 and 138 with explicit `بی‌رنگ` evidence. This is a promising internal signal, not a human-quality metric; no allocation change is approved until a small blinded human grade confirms the relevant gains and counter-risk.
- Confirmed live defect and fix: for `پیانو اکوستیک`, a title `پیانو دیجیتال یاماها طرح آکوستیک` was initially ranked `exact`; after the new style-prefix guard, the same title is `near`, while real acoustic pianos remain `exact`. Deterministic semantic and pipeline tests cover the false-positive, a clean acoustic control, explicit request for a styled piano, and description-only mention protection.
- Confirmed live defect and fix: for `ماشین بدون رنگ`, `جک ماشین` and `چهار عدد کمک ماشین پراید` appeared as near-misses in the initial bounded sample. The part lexicon now recognizes `جک` and `کمک` as part subjects. The portable pipeline test asserts both are rejected while a real car listing that mentions a jack remains exact. In the latest live observation after the code change, the top returned results no longer include those two parts; this is a small live sample, not a full-recall claim.
- Other bounded observations: the first three `کفی ماشین` results were actual floor-mat listings marked exact; unrelated electronics were near. The `تعمیر یخچال` sample's top exact results were service offers. A car explicitly described as `بی‌رنگ` was exact for `ماشین بدون رنگ`, while listings without sufficient paint evidence stayed near.
- The public evaluation repo still exposes the Phase 1 packet/review artifacts, not a current R1/R2 handoff. Last-known R1a context (138/138 grades joined; mean nDCG@5 A=0.5007, B=0.5539) remains historical context only. Frozen captures, pins, grades, mappings, and denominators remain immutable.
- Existing architecture/quality docs have been marked historical where their pointers are stale. Full source reconciliation and a larger candidate-coverage experiment remain open.

## Current phase

**Phase 1 — evidence-backed critical correctness fixes.** The first two observed false-positive families have narrow patches and deterministic regression coverage. Portable tests/typecheck/build pass; lint remains red for unrelated UI debt.

## Next action

Get independent human grades for a small blinded packet from the completed detail-allocation comparison, without touching frozen R1 artifacts. If the grade confirms the two additional exact cars and no critical regression, implement a small deterministic exploration allocation behind an experiment flag and compare again; do not replace production top-100 allocation on engine labels alone. Do not change global synonyms, increase model authority, change `main`, or deploy without explicit authorization.


## Latest allocation experiment — 2026-10-22

- Current reporting commit: `a1233202cb20918ac012bfd0ec3c916f16fe0506` on `engine_v3`.
- Paired read-only multi-query report [run](https://github.com/Nimadanesh/shakar/actions/runs/39740034802), [artifact](https://github.com/Nimadanesh/shakar/actions/runs/39740034802): completed successfully; artifact `engine-v3-detail-allocation-multi-4`.
- Queries: `کفی ماشین` and `تعمیر یخچال`; 20 pages per query, 481/480 post-filter candidates, 120 detail checks per query, no stale data. The baseline is top 100 by title strength; alternative is top 80 plus 20 evenly spaced candidates from ranks 101–200.
- Top 20 remained identical between arms in the preceding top-20 report for both queries. The latest report exposes 20 baseline-only and 19 alternative-only candidates for `کفی ماشین`, and 20 baseline-only and 19 alternative-only candidates for `تعمیر یخچال` (one duplicate collapsed in the latter retrieval). Engine verdict counts differ between arms, but are not human relevance grades.
- A 20-item blinded packet has been prepared: 5 randomly sampled from each allocation-only set for each query, IDs E01–E20, with title and description excerpt only. Arm mapping is intentionally withheld until grades are returned. No allocation decision is approved yet.
- Latest portable baseline [run](https://github.com/Nimadanesh/shakar/actions/runs/39740035012): focused tests PASS, full portable suite PASS, TypeScript typecheck PASS, production build PASS; ESLint FAIL on the known unrelated UI errors (8 errors / 38 warnings). No production allocation changes, merge, or deployment.

## Current next action

The E3 allocation question is closed for now: keep the existing allocation; the 80/20 alternative has no demonstrated human-quality advantage. The source-matched audit and grades are recorded in `evaluations/E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md`. Next, validate the narrow floor-mat/flatbed guard added on `engine_v3`: wait for the focused/full CI checks, inspect failures honestly, then run a bounded read-only live replay and blinded human review for both false positives and false rejections. The source records, code-path audit, acceptance gate, and implementation status are in `evaluations/E3-QUERY-INTENT-KAFI-01.md`. No production allocation change, main merge, or deployment.


## Human review received — packet integrity caveat (2026-10-22)

- Raw grades are recorded in [E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md](evaluations/E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md), commit `68d6d44a7f7f19539e0f63bd051d3b1ed5ba58e7`.
- Query-level observation: `تعمیر یخچال` received 10/10 exact grades; `کفی ماشین`, explicitly intended as automotive floor mats, received 2/10 exact (E17 and E19) and 8/10 irrelevant. E14, an Arisan sold with a flatbed/bar, is correctly 0 for a floor-mat intent.
- Audit found the displayed packet does not reliably satisfy its claimed balanced 5+5 allocation-arm sampling; some presented titles/descriptions were shortened/paraphrased. Consequently, these grades are not valid for an arm-level comparison and must not be used as an 80/20 go/no-go result.
- Next: build a source-matched balanced packet from the actual artifact, reuse grades only for exact candidate-ID matches, collect missing grades, and only then join arm labels. No production allocation change.


## Allocation decision after human grades — 2026-10-22

- Supplemental grades E21–E34 are recorded with the first round in [the evaluation record](evaluations/E3-DETAIL-ALLOCATION-MULTI-04-human-grades.md), latest commit `ffc3793c0bea8ce7c93f185f927855933a718a0e`.
- Across the source-matched sample of allocation-only candidates for `کفی ماشین` (explicit intent: automotive floor mats), baseline-only and alternative-only each had 1 exact match out of 8 sampled candidates (12.5%); the other seven in each arm were irrelevant. No observed relevance advantage for 80/20.
- Refrigerator-service candidates were relevant in both arms (baseline-only 8/8 exact; alternative-only 9/10 exact, 1/10 grade 2). This small unequal sample is diagnostic only.
- Previous top-20 lists were identical for both queries. **Decision: do not promote the 80/20 allocation. Keep current allocation unchanged.** Next high-value work is a narrow query-understanding/intent disambiguation fix for `کفی ماشین` (automotive floor mats vs trailer flatbeds/services), with positive floor-mat controls and hard trailer negatives. No code behavior change is authorized by this result.


## E3 floor-mat guard — live observation and human grades (2026-10-22)

- The narrow `کفی ماشین` guard and monitor/audio cue additions were observed in [bounded live run 39756287700](https://github.com/Nimadanesh/shakar/actions/runs/39756287700), on `engine_v3` at `97bf6101c779f903f613cca0c1a5ae22f89ffa82`.
- For this query: 49 ads seen, 48 after duplicate collapse, 8 details checked; 3 confirmed, 2 near misses, 5 rejected; no stale data. The three retained candidates were all human-graded 3: `gaYfODFa`, `gaZjj5GY`, `gaZftRr4`.
- Candidate `gaZjj5GY` is exactly relevant even though the driver's mat has a stain. Record the stain in a separate condition/quality annotation; preserve relevance grade 3 (H09 lesson).
- Earlier frozen controls remain unchanged: positives `gaYjJe4y`, `gaXjCsU5` (grade 3); hard negative `gaA3NPYd` (grade 0). Do not assign grades to other unreviewed records by inference.
- Evidence is still bounded and unpaired. The explicit `کفی تریلی` live counter-intent and blinded review of rejected flatbed cases are outstanding. No quality-uplift claim, merge, or deployment.
- [Baseline workflow 39756287701](https://github.com/Nimadanesh/shakar/actions/runs/39756287701): focused tests, portable suite, typecheck, and build passed; ESLint still fails on 8 `react-hooks/set-state-in-effect` errors in unrelated UI files.


## Explicit trailer counter-intent — 2026-10-22

- [Live observation run 39758555126](https://github.com/Nimadanesh/shakar/actions/runs/39758555126), commit `554686fa7d58932e0835b5b32475b4ea6dd34435`, added a fresh bounded observation for `کفی تریلی`.
- `کفی تریلی`: 49 ads seen, 48 after duplicate collapse, 8 details checked, 7 confirmed, 0 near misses, 1 rejected, no stale data. Top results included `تریلی کفی و لبه و‌تیغه`, `تریلی کفی سه محور`, and `تریلی کفی`; this supports preservation of the explicit flatbed intent.
- The same run's `کفی ماشین` top four included the three already human-graded exact candidates plus ungraded positive lead `Aafm5Bsf` (`پک کامل روکش صندلی ، کفی ، دورفرمان`). Keep this as an ungraded candidate for the next packet.
- This is bounded observation only, not a paired uplift or full recall claim. Next: grade the new positive and a source-matched blinded sample of rejected flatbed cases. No merge or deploy.


## E3 human grade update — `Aafm5Bsf` (2026-10-22)

- `Aafm5Bsf` (`پک کامل روکش صندلی ، کفی ، دورفرمان`) received provisional human grade **2** (the evaluator submitted it as a draft) for the explicitly intended automotive-floor-mat hunt: the 3D mat is genuinely included but is one of three components of a complete package, not the listing's central product.
- This extends the grading contract: grade 3 requires more than literal presence; account for the target product's role in the listing. E34 is the closer analogy (grade 2); E17 remains grade 3 because the floor covering is co-titled as an item in a two-item listing.
- `gaZjj5GY` remains grade 3 despite a stain; record condition separately.
- Next: source-ID-match the frozen E3 allocation candidates and prepare a small blinded relevance packet with exact titles and excerpts, sampling both genuine floor-mat controls and flatbed/trailer-family records. No engine changes based on this grade alone; no merge/deploy.


## Human-grade source reconciliation — 2026-10-22

- The addendum [E3-HUMAN-GRADE-ADDENDUM-PIANO-KAFI-2026-10-22.md](evaluations/E3-HUMAN-GRADE-ADDENDUM-PIANO-KAFI-2026-10-22.md) maps P01–P06 and K01 to exact ad IDs, titles, and ranks from live observation artifact `engine-v3-live-observation-20` (run [39767995345](https://github.com/Nimadanesh/shakar/actions/runs/39767995345)).
- Human grades are recorded separately from the engine's `matchKind`; this mapping does not establish an uplift or a paired baseline comparison.
- Source/test code head remains `3bf9bc12df7e50bb018950e17c19c6cb08991138`. The latest documentation-only branch head is tracked separately in GitHub.
- The checked-in repository and available live observation report contain no immutable full-detail snapshot for P02/P05; the report has truncated `descriptionExcerpt` fields. The baseline CI run has no artifact. Full acoustic/mechanical evidence and source-matched baseline candidates remain an explicit evidence gap; do not reconstruct them from memory or use a current live ad page as a frozen substitute.
- Current gate: keep the narrow guard on `engine_v3`; do not change allocation, merge to `main`, or deploy. Next evidence step is to locate an existing frozen full-detail source outside this repository or, if none exists, explicitly mark P02/P05 as human-graded but not independently source-verified from the available immutable artifact.

## Continuation update — 2026-10-23, buyer-seeking role boundary

- Verified branch head at session start: `70a077e06e069b3d40f1b0673b5289c3194b5539`; `main` remains outside scope. This update is documentation-only and does not alter engine behavior.
- The current source includes the buyer-seeking guard sequence from `5a92289`, `377f55e`, `8331978`, `57e0d1c` (rejected due to two transaction-direction regressions), `d69ee6f`, and current `70a077e`. The accepted direction is narrow: explicit buyer-seeking ads are hard-rejected only in targeted negative repair/replacement-history product hunts; outside that hunt family they remain eligible for ordinary ranking.
- Latest baseline run [39911832644](https://github.com/Nimadanesh/shakar/actions/runs/39911832644) on `70a077e`: focused tests PASS, full portable suite PASS, TypeScript PASS, production build PASS. ESLint FAILS on 8 existing UI hook-rule errors (37 warnings in this run); no new search-test failure is reported by this workflow.
- Latest bounded live observation [39911832666](https://github.com/Nimadanesh/shakar/actions/runs/39911832666) did NOT complete: the Divar request timed out in the live observation test and no report artifact was produced. Treat this as an unobserved run, not evidence for or against the code behavior. A previous live run on an earlier commit is not a current-head verification.
- Acceptance gate still required: (1) seller-seeking refrigerator listings remain eligible; (2) ordinary searches retain their prior ranking behavior; (3) `پیانو تعمیر یا تعویض نشده است` rejects service offers and buyer-seeking `خریدار ارگ و پیانو` ads while repair-history UNKNOWN stays near; (4) portable tests/typecheck/build pass, with ESLint debt reported separately.
- Next action: obtain a fresh bounded live observation on the current code after the timeout, inspect the exact target-query outputs and controls, then prepare a new blinded human packet spanning explicit negative history, unknown history, service offers, and buyer-seeking ads. Do not change global ranking, merge to `main`, deploy, or alter frozen evaluation artifacts.


## Continuation update — live buyer/service boundary observation (2026-10-23)

- The retry of bounded read-only observation run [39911832666, attempt 2](https://github.com/Nimadanesh/shakar/actions/runs/39911832666) completed successfully on code SHA `70a077e06e069b3d40f1b0673b5289c3194b5539`; artifact `engine-v3-live-observation-84` was inspected and its findings are summarized in [E3-LIVE-OBSERVATION-BUYER-BOUNDARY-2026-10-23.md](evaluations/E3-LIVE-OBSERVATION-BUYER-BOUNDARY-2026-10-23.md).
- Target query `پیانو تعمیر یا تعویض نشده است`, with candidate retrieval query `تعمیر پیانو`, rejected both observed control candidates: `تعمیر پیانو دیجیتال` as `service-offer-for-negative-repair-history-product-hunt`, and `تعمیرLCDکیبورد یاماها اتیری (خریدار ارگ و پیانو )` as `no-match`. This is direct but bounded live evidence for the service/buyer rejection boundary.
- On the same target query, the separate exact-phrase scenario retained `فروشگاه پیانو شهرام فر` and `پیانوC1 AIR KORG ژاپن اصلی` as `near`; this is consistent with not treating UNKNOWN repair history as a confirmed violation. The explicit exchange control `معاوضه با کفی سه محور` returned two exact exchange-role results.
- Limits: 8 details total across 4 scenarios; no seller-seeking refrigerator control was run, and ordinary-search ranking was not compared against a paired baseline. This does not close all acceptance gates or prove human-quality uplift. Keep code unchanged pending source-matched blinded evaluation and explicit seller/ordinary-search regression evidence. No main merge, deployment, or production change.


## Latest bounded observation and baseline — 2026-10-23

- Live observation [run 39913211370](https://github.com/Nimadanesh/shakar/actions/runs/39913211370), source SHA `48703004ea38412538781e53f66800ccaa811d20`, completed successfully; artifact `engine-v3-live-observation-85`. The new seller-role control retained two selected listings for `فروشنده یخچال`; the ordinary `یخچال` control retained the same two. This is a bounded unjudged observation, not a relevance metric or proof that role discrimination is correct. One result is a mixed seller/buyer ad, so seller-role boundary remains unresolved.
- The same artifact observed both selected repair-service/buyer examples rejected for `پیانو تعمیر یا تعویض نشده است`, and two unknown-history piano listings retained as near in a separate scenario. Explicit exchange control returned two exact results. See [E3 live role regression report](evaluations/E3-LIVE-ROLE-REGRESSION-2026-10-23.md).
- Baseline [run 39913211263](https://github.com/Nimadanesh/shakar/actions/runs/39913211263): focused tests, full portable suite, TypeScript typecheck, and production build PASS; ESLint FAIL with 8 errors / 37 warnings, the errors in existing UI hook-rule locations. No new lint error in the observation test was reported.
- Next: obtain blinded human grades for `BRH-2026-10-23-A`; do not change engine behavior based only on these observations. Stay on `engine_v3`; no merge/deploy.


## Human-grade follow-up — buyer-cue false rejection (2026-10-23)

- Owner-supplied blind grades are recorded in [BRH-2026-10-23-A-HUMAN-GRADES.md](evaluations/BRH-2026-10-23-A-HUMAN-GRADES.md); frozen blind packet/key remain unchanged.
- Narrow fix in `a65b7d3` scopes `به دنبال` buyer-role detection so a mid-description phrase in seller copy is not a hard buyer declaration; tests were added in `68b61b3`.
- Successful bounded live run [39915083572](https://github.com/Nimadanesh/shakar/actions/runs/39915083572), artifact `engine-v3-live-observation-86`, observed `پیانو اصلی بتهوون اصلی` recover from `no-match` to `near` for `پیانو قطعات اورجینال تعویض نشده`. It still lacks explicit lexical evidence for `قطعات` and `اورجینال`; do not label this a full match or quality uplift.
- The same successful artifact retained the seller-seeking/ordinary refrigerator controls. Later live run [39915087951](https://github.com/Nimadanesh/shakar/actions/runs/39915087951) timed out against Divar and emitted no artifact.
- Baseline [39915088347](https://github.com/Nimadanesh/shakar/actions/runs/39915088347): focused and full portable tests, TypeScript, and production build PASS; ESLint still FAILS on existing 8 UI hook-rule errors (37 warnings).
- Next: consider a narrowly scoped, evidence-aware treatment of `بدون دستکاری` for replacement-history intent only after paired positive/negative controls. Keep UNKNOWN as UNKNOWN; no global synonym, no merge to `main`, no deployment.

## Replacement-history polarity characterization — 2026-10-23

- Test-only commit [9a5553445251bd72329e0dd50a43971aa5587d61](https://github.com/Nimadanesh/shakar/commit/9a5553445251bd72329e0dd50a43971aa5587d61) adds regression characterization for explicit negative replacement history (`absent`), explicit positive history (`present`), and bare `بدون دستکاری` (`unknown`) when assessing `تعویض`.
- Production semantics unchanged. The current code keeps `unknown`/`implied` as near caps and only counts explicit absence as positive evidence. B02's combined phrase is human-judged grade 3, but the live engine still lacks MUST evidence for `قطعات` and `اورجینال`; this test-only change does not claim to resolve that gap.
- CI for `9a5553445251bd72329e0dd50a43971aa5587d61` has not yet been verified in this session. Check the hosted baseline result before accepting the characterization.
- Next gate: inspect CI; then test the combined B02 wording in a separate scoped fixture and decide whether it warrants an explicit, narrowly scoped evidence state. No global synonym expansion, main merge, or deployment.

## B02 phrase characterization — 2026-10-23

- Test-only commit [cd5c7ad760c4749eef545a4289c4750e9f78e546](https://github.com/Nimadanesh/shakar/commit/cd5c7ad760c4749eef545a4289c4750e9f78e546) pins the full human-accepted B02 wording as `unknown` for replacement history and verifies explicit positive/negative replacement statements retain precedence.
- No production semantics changed. Current engine has no distinct state for condition evidence that is supportive to a human but insufficient to establish a specific replacement-history claim. Adding one from this single human-graded listing would be premature.
- No CI checks were surfaced by status lookup for the prior characterization commit `9a55534`; validation of `cd5c7ad` remains outstanding. Do not call tests passing until a run is inspected.
- Next gate: obtain hosted CI evidence and add paired human-reviewed examples before considering a narrow scoped interpretation. No global synonym, merge, or deployment.



## Latest handoff — paired seller-role review packet (2026-10-23)

- New blinded packet [BRH-2026-10-23-B](evaluations/BRH-2026-10-23-B-BLIND.md) and withheld mapping [BRH-2026-10-23-B-INTERNAL-KEY.md](evaluations/BRH-2026-10-23-B-INTERNAL-KEY.md) are ready for owner grading.
- It uses two exact source listings under both `فروشنده یخچال` and `یخچال`, so the four judgments test the transaction-intent contrast directly. The bounded observation returned the same candidates in the same order for both queries; this remains an unjudged diagnostic signal, not a confirmed defect or quality metric.
- No engine code changed. Only evaluation/handoff documentation was added on `engine_v3`. `main` and deployment remain untouched.
- Next gate: receive B01–B04 grades, then inspect source-matched judgments before any role-logic change. Existing CI results are for earlier source SHAs and must not be represented as validation of the current documentation head.


## Observation review — runs 110/111 and baseline 137 (2026-10-23)

- Review record: [BRH-2026-10-23-RUN110-111-137-OBSERVATION-REVIEW.md](evaluations/BRH-2026-10-23-RUN110-111-137-OBSERVATION-REVIEW.md).
- Observation 110 succeeded on source `2070ae6147f720c8a7e407602b1196a15cee871c`; observation 111 succeeded on `b81451c8d3dc6a1eb80e24fac6f9a992c03db562`. The whitespace fix changed diagnostic `paintHintCandidates` from 0 to 3, confirming the observation-harness matcher is repaired.
- The two inspected Samand paint-cue titles in both runs lacked an explicit exchange cue in the listing audit and remained `near` with `معاوضه` missing. Therefore the intended explicit target-side contradiction control was **not captured**; do not count this as evidence that the engine correctly or incorrectly handles that polarity.
- The run-111 role-regression artifact returned the same two refrigerator listings in the same order for `فروشنده یخچال` and `یخچال`. This is unjudged and non-representative; keep the blinded source-matched human-review gate.
- Baseline 137: focused suite 286 passed/6 skipped; full portable suite 879 passed/7 skipped; TypeScript and production build passed; ESLint failed with 8 known UI errors and 37 warnings. Baseline is not fully green.
- Decision: no engine/ranking change, no merge/deployment. Next observation should prioritize the intersection of explicit exchange + target vehicle + target-scoped paint contradiction; if not found within budget, report the control as not captured.


## Targeted exchange observation selector — pending validation (2026-10-23)

- Observation-only commit [638fec1953e8eae43885187818f19e6369de385c](https://github.com/Nimadanesh/shakar/commit/638fec1953e8eae43885187818f19e6369de385c) now prioritizes a joint title cue (Samand + paint + explicit exchange); absent that, it interleaves paint-cue and exchange-cue candidates under the existing fixed detail budget and deduplicates ad IDs.
- This changes only which candidates the read-only observation harness inspects and what diagnostic counts it reports. No engine or ranking behavior changed.
- Validation remains pending: no workflow run was returned for this commit and tests have not been executed in this session. The contradiction gate remains open until a new artifact proves the relevant candidate was actually captured and its full detail confirms which vehicle the paint statement refers to.
- Next: run and inspect the dedicated observation plus baseline checks on the current source. Do not infer a quality change from title cue counts alone; no merge/deployment.


## Observation 113 reviewed; next bounded selector adjustment (2026-10-23)

- Review: [BRH-2026-10-23-RUN110-111-137-OBSERVATION-REVIEW.md](evaluations/BRH-2026-10-23-RUN110-111-137-OBSERVATION-REVIEW.md).
- Run [39940161861](https://github.com/Nimadanesh/shakar/actions/runs/39940161861) succeeded on `638fec1953e8eae43885187818f19e6369de385c`. For `معاوضه سمند رنگ دارد`, 90 ads were seen, paint cue count=3, exchange cue count=17, joint Samand+paint+exchange title count=0. Two details inspected: a paint-only Samand and a Zantia listing that exchanges with Samand; neither establishes paint status on the target Samand within an explicit exchange relation. Control remains **not captured**.
- Follow-up observation-only selector commit [10c36a92eddf4510e7d20f4afcef89ca1b032eff](https://github.com/Nimadanesh/shakar/commit/10c36a92eddf4510e7d20f4afcef89ca1b032eff) prioritizes Samand+exchange titles before paint-only candidates if no three-cue title exists; fixed detail budget retained. This commit is **not yet run/tested**.
- No engine semantics/ranking change, no merge/deployment. Require a fresh artifact to validate sampling and the target-scoped contradiction witness; otherwise keep the gate open.


## Latest bounded observation — run 114 (2026-10-23)

- [Run 39940796881](https://github.com/Nimadanesh/shakar/actions/runs/39940796881) completed successfully on `10c36a92eddf4510e7d20f4afcef89ca1b032eff`; artifact `engine-v3-live-observation-114` was inspected.
- The Samand scenario saw 90 ads/4 pages, 3 paint-cue titles, 17 exchange-cue titles, 17 Samand+exchange titles, and 0 joint Samand+paint+exchange titles. Two detail slots were used. The listing `معاوضه با تاکسی برون شهری سمند` includes `بدون رنگ`, but referent scope remains ambiguous; it is not accepted as a target-side contradiction witness. Status: **not captured / unresolved**, gate remains closed.
- This is observation-only evidence, not a relevance score or quality uplift. Do not make further selector heuristics or production changes without a better-scoped source example. Keep main/deployment untouched. Other scenario results are small unjudged sanity checks only.


## Source-matched exchange evidence audit (2026-10-23)

- Follow-up audit: [BRH-2026-10-23-RUN110-111-137-OBSERVATION-REVIEW.md](evaluations/BRH-2026-10-23-RUN110-111-137-OBSERVATION-REVIEW.md). Existing locked cases map to source IDs: S04 positive target-side paint evidence `gaaTiMpU` (grade 3); S03 target-side unknown `gaCLax_r` (grade 2); S01 wrong-side paint evidence `gabTyjBD` (grade 2); S02 missing paint evidence `gabvxlgd` (grade 2); V01 explicit paint contradiction `gaYj6KeD` (grade 0) but with a transaction-direction mismatch/confound.
- This establishes positive / unknown / wrong-side / missing states, but **not** a clean, direction-matched human-graded contradiction control. V01 cannot isolate contradiction behavior because its exchange direction does not match the query.
- Next: collect one new blind, source-mapped example with a valid exchange relation and an explicit paint statement about the same target vehicle that contradicts `بدون رنگ`; alternatively add a clearly labeled synthetic fixture for unit-level logic, without claiming it is live evidence. Do not continue title-selector heuristics or integrate ranking logic absent that evidence.
- No source grades changed; no production semantics/ranking, main merge, or deployment.


## Isolated exchange-polarity diagnostic prototype (2026-10-23)

- Added an explicit `contradicted` state to `exchangeTargetEvidence.ts`, based only on caller-supplied exact contradiction phrases scoped to the same segmented target side. Mixed positive and contradiction phrases remain `unknown`; opposite-side evidence does not transfer; generic `رنگ` alone is not a contradiction.
- Added clearly labeled synthetic counterfactuals for requested-side contradiction, opposite-side isolation, conflicting target-side phrases, and generic color mention. These do not count as live evidence or human grades.
- Code commit: [9799adb](https://github.com/Nimadanesh/shakar/commit/9799adb318d71876cff638737d2ceb60f9dba6bd); synthetic test commit: [fc40b86](https://github.com/Nimadanesh/shakar/commit/fc40b8604e06c3e9b1c4c15f42b4c651ce6afd66).
- Baseline run [39942219988](https://github.com/Nimadanesh/shakar/actions/runs/39942219988) reported focused hunt/search tests passing; its full suite/typecheck/lint/build were still in progress when recorded. Baseline run [39942237959](https://github.com/Nimadanesh/shakar/actions/runs/39942237959) for the test commit was pending.
- Helper remains isolated and not integrated into ranking. Human gate remains closed until a direction-matched, human-reviewed live contradiction case exists. No main merge or deployment.


## Update — bounded Samand exchange observation (2026-10-23)

- Corrected the observation harness's reported limits in commit [a61658c](https://github.com/Nimadanesh/shakar/commit/a61658cba82621b0dbae3b263fcd8ae9b0bb2b59): the Samand scenario and global per-query list-page ceiling now report 8 rather than 4. This is reporting/observation configuration only; no ranker integration.
- Live observation run [#116](https://github.com/Nimadanesh/shakar/actions/runs/39943428579) passed on source SHA `a61658c`: query `معاوضه سمند رنگ دارد`, 8/8 pages, 186 ads, 32 Samand+exchange title candidates, zero title candidates with the full Samand+exchange+paint cue set. Detail budget remained 2 for this scenario; global details used 8/8.
- Two details inspected: `ga4iPfzH` is a motorcycle offered in exchange for white Samand/206SD/Pars; its paint/hood claims describe the motorcycle, not the target Samand. `galu34HS` is a Xantia offered for exchange with Samand/Peugeot and has no Samand paint evidence. Neither is a clean target-side contradiction case. Engine verdicts are not human grades.
- Baseline run [#145](https://github.com/Nimadanesh/shakar/actions/runs/39943428525): focused hunt/search tests, full portable suite, typecheck, and build passed; ESLint alone failed on the known 8 unrelated UI hook-rule errors (37 warnings). Keep this debt separate from search findings.
- Decision: do not widen retrieval further or alter ranking on this evidence. Seek a clean direction-matched case through a separately designed human-review sample; preserve UNKNOWN semantics and keep main/deployment untouched.

## Latest observation-harness follow-up — 2026-10-23

- The live Samand exchange observation had 32 Samand+exchange title candidates, but the prior artifact exposed only counts and the two selected detail records. Observation-only commit [6e15829](https://github.com/Nimadanesh/shakar/commit/6e1582966462431556af3219b957ff8357a91b51) now records a bounded inventory of candidate IDs and exact titles, without changing selection or detail budgets.
- This commit has no reported CI status yet and has not been run live. It is instrumentation only; no new evidence about contradiction polarity exists. Next: inspect a fresh inventory under the same 8-page/2-detail limit before making any further selection change.


## Latest bounded observation — run 118 (2026-10-23)

- [Run 118](https://github.com/Nimadanesh/shakar/actions/runs/39946256433) completed successfully on `engine_v3` commit `9de158e946e271d968f4dfaf0b673e451b1e5a3f`, query `معاوضه با سمند بدون رنگ`. It completed 8/8 list pages, saw 193 ads, collapsed 1 duplicate, and inspected 2 details in this scenario (8 details total across four scenarios). Mizan shadow remained disabled.
- The two inspected ads do not provide a clean contradiction for the requested Samand. One explicitly says the offered Tiba is `بدون رنگ` while the requested Samand is merely `سفید`; the other uses `بدون رنگ` without naming which exchange vehicle it describes. Title inventory: 84 Samand+exchange, 11 paint-hint, 5 joint Samand+paint+exchange candidates. This query has a different retrieval distribution from run 117; it is not a paired quality comparison.
- Blinded attribution packet [BRH-2026-10-23-D-BLIND.md](evaluations/BRH-2026-10-23-D-BLIND.md) is ready; its mapping is separately stored in [BRH-2026-10-23-D-INTERNAL-KEY.md](evaluations/BRH-2026-10-23-D-INTERNAL-KEY.md). Await human judgments before drawing attribution conclusions.
- Decision unchanged: no ranker/production behavior changes, no merge to `main`, no deployment. Keep `UNKNOWN` separate from supported and contradicted; engine labels are not human relevance grades.


## Packet D human judgments recorded (2026-10-23)

- Returned judgments for [BRH-2026-10-23-D-BLIND.md](evaluations/BRH-2026-10-23-D-BLIND.md) are documented in [BRH-2026-10-23-D-JUDGMENT-RECORD.md](evaluations/BRH-2026-10-23-D-JUDGMENT-RECORD.md).
- D01: the explicit no-paint claim belongs to the offered Tiba; the requested Samand is described as white only. This is wrong-side evidence, not a Samand paint-history contradiction.
- D02: the claim's vehicle referent remains ambiguous; no conclusion about Samand paint history is justified.
- Both judgments align with the separate internal mapping. The clean, direction-matched target-Samand contradiction evidence gap remains open. Keep `UNKNOWN` distinct, keep the helper isolated, and do not add selector heuristics or alter ranking/production semantics from these records. No merge to `main` or deployment.


## Packet A current-engine alignment — 2026-10-23

- Existing owner grades `A01=2, A02=0, A03=2, A04=0, B01=1, B02=3` were reused as locked evidence; no re-evaluation.
- Alignment record: [BRH-2026-10-23-A-CURRENT-ENGINE-ALIGNMENT.md](evaluations/BRH-2026-10-23-A-CURRENT-ENGINE-ALIGNMENT.md). A02/A04 rejection matches grade 0; A01/A03 near results reflect relevant listings with unproven history; B01 near is a potential over-inclusion but not enough for a global hard-reject.
- B02 changed from `no-match` to `near` after the scoped buyer-cue fix. Its current phrase-level test remains `unknown` for replacement-history polarity and its definition still lacks explicit `قطعات` and `اورجینال` MUST evidence. This is a recovered result, not a full match or proven quality uplift.
- Current-code baseline [run #147](https://github.com/Nimadanesh/shakar/actions/runs/39946256547): focused/full portable tests, TypeScript and production build passed; ESLint failed on the known unrelated 8 UI hook-rule errors (37 warnings).
- Next gate is paired, source-matched human review of ambiguous “بدون دستکاری/بدون تغییر” versus explicit original/no-replacement and explicit replacement claims. Preserve UNKNOWN; no global synonym expansion, consultation hard-reject, ranking change, main merge, or deployment.


## Replacement-history capture gap — 2026-10-23

- Added isolated read-only workflow/test to search for an explicit positive replacement-history control, with two pages and at most two details per run; `MIZAN_SHADOW=0`.
- Four bounded probes completed. None found a specific piano listing explicitly stating that its own component was replaced; observed results were spare-parts/service/adjacent listings or had no history evidence. Details and run provenance are in [BRH-2026-10-23-REPLACEMENT-HISTORY-CAPTURE-GAP.md](evaluations/BRH-2026-10-23-REPLACEMENT-HISTORY-CAPTURE-GAP.md).
- No new blind packet and no human grade was created. Reuse existing B02/P03=3 and A01/P01=2 only as locked evidence; do not regrade or infer a missing third state.
- Stop this query path rather than stacking selector heuristics. The paired-review gate remains open until a source-captured, specific piano listing explicitly states component replacement, distinguishable from a parts ad or repair service.
- Baseline on SHA `053d0e8` passed focused/full portable tests, TypeScript, and production build; ESLint failed on the known 8 unrelated UI hook-rule errors (37 warnings). SHA `50a32cb` baseline [run #39949945856](https://github.com/Nimadanesh/shakar/actions/runs/39949945856) completed: focused/full portable tests, TypeScript, and production build passed; ESLint failed on the known 8 unrelated UI hook-rule errors (37 warnings). The latest live probe [run #39949945854](https://github.com/Nimadanesh/shakar/actions/runs/39949945854) succeeded but did not capture an explicit-replacement control. No production ranking/semantics change, `main` merge, deployment, or frozen-grade/key edit.


## BRH-2026-10-23-B — owner grades recorded (2026-10-23)

- Owner grades recorded separately at [BRH-2026-10-23-B-HUMAN-GRADES.md](evaluations/BRH-2026-10-23-B-HUMAN-GRADES.md): B01=1, B02=2, B03=3, B04=2. The blinded packet and internal key remain unchanged.
- This is four judgments on two unique source listings, not four independent ads or a population estimate. Human preference is for the direct sale-title/exchange listing over the mixed buy/sell catalogue under both queries.
- Reconciliation note: [BRH-2026-10-23-B-RECONCILIATION.md](evaluations/BRH-2026-10-23-B-RECONCILIATION.md). Existing pipeline tests already assert the desired pairwise order. The frozen live observation was captured at code SHA `a65b7d3cfe055cf0c868080de033bbb9a3a6bf9f`, 142 commits before owner-confirmed head `d3d424d78d5fe95710a3c9cdff538661eba93be6`; both `pipeline.ts` and `pipeline.test.ts` changed after that capture. Do not call this a current test/live discrepancy.
- Next gate: run focused tests on current head, then reproduce the two-listing paired fixture with current code and score breakdowns. No test run was executed in this documentation step. No engine behavior, `main`, or deployment changed.


## Mixed refrigerator-role title cue — merged validation outcome (2026-10-23)

- PR [#25](https://github.com/Nimadanesh/shakar/pull/25) is merged into `engine_v3` at merge commit `f32561fe4cbc1733b8b89feaf023d07a1317ea39`. The shared title-only detector covers `فروش و خریدار` and `فروش وخریدار`; no new penalty, hard rejection, retrieval change, or human-grade edit was introduced.
- Baseline [run 39968450657](https://github.com/Nimadanesh/shakar/actions/runs/39968450657) on that merge SHA: focused hunt/search tests PASS, full portable suite PASS, TypeScript typecheck PASS, production build PASS. Workflow conclusion is FAILURE solely at ESLint: 8 existing UI errors and 37 warnings. This is not a fully green baseline, but the portable test/build gates passed.
- Bounded live role observation [run 39968450800](https://github.com/Nimadanesh/shakar/actions/runs/39968450800) succeeded on the same SHA with 8 pages/query, 4 detail calls total, and `MIZAN_SHADOW=0`. The target paired source IDs were absent from both 8-page result sets (`packetTargetCandidatesFound: []`); the report's inspected live candidates therefore do not validate the new detector against the historical target. The report is unjudged and not a quality comparison.
- Replacement-history follow-up [run 39968450511](https://github.com/Nimadanesh/shakar/actions/runs/39968450511) also succeeded as a bounded observation, but did not capture an explicit component-replacement claim. It is not a valid replacement-history control.
- **Acceptance status:** merged and automated regression-tested; live target-specific confirmation remains unavailable. Do not interpret a successful workflow execution as proof of ranking quality.
- Next: move to the registered mixed-transaction cue matrix / issue 16 as a characterization-and-evidence task. Preserve the two unique refrigerator ads and frozen grades, add no general penalty or hard filter, and only broaden the cue after a source-grounded paired case demonstrates the intended scope. Keep the rare explicit piano-component-replacement evidence gap open without repeating the same bounded query path.


## Latest verified state — PR #39 merged (2026-10-23)

- Current `engine_v3` head verified by both workflows: `2054d6b9f18fcdf52b996a94852ff81c7da0bf84` (merge of PR #39).
- Baseline [run 40004257638](https://github.com/Nimadanesh/shakar/actions/runs/40004257638):
  - Focused hunt/search suite: **15 test files passed, 5 skipped; 301 passed, 8 skipped**.
  - Full portable suite: **74 test files passed, 6 skipped; 894 passed, 9 skipped**.
  - TypeScript typecheck: PASS; production build: PASS.
  - ESLint: FAIL only at the known 8 unrelated `react-hooks/set-state-in-effect` UI errors and 37 warnings. Therefore the workflow is not fully green.
  - Three external-data research harnesses remain NOT RUN because frozen input files are absent from the hosted runner.
- PR #39 fix is verified by the source replay: B11 is now role `product`, reason `retail-installment:اقساط+پیش پرداخت+ارسال`; actual buyer is rank 1 and B11 is rank 2 with `near` and `demotedBy: cap`. B12 replay and E02 pass as part of the focused/full suites.
- Live observation [run 40004257788](https://github.com/Nimadanesh/shakar/actions/runs/40004257788) succeeded on the same SHA; artifact `engine-v3-live-observation-130`, with 4 query scenarios, max 8 pages/query, max 8 detail reads total, Mizan disabled. It is unjudged E3 evidence, not E4/E5 quality evidence.
- Residual live role risk: in the role-regression artifact, `فروشگاه /خریدار یخچال ساید دوقلو هتلی خراب سوخته` (source ID `gaLNJNwu`) is still `unknown` and appears exact at rank 1 for `فروشنده یخچال`, despite its description explicitly soliciting broken refrigerators to buy. Treat this as a bounded, unjudged candidate for characterization—not enough alone to justify a broad `خریدار` substring rule.
- `engine_v3` remains isolated from `main`; no deployment. Frozen human grades, keys, and historical captures remain unchanged.

## Latest verified state — PR #40 merged; baseline and live follow-up (2026-10-23)

- Source/test commit exercised by both supplied workflows: `3b58b3285ff00ca79859d6dfda85552d93c895e` on `engine_v3`; PR [#40](https://github.com/Nimadanesh/shakar/pull/40) is reported merged by the owner. `main` remains untouched.
- Baseline [run 40005149903](https://github.com/Nimadanesh/shakar/actions/runs/40005149903): focused hunt/search tests PASS; full portable suite PASS; TypeScript typecheck PASS; production build PASS. ESLint FAILS at the known unrelated UI `react-hooks/set-state-in-effect` errors. Therefore the workflow is not fully green. External-data harnesses are not represented as passing.
- Bounded live observation [run 40005149996](https://github.com/Nimadanesh/shakar/actions/runs/40005149996) succeeded and uploaded `engine-v3-live-observation-131`; artifact includes the standard four-query observation and the two-query role-regression observation. Budgets were respected (8 pages/query maximum; 8 details in the standard report, 4 in role regression; `MIZAN_SHADOW=0`). These are unjudged E3 observations, not human relevance grades or paired quality evidence.
- Residual candidate `gaLNJNwu`, `فروشگاه /خریدار یخچال ساید دوقلو هتلی خراب سوخته`, is now marked by `mixedTransactionTitleCue=true`; in `فروشنده یخچال` it is `near`, score 0.5, demoted by the existing cap, while the clean seller `gabPa811` is rank 1 exact in the ordinary `یخچال` observation. In the ordinary query the hybrid is rank 2/near and capped, not exact. This confirms the narrow cue is firing on the observed source; it does not establish population-level quality uplift.
- The cue remains intentionally narrow (`فروشگاه خریدار` after normalization); no broad bare-`خریدار` rule, hard rejection, frozen-grade edit, allocation change, deployment, or `main` merge.
- Next: keep the existing behavior under observation and move to the next evidence-backed mixed-transaction cue-matrix case only if it has a source-grounded paired control. Avoid stacking more title patterns from this single unjudged ad.


## Supplemental mixed-role grades locked — 2026-10-23

- Owner submitted grades for the blind packet from bounded capture run [40006314727](https://github.com/Nimadanesh/shakar/actions/runs/40006314727): X01=1, X02=1, X03=1, X04=1. Locked record: [BRH-2026-10-23-GAP-CAPTURE-131-HUMAN-GRADES.md](evaluations/BRH-2026-10-23-GAP-CAPTURE-131-HUMAN-GRADES.md); blind packet and mapping remain separate.
- All four are grade 1 (weak/tangential or wrong transaction direction), 4/4; this is E4 human-judged evidence on a non-random supplemental sample, not an E5 paired comparison or population estimate.
- X01 is a slash/truncated shop-buyer-like ad with no exchange offer; X02 and X04 are seller offers under `خریدار یخچال`; X03 is a direct retailer under `یخچال معاوضه`. These outcomes support treating the captured results as poor for their exact query contexts, but do not justify expanding a title cue, global buyer rule, hard rejection, or ranking change.
- The bounded capture did not find a clean barter listing. Reuse the existing human-graded sale/exchange control for that matrix cell; do not repeat the same query path without a new retrieval hypothesis.
- Next: inspect the existing source-matched role-control fixture/matrix and choose a next task only if it can falsify a specific hypothesis with both positive and negative controls. PR #28 remains draft/unmerged; `main`, deployment, and production behavior remain unchanged.


## Superseding verification — 2026-10-26

This section supersedes older "Next action" notes above where they conflict with later dated evidence.

- Audited the complete recursive repository trees: `main` at `10f3c40d70748ff27d6928eaed0875e10dab1c56` has 529 entries and no `.github/workflows/` or Engine V3 evaluation docs; `engine_v3` at `01daf0f695de261da75f1db2c26be57ab80a2bf3` has 651 entries, 15 workflow files, and 74 evaluation documents. The Issue 16 experiment head inspected separately is `8385fa00d629c04e712b818226cdda902ec05124` (671 entries). These are branch-specific trees; do not conflate their artifacts or handoff state.
- Issue 16 prospective paired-evaluation is **STOP/CLOSED** by `evaluations/ISSUE16-PAIRED-EVAL-CLOSURE-2026-10-25.md`. No further sampling design or live capture is authorized in that block. PR #43 remains Draft/unmerged; `main` and deployment remain untouched. The missing Capture 03 original-message detail and the R05 rationale gap remain unverified; do not reconstruct them from the grade alone.
- Completed a source/code/test audit of `floorMatFlatbedConflict` and recorded it in `evaluations/E3-FLOORMAT-GUARD-OFFLINE-AUDIT-2026-10-26.md` (commit `9b16c3393893a2b04445929f92777503de1156b0`). The current pipeline regression proves one trailer rejection and explicit `کفی تریلی` preservation, but does not exercise the full cue list against exact source snapshots.
- Human grade-2 records `gaI0HKIy` and `ga4uraIe` are known from the evaluation document, but their complete frozen descriptions were not found in the checked repository tree/documents. Whether any current cue fires on them is therefore **OPEN / UNVERIFIED**. No cue changes were made; no synthetic paraphrases substituted.
- Next action: only if the exact snapshots are recovered from their original artifact, replay them through the real guard/pipeline and record the matched cue. Otherwise leave the guard unchanged and move to a separate evidence-backed failure family. Do not claim the cue list is safe merely because no false rejection was demonstrated.
- No tests were executed in this documentation-only audit. No source behavior, human grade, frozen artifact, production allocation, `main`, or deployment was changed.


## Branch-first change policy — effective 2026-10-26

- All future code **and documentation** changes must be committed to an experiment branch first.
- Do not write directly to `engine_v3`. Move an approved change from the experiment branch to `engine_v3` only after explicit user approval.
- `main`, merges, and deployments remain outside scope unless explicitly authorized.
- The three documentation commits already made directly on `engine_v3` before this rule was clarified are intentionally preserved as historical state; do not rewrite, revert, or amend them as part of adopting this rule.
- Current continuation branch: `experiment/e3-floormat-guard-audit-20261026`, created from `36e9043eaa84d1e145b5bf4655f909eae380052a`. This branch inherits the prior three commits but all new work after this point stays here pending approval.
## Continuation decision — 2026-10-26 (experiment branch only)

This section supersedes older next-action text where it conflicts with the dated closure/audit notes in HANDOFF.md.

- Issue 16 prospective paired evaluation remains STOP/CLOSED. Do not dispatch, rerun, or continue capture for that block. The closure decision is present in HANDOFF.md even though the referenced standalone closure document was not found in this experiment branch's recursive tree during the current audit.
- Floor-mat/flatbed guard: keep the current cue list unchanged. Two human grade-2 listings lack complete frozen source snapshots in the checked tree, so cue-level false-rejection risk remains OPEN / UNVERIFIED.
- Separate evidence-backed family reviewed: BRH exchange-side attribute ownership. Existing isolated helpers and tests cover source titles P06/P07 and counterfactuals, but the helpers are phrase-level diagnostics, not entity parsing; they are not integrated with ranking/eligibility. No current evidence justifies production integration or a broad exchange penalty.
- No code or test changes were made in this continuation review, and no tests were run. Historical CI outcomes are not current-head validation.
- Next: keep production behavior unchanged and perform only a bounded offline design/test audit of the isolated exchange evidence helper against existing frozen P06/P07 cases. Do not create new captures or grades. Continue to require explicit user approval before moving any experiment-branch changes to engine_v3.
- Current experiment branch: experiment/e3-floormat-guard-audit-20261026. All new code/documentation remains on this branch pending approval; main, engine_v3, merges, and deployment are untouched by this continuation.
## Exchange phrase-specificity patch — validation pending (2026-10-26)

- On the experiment branch only, `assessExchangeTargetEvidence` now selects the longest exact phrase among matches and uses a deterministic code-point tie-break for equal lengths. This removes candidate-array-order dependence from the reported phrase; it does not resolve synonyms or establish semantic entity/attribute ownership.
- Added regression tests for overlapping item and attribute phrase candidates. The tests have not been executed in this session; mark the patch UNVERIFIED until focused and portable hunt tests run on the exact head.
- Details: `evaluations/E3-EXCHANGE-PHRASE-SPECIFICITY-AUDIT-2026-10-26.md`. Baseline workflow auto-trigger is restricted to `engine_v3`; no CI result is claimed for the experiment branch.
- Keep ranking and eligibility unchanged. No new live capture, no new grades, no Issue 16 restart. Floor-mat cue risk remains OPEN / UNVERIFIED. Explicit user approval is required before any transfer to `engine_v3`.


## Experiment validation update — exchange phrase specificity (2026-10-26)

- On `experiment/e3-floormat-guard-audit-20261026`, workflow [40301340872](https://github.com/Nimadanesh/shakar/actions/runs/40301340872) passed dependency install, focused exchange tests, portable hunt/search tests, and TypeScript typecheck.
- Whole-project ESLint failed on 8 unrelated UI/hook `react-hooks/set-state-in-effect` errors and 42 warnings. A follow-up run will use targeted ESLint on `exchangeTargetEvidence.ts` and its regression test; until then, targeted lint remains pending.
- The phrase-specificity patch remains a bounded helper diagnostic only. No ranking/eligibility integration, new capture/grades, Issue 16 restart, merge, deployment, or transfer to `engine_v3` is authorized. Floor-mat guard false-rejection risk remains OPEN / UNVERIFIED.


## Final experiment validation — exchange phrase specificity (2026-10-26)

- Follow-up workflow [40301702642](https://github.com/Nimadanesh/shakar/actions/runs/40301702642) passed all configured steps: locked install, focused exchange tests, portable hunt/search tests, TypeScript typecheck, and targeted ESLint.
- The earlier whole-project lint run still fails on 8 unrelated `react-hooks/set-state-in-effect` errors and 42 warnings. Do not label repository-wide lint as clean.
- Phrase-specificity remains an isolated helper diagnostic with no ranking/eligibility integration. No captures, new human grades, Issue 16 restart, merge, deployment, or transfer to `engine_v3` are authorized. Floor-mat guard false-rejection risk remains OPEN / UNVERIFIED.


## Candidate-order countercheck — 2026-10-26

- The phrase-specificity regression tests now exercise both short-first and long-first candidate orders for overlapping target-item and attribute phrases.
- Workflow [40302613310](https://github.com/Nimadanesh/shakar/actions/runs/40302613310) passed on test commit `f1b315c027b24eee0dc52daa860bfb6577086754`: dependency install, focused tests, portable hunt/search tests, TypeScript typecheck, and targeted ESLint.
- This is a deterministic phrase-selection check only; it does not establish better live retrieval or ranking. Whole-project ESLint remains separately red on 8 unrelated hook-rule errors / 42 warnings.
- All changes remain on the experiment branch. No capture, new human grades, Issue 16 restart, merge, deployment, or transfer to `engine_v3` without explicit approval. `main` remains untouched; floor-mat guard remains OPEN / UNVERIFIED.


## Floor-mat guard title-only probe — 2026-10-26

- Exact recorded titles for `gaI0HKIy` and `ga4uraIe` (grade 2), plus `gaYfZnPP` (INSUFFICIENT), were tested with an intentionally empty description. None triggers the guard from title alone. This only isolates title contribution; the original frozen descriptions remain unavailable.
- Workflow [40303749947](https://github.com/Nimadanesh/shakar/actions/runs/40303749947) passed locked install, focused tests, portable hunt/search tests, TypeScript typecheck, and targeted ESLint.
- The full-listing false-rejection risk remains OPEN / UNVERIFIED. No cue-list changes, synthetic replacement snapshots, new capture/grades, Issue 16 restart, merge, deployment, or transfer to `engine_v3`. `main` remains untouched.


## Frozen floor-mat artifact excerpt replay — 2026-10-26

- Recovered the original `engine-v3-detail-allocation-multi-4` artifact from workflow [39740034802](https://github.com/Nimadanesh/shakar/actions/runs/39740034802). It stores exact `title` + `descriptionExcerpt` for `gaI0HKIy`, `ga4uraIe`, and `gaYfZnPP`; these are not complete listing descriptions.
- Added an excerpt-based guard regression at `4b6f74b4884c405ee7b550dc3f21670c9f661799`. Workflow [40305241230](https://github.com/Nimadanesh/shakar/actions/runs/40305241230) completed successfully: focused tests, portable hunt/search tests, typecheck, and targeted ESLint all PASS.
- On available frozen excerpts, none of the two grade-2 witnesses or the INSUFFICIENT witness triggers the floor-mat flatbed guard. This narrows the evidence gap but does not prove full-listing safety. Risk remains OPEN / UNVERIFIED.
- No guard cue change, capture/grade creation, Issue 16 restart, merge, deployment, or transfer to `engine_v3`. `main` remains untouched.


## Current experiment note — floor-mat guard (2026-10-26)

The experiment branch `experiment/e3-floormat-guard-audit-20261026` now has source-artifact excerpt controls for two grade-2 witnesses, one INSUFFICIENT/ambiguous witness, two positive floor-mat controls, and two wrong-kind negatives. The first expanded test commit `5195194a566d0ed7738cc519476125d945e752ea` passed [workflow 40305511188](https://github.com/Nimadanesh/shakar/actions/runs/40305511188). A follow-up edit makes the test literals preserve the artifact excerpts verbatim; the follow-up commit `fecf0910318e37e8da59bdcbdd097e9882af26e3` passed [workflow 40306804900](https://github.com/Nimadanesh/shakar/actions/runs/40306804900), including locked install, focused tests, portable hunt/search tests, TypeScript, and targeted ESLint.

This is evidence/test work only: no guard cue list or runtime behavior changed. Artifact data are excerpts, not complete original descriptions. False-rejection safety remains **OPEN / UNVERIFIED**. `main` and `engine_v3` are unchanged; no merge/deploy or Issue 16 restart.


## Cue-level floor-mat audit continuation — 2026-10-26

The archived `engine-v3-detail-allocation-multi-4` artifact was re-inspected. Its 60 unique `کفی ماشین` source records include examples containing several current flatbed cues beyond the two already asserted as hard-negative controls. The audit report now lists which cues have direct replay coverage and which remain unvalidated. Source presence is not proof of a correct rejection; engine `matchKind`/score are not human grades. Next step is a read-only replay of existing frozen excerpts to record actual first-matched cues, without changing the cue list or creating new grades/captures. The guard remains **OPEN / UNVERIFIED** for false-rejection safety.


### Archived floor-mat replay inventory — 2026-10-26

The offline replay inventory in [the E3 floor-mat audit report](./evaluations/E3-FLOORMAT-GUARD-OFFLINE-AUDIT-2026-10-26.md) now records first cue matches from the archived `کفی ماشین` query artifact using a local reproduction of normalization and matching semantics. Record accounting found 79 nested occurrences and 59 distinct source IDs in that query, not the 60 previously reported; this discrepancy is explicitly open for reconciliation. Among 57 excerpts that match `کفی`, 30 returned a current cue and 27 returned none. These are observations, not new human grades or proof of semantic precision, and this offline replay is not yet a TypeScript execution over all records.

No runtime or cue-list change. Keep the full-listing false-rejection risk **OPEN / UNVERIFIED** because the artifact has excerpts rather than full Divar descriptions. No capture, live retrieval, human grading, merge, deployment, or transfer to `engine_v3`; `main` and `engine_v3` remain unchanged.
