# Project State — Engine V3

Last verified: 2026-10-23
Work branch: `engine_v3`
Branch base: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Current source/test head: 48703004ea38412538781e53f66800ccaa811d20
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
