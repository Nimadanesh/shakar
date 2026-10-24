# Engine V3 — Prioritized Failure Register

Updated: 2026-10-22
Scope: current-source/live-observation findings. Live samples are bounded and ungraded; they are not population estimates.

## Operating rule

Every entry starts as a hypothesis. Promote it to a confirmed failure only with a reproducible current-code/live-output trace. Keep the same query intent and use counterexamples to control over-filtering. Frozen R1 captures, pinned candidates, grades, mappings, and denominators remain read-only.

## Ranked findings

| Priority | Failure family | Current evidence | Action/status |
|---|---|---|---|
| P0 | Styled sibling variant treated as exact | Live `پیانو اکوستیک` observation initially ranked `پیانو دیجیتال یاماها طرح آکوستیک` as `exact`. A subsequent live observation on the patched code kept the same title as `near`, with real acoustic pianos still `exact`. | **Patch + regression tests added.** The style-prefix guard is title-scoped, respects explicit `طرح X` queries, and does not demote a clean title merely because the description compares it with a styled variant. |
| P0 | Whole-car hunt admits car parts as near-misses | Live `ماشین بدون رنگ` observation showed `جک ماشین` and `چهار عدد کمک ماشین پراید` in the top results as `near`, even though the user sought a whole car. | **Patch + pipeline regression test added.** `جک` and vehicle `کمک` are now part markers. Test asserts part listings are rejected and a real car that mentions a jack stays exact. Latest bounded live observation after the patch did not show those two part listings in the top 8. |
| P1 | `کفی ماشین` wrong product kind (floor mats vs trailer flatbeds) | Human-graded source-matched E3 allocation disagreement sample: for the explicitly intended automotive-floor-mat hunt, each arm had 1/8 exact and 7/8 irrelevant trailer/flatbed-family candidates. Positive controls E17/E19 were exact. This is a small diagnostic sample; it does not establish population prevalence or an allocation effect. | **Confirmed intent-specific failure family; narrow guard added on `engine_v3`, CI pending.** `buildContract` preserves the phrase as ordinary subject terms and `queryKindForDef` has no closed kind for it, so partial lexical matches can remain `near`. A query-scoped `floorMatFlatbedConflict` guard now rejects listings with explicit flatbed cues only for the `کفی ماشین` floor-mat query; explicit `کفی تریلی`/`کفی تریلر` queries are outside the guard. Focused and pipeline-level tests are added. Await CI, then perform a bounded read-only replay and blinded review for false rejections. This is not approved for main/deployment. See [E3-QUERY-INTENT-KAFI-01](./evaluations/E3-QUERY-INTENT-KAFI-01.md). |
| P1 | Service intent / wrong listing role | Two bounded live samples for `تعمیر یخچال` placed explicit service offers at the top; no clear non-service exact was observed. Historical R2 notes had weak S3 scores, but the old 10-record diagnosis found no defect in its retained pool. | No service heuristic added. Keep monitoring with a larger, human-judged sample; do not infer general correctness from eight details. |
| P1 | Hard constraints / UNKNOWN evidence | In `ماشین بدون رنگ`, an explicitly `بی‌رنگ` car was `exact`; descriptions without paint evidence stayed `near`. A separate sample had explicit repaint evidence and the result was demoted. | Current bounded evidence is consistent with the contract. Add no change absent a reproducible violation. |
| P1 | Retrieval/detail-budget starvation | Detail-allocation experiment E3-DETAIL-ALLOCATION-01 fetched 482 candidates across 20 pages for `ماشین بدون رنگ`. `titleStrength` was 0 from rank 80 through at least rank 200. On the same pool, top-100 yielded 1 exact/39 near/60 not-returned; top-80 + 20 evenly spaced ranks 101–200 yielded 3 exact/41 near/56 not-returned. Two additional engine-exact cars at ranks 128 and 138 explicitly described themselves as `بی‌رنگ`. | **Promising, not accepted yet.** Human-grade a small blinded packet. Do not change production allocation based on engine verdicts alone. If grades confirm the gain, prototype a deterministic exploration budget behind an experiment flag and measure critical false positives/latency. |
| P2 | Global synonym overreach | Existing architecture warns that related products must not become aliases. No new synonym groups were added. | Keep frozen. Test context-specific positive and negative pairs before any future expansion. |
| P2 | Mizan runtime/decision role | Live observation explicitly set `MIZAN_SHADOW=0`; deterministic results were captured without model calls. Current architecture keeps Mizan log-only/shadow. | No model authority changes. Evaluate only via ablation after deterministic baseline is stable. |

## E3-DETAIL-ALLOCATION-01 — completed

[Run #1](https://github.com/Nimadanesh/shakar/actions/runs/39683008360)

- Query: `ماشین بدون رنگ`
- Retrieval: 20 pages, 482 ads/candidates, 0 duplicates collapsed, 120 details checked, no stale details.
- TitleStrength: rank 1 = 2; ranks 80, 100, 101, 120, 150, and 200 = 0. The current order has a large zero-score tie, so source order—not meaningful title evidence—chooses most candidates for detail verification.
- Arm A (top 100): 1 exact, 39 near, 60 not returned in scored output.
- Arm B (top 80 + 20 evenly spaced from ranks 101–200): 3 exact, 41 near, 56 not returned.
- Two additional exact candidates in B: `دنا پلاس ۶ دنده Ef7p مشکی متالیک آبنوس 1404` (rank 128; description says `بی رنگ`) and `تیبا 2مدل96` (rank 138; description says `ماشین بی رنگ`).
- Both arms use a 100-candidate allocation; the experiment fetched the 120-candidate union only to evaluate both counterfactuals on the same pool.
- These are deterministic engine verdicts, not human relevance grades. The alternative is **not** accepted for production until blinded human grading confirms the added candidates and checks the rest of the top results.

## Evidence and links

- [Latest portable baseline](https://github.com/Nimadanesh/shakar/actions/runs/39682413600): focused tests, full portable suite, typecheck, build PASS; ESLint FAIL due to eight existing UI errors.
- [Latest bounded live observation](https://github.com/Nimadanesh/shakar/actions/runs/39682408569): four query families; max 2 list pages and 8 details per query; read-only; Mizan disabled.
- [Prior live observation before the styled-variant fix](https://github.com/Nimadanesh/shakar/actions/runs/39678990763).
- [First live observation showing the style guard working](https://github.com/Nimadanesh/shakar/actions/runs/39679635361).

## Next step

**Blind human evaluation of E3-DETAIL-ALLOCATION-01.**

1. Present a shuffled packet of unique top-result candidates from both arms without labels identifying the allocation or internal verdict.
2. Ask the human evaluator to grade relevance/constraint correctness only; do not ask for technical solutions.
3. If the two additional lower-title candidates are judged relevant and no critical errors increase, implement an opt-in deterministic exploration allocation (80 top-title + 20 tail) behind a V3 experiment flag.
4. Re-run deterministic tests and compare on a fresh, separately identified live sample; keep request budget and candidate pool fixed within each paired comparison.
5. Do not change production allocation unless human grades support a gain without critical false-positive regression. No main merge/deploy or broad rollout without explicit authorization.

Frozen evaluation artifacts are not inputs to overwrite or rerun for this experiment.


## E3 — `کفی ماشین`: narrow intent guard follow-up (2026-10-22)

- Branch: `engine_v3`; latest guard commit observed in the bounded live run: `97bf6101c779f903f613cca0c1a5ae22f89ffa82`.
- Human graded all three retained live candidates exact (3): `gaYfODFa` (`کفی ماشین کوییک نو`), `gaZjj5GY` (`کفی ماشین`, complete set; driver-side stain recorded as condition only), and `gaZftRr4` (`کفی قالبی یه تیکه پرایدی`). Condition defects must be annotated separately and must not reduce relevance grade.
- [Bounded live run](https://github.com/Nimadanesh/shakar/actions/runs/39756287700): 49 ads seen, 48 after duplicate collapse, 8 details checked, 3 confirmed, 2 near misses, 5 rejected; no stale data. This is an unpaired, small observation, not a measured quality uplift.
- Remaining risk: human grading of exact source-ID-matched rejected trailer/flatbed candidates and a fresh live counter-intent check for `کفی تریلی`. Previously graded positive controls `gaYjJe4y` and `gaXjCsU5` and hard negative `gaA3NPYd` remain frozen controls; do not relabel them.
- CI: [baseline run](https://github.com/Nimadanesh/shakar/actions/runs/39756287701) passed focused tests, portable suite, typecheck, and build, but ESLint failed on eight `react-hooks/set-state-in-effect` errors in unrelated UI files. Keep this separate from search-quality acceptance.
- Next action: prepare the blinded candidate packet and inspect the explicit-trailer counter-intent before deciding whether to keep/refine the closed cue list. No merge or deployment.


### Counter-intent check added — 2026-10-22

- [Fresh bounded observation run 39758555126](https://github.com/Nimadanesh/shakar/actions/runs/39758555126) included explicit query `کفی تریلی`: 49 ads seen, 48 after duplicate collapse, 8 details checked, 7 confirmed, 0 near misses, 1 rejected; no stale data. Confirmed examples include `تریلی کفی و لبه و‌تیغه`, `تریلی کفی سه محور`, and `تریلی کفی`. This supports the intended counter-control: the `کفی ماشین` guard is not a global ban on trailer flatbeds.
- The same run surfaced a new ungraded positive lead for floor mats: `Aafm5Bsf`, `پک کامل روکش صندلی ، کفی ، دورفرمان`. Human-grade it before using it as a quality metric.
- This remains a bounded 8-detail sample, not a population recall guarantee or paired quality comparison. Next: human-grade the new positive and a blinded source-matched sample of rejected flatbed candidates.


### Human review update — `Aafm5Bsf` (2026-10-22)

- Provisional human grade: **2**, not exact (submitted as a draft), for `پک کامل روکش صندلی ، کفی ، دورفرمان` on the explicit automotive-floor-mat intent. The mat is real but is one of three package components; this is consistent with E34 (relevant but not central) and contrasts with E17 (floor covering co-listed as a titled item, grade 3).
- Evaluation refinement: distinguish *product presence* from *listing focus/salience*. A keyword hit or real inclusion alone is not sufficient for grade 3.
- Condition defects remain independent: `gaZjj5GY` keeps grade 3 despite a stain; condition must not lower relevance.
- Next: use a source-ID-matched review packet to inspect the cue list against exact positive and trailer/flatbed examples. Do not assume every old hard negative was rejected by the current guard, and do not claim quality uplift from the bounded live sample.


## Buyer-seeking role boundary — 2026-10-23

- **Current implementation:** `70a077e` keeps buyer-seeking listings eligible for ordinary product hunts so the existing ranker handles them; the hard-rejection path is limited to targeted product hunts with explicit negative repair/replacement-history constraints. Earlier broad rejection was not accepted because it broke two existing transaction-direction tests.
- **Automated evidence:** current-head baseline run [39911832644](https://github.com/Nimadanesh/shakar/actions/runs/39911832644) passes focused tests, full portable suite, typecheck, and build. ESLint remains red on 8 existing UI errors.
- **Live evidence:** current-head run [39911832666](https://github.com/Nimadanesh/shakar/actions/runs/39911832666) timed out on a Divar request; it produced no report. Current-head live behavior is therefore not verified.
- **Gate:** preserve seller-seeking ads in `فروشنده یخچال`; preserve ordinary search ranking/transaction-direction controls; reject explicit service offers and buyer-seeking ads for `پیانو تعمیر یا تعویض نشده است`; keep unknown repair history at most near. Review both false positives and false rejections before accepting the change as complete.
- No human-quality uplift claim, main merge, deployment, or mutation of frozen evaluation artifacts.


### Live observation follow-up — buyer/service boundary (2026-10-23)

- Retry [39911832666, attempt 2](https://github.com/Nimadanesh/shakar/actions/runs/39911832666) completed successfully and uploaded `engine-v3-live-observation-84`; see [the evidence note](evaluations/E3-LIVE-OBSERVATION-BUYER-BOUNDARY-2026-10-23.md).
- The target negative-history query rejected one explicit repair-service offer with the intended reason and rejected one buyer-seeking ad as `no-match`. The separate exact-phrase sample retained two product listings as `near`; explicit exchange controls produced two exact results.
- Residual risk: sample size is small (8 detail reads); no live seller-seeking refrigerator control or paired ordinary-search baseline was included. Therefore the targeted behavior has positive live evidence, but the overall role-boundary gate remains partially open. Do not treat this as precision/recall or human-quality uplift.


## E3 negative-history / seller-role controls — 2026-10-23

- [Bounded live run 39913211370](https://github.com/Nimadanesh/shakar/actions/runs/39913211370), SHA `48703004ea38412538781e53f66800ccaa811d20`, completed successfully. Read-only, max two list pages per query, max two details per scenario, four total for the new role-control test, Mizan disabled. Full combined artifact: `engine-v3-live-observation-85`.
- For `فروشنده یخچال`, two checked results were retained (one mixed seller/buyer title, one explicit seller listing). Ordinary `یخچال` retained the same two. This does not establish role precision/recall; the mixed-role result and mismatch between `roleMode: seek-seller` and `queryRole: product` remain unresolved. No global buyer rejection is justified by this evidence.
- For `پیانو تعمیر یا تعویض نشده است`, the selected service offer and buyer-seeking ad were both rejected; two unknown-history piano listings remained `near` in the separate exact-phrase scenario. Explicit exchange control returned two exact results. These are examples, not population estimates.
- [Baseline run 39913211263](https://github.com/Nimadanesh/shakar/actions/runs/39913211263): focused tests, full portable suite, TypeScript typecheck, build PASS; ESLint FAIL (8 errors, 37 warnings) on existing UI `react-hooks/set-state-in-effect` violations. Keep lint debt separate from search behavior.
- Next: collect blinded grades for `BRH-2026-10-23-A`, then review source IDs and only consider a narrowly scoped fix if human grades reveal a reproducible failure. No main merge/deploy.


## Update — exchange direction / target-side paint ownership (2026-10-23)

A wider bounded read-only replay now completed 8/8 pages for `معاوضه سمند رنگ دارد`: [run #116](https://github.com/Nimadanesh/shakar/actions/runs/39943428579), source SHA `a61658c`. It saw 186 ads, 32 Samand+exchange title candidates, and zero title candidates with all three cues. The two details inspected were `ga4iPfzH` (paint/hood evidence refers to the offered motorcycle; Samand is the requested counterparty) and `galu34HS` (no Samand paint evidence). Neither is a clean contradiction example.

**Status remains unresolved / no new production fix.** The observation reinforces that attribute cue detection is insufficient without entity/transaction-side ownership. The selector's 2-detail scenario budget and 8-detail global budget were respected. Do not treat engine labels as human grades, and do not continue unbounded page widening. Next useful evidence should be a small blinded human review of transaction direction and attribute ownership. Baseline [#145](https://github.com/Nimadanesh/shakar/actions/runs/39943428525) passed focused tests, full suite, typecheck and build; ESLint alone failed on known unrelated UI debt (8 errors, 37 warnings).

## Update — PR #25 mixed-title detector, merged validation (2026-10-23)

- Merge SHA: `f32561fe4cbc1733b8b89feaf023d07a1317ea39`; PR [#25](https://github.com/Nimadanesh/shakar/pull/25).
- Baseline [39968450657](https://github.com/Nimadanesh/shakar/actions/runs/39968450657): focused tests, full portable suite, TypeScript and build passed; ESLint failed on 8 existing UI errors and 37 warnings.
- Live role observation [39968450800](https://github.com/Nimadanesh/shakar/actions/runs/39968450800) was successful as a workflow, but `packetTargetCandidatesFound` was empty for both 8-page searches. No claim of target-specific live validation or quality gain is warranted.
- Replacement-history observation [39968450511](https://github.com/Nimadanesh/shakar/actions/runs/39968450511) did not capture explicit component replacement; evidence gap remains open.
- Next: mixed-transaction cue matrix / issue 16, characterization first. Preserve current eligibility and avoid expanding the ranker cue from unjudged live examples.


## Update — PR #39 retail-installment role fix verified; residual buyer/seller role false positive (2026-10-23)

- PR [#39](https://github.com/Nimadanesh/shakar/pull/39) merged at source SHA `2054d6b9f18fcdf52b996a94852ff81c7da0bf84`. The root cause was a normalization mismatch: listing text folds `ط → ت`, but the installment/context cue dictionaries were not normalized before matching.
- Baseline [40004257638](https://github.com/Nimadanesh/shakar/actions/runs/40004257638): focused suite PASS (301 passed, 8 skipped); full portable suite PASS (894 passed, 9 skipped); typecheck and production build PASS. ESLint remains the known 8 unrelated UI errors / 37 warnings. Three external-data harnesses remain NOT RUN due unavailable frozen inputs.
- E1 source replay now classifies B11 as `product`; under `خریدار پیانو`, the grade-3 actual buyer is rank 1 and grade-0 B11 is rank 2, `near`, capped. B12 and E02 controls pass. This verifies the specific regression correction, not overall quality uplift.
- Live observation [40004257788](https://github.com/Nimadanesh/shakar/actions/runs/40004257788), artifact `engine-v3-live-observation-130`, completed under the existing 8-page / 8-detail budget with Mizan disabled. All outputs are unjudged.
- **New candidate for characterization, not yet a confirmed general failure:** `gaLNJNwu`, title `فروشگاه /خریدار یخچال ساید دوقلو هتلی خراب سوخته`, was `unknown` and rank-1 `exact` for `فروشنده یخچال`; its description solicits broken refrigerators for purchase. The ordinary `یخچال` scenario also showed it as rank 2 `exact`. The title is a buyer/shop hybrid, but the existing conservative rule intentionally avoids treating every mid-text `خریدار` as buyer-seeking because seller copy can mention a buyer. Next: add a narrowly scoped paired characterization fixture using this source text plus a clean seller control and an ordinary-search control; test role and rank behavior before proposing any cue expansion. Do not add a global bare-`خریدار` substring rule from this one unjudged sample.
- No human grade, frozen capture, or denominator changed. No `main` merge or deployment.


## Follow-up — shop/buyer hybrid title characterization PR #40 (2026-10-23)

- Draft PR [#40](https://github.com/Nimadanesh/shakar/pull/40) proposes a narrow extension to `isMixedTransactionTitle`: normalized `فروشگاه خریدار`. It uses the existing mixed-listing ranking penalty only; no hard rejection and no broad bare-`خریدار` role cue.
- Regression pairs the observed hybrid title `فروشگاه /خریدار یخچال ساید دوقلو هتلی خراب سوخته` against a clean direct seller and asserts that the hybrid remains eligible but ranks below the seller. Shop-only and direct-seller titles are negative controls.
- Counter-risk: the existing mixed-title penalty is not restricted to seller-seeking hunts, so this pattern can lower the hybrid in ordinary product searches too. Current evidence is one bounded, unjudged live source; this is why the PR remains draft pending focused/full CI and consideration of the cross-mode counter-risk.
- Do not merge until the new regression, full portable suite, typecheck and build pass and the scope is reviewed. ESLint's 8 known unrelated UI errors remain separate. No human grades or frozen data changed.

## Update — PR #40 merged; hybrid cue confirmed in bounded live observation (2026-10-23)

- Owner reports PR [#40](https://github.com/Nimadanesh/shakar/pull/40) merged. Both supplied workflows exercised source/test commit `3b58b3285ff00ca79859d6dfda85552d93c895e`.
- Baseline [40005149903](https://github.com/Nimadanesh/shakar/actions/runs/40005149903): focused tests, full portable suite, typecheck, and production build all PASS; ESLint remains FAIL on known unrelated UI hook-rule errors. Do not describe the entire baseline as green.
- Live [40005149996](https://github.com/Nimadanesh/shakar/actions/runs/40005149996), artifact `engine-v3-live-observation-131`, completed within bounded limits with Mizan disabled. The role-regression artifact shows `gaLNJNwu` (`فروشگاه /خریدار یخچال ساید دوقلو هتلی خراب سوخته`) now has `mixedTransactionTitleCue=true`; for `فروشنده یخچال`, it is `near` (score 0.5), capped, while the inspected direct seller remains rank 1. In ordinary `یخچال`, the direct product seller is rank 1 exact and the hybrid is rank 2 near/capped.
- Interpretation: the PR's narrow title detector is active on the observed source, and the direct seller is ahead in both sampled scenarios. The observation is unjudged and not a paired human-quality comparison; it does not justify a broad buyer cue or another generalized penalty.
- Status: close the specific characterization gate as implemented + automated-regression-tested + bounded-live-observed. Keep the general mixed-role false-positive family open only for new source-grounded counterexamples. No grade or frozen artifact changed; no `main` merge or deployment.

## Update — PR #40 merged and observed (2026-10-23)

- PR [#40](https://github.com/Nimadanesh/shakar/pull/40) is reported merged by the owner. Baseline [40005149903](https://github.com/Nimadanesh/shakar/actions/runs/40005149903) passed focused tests, full portable suite, typecheck, and build; ESLint remains red on known unrelated UI hook-rule errors. Do not describe the whole workflow as green.
- Live [40005149996](https://github.com/Nimadanesh/shakar/actions/runs/40005149996), artifact `engine-v3-live-observation-131`, confirms the narrow `فروشگاه خریدار` title cue fires for `gaLNJNwu`. The candidate is near/capped under seller-seeking and ordinary refrigerator queries, while the direct seller ranks ahead in both sampled outputs.
- This closes the specific PR #40 characterization gate only. Evidence is bounded and ungraded; it does not prove population uplift or validate broad generalization. Keep issue #16 open for source-matched blinded cross-category evidence. No broad buyer substring rule or hard rejection.

## Update — supplemental mixed-role gap capture (2026-10-23)

- Bounded capture rerun [40006314727](https://github.com/Nimadanesh/shakar/actions/runs/40006314727) succeeded; artifact ID `12523753208`, six details across three refrigerator scenarios, two pages/scenario, Mizan disabled.
- Compact `خریدوفروش` and spaced `خرید و فروش` controls were retrieved, but the targeted `یخچال معاوضه` selection still contained no clean barter title. The explicit `خریدار یخچال` query selected seller/product offers rather than a buyer-seeking listing. This is only a bounded retrieval/candidate-selection observation.
- New ungraded candidate `Aax4Mkwa` title `فروشگا/خریدار/دوقلو یخچال ساید خراب سوخته کل مناطق` is a slash/truncated shop-buyer-like title variant. It is not proof the existing exact `فروشگاه خریدار` cue should be expanded. A supplemental blind packet plus separate mapping are in `evaluations/BRH-2026-10-23-GAP-CAPTURE-131-BLIND.md` and `...-MAPPING.md`.
- Use the existing human-graded sale/exchange refrigerator control for the barter cell; do not invent or relabel a current candidate. No ranking change is justified by this capture. PR #28 remains draft/unmerged; `main` and deployment unchanged.


## Update — supplemental mixed-role blind grades (2026-10-23)

- The owner has locked grades X01=1, X02=1, X03=1, X04=1 for the four-item packet sourced from bounded capture [40006314727](https://github.com/Nimadanesh/shakar/actions/runs/40006314727). Full record and post-grade mapping: [BRH-2026-10-23-GAP-CAPTURE-131-HUMAN-GRADES.md](evaluations/BRH-2026-10-23-GAP-CAPTURE-131-HUMAN-GRADES.md).
- All four surfaced ads are weak for their query: a buyer/dismantler-style refrigerator ad without exchange for `یخچال معاوضه`; two direct seller offers for `خریدار یخچال`; and a direct retailer for `یخچال معاوضه`. Sample is non-random, denominator 4, all grade 1.
- This confirms a local result-quality problem in the selected sample, but does not isolate one shared classifier defect: the cases differ by transaction role and query mismatch. X01's slash/truncated wording is not enough evidence to expand the existing normalized `فروشگاه خریدار` cue. Do not add a global buyer cue or hard rejection from this packet.
- The clean barter target was not retrieved within the bounded two-detail selection. Retain the existing human-graded sale/exchange control; avoid rerunning the same bounded path without a changed retrieval hypothesis. PR #28 remains draft/unmerged; no rank behavior, `main`, or deployment change.


## Issue 16 — Retargeted Capture 03 grade-to-engine reconciliation (2026-10-24)

- Durable human grades: [I16-RETARGETED-CAPTURE-03-HUMAN-GRADES.md](evaluations/I16-RETARGETED-CAPTURE-03-HUMAN-GRADES.md). The diagnostic/internal key remains separate.
- Locked packet total: 32/36 across 12 scored items; ten grade 3 and two grade 1.
- Eligibility false rejection: I16-R05 is a human grade 3 (buyer-seeking used refrigerator) but was rejected by the engine as `appliance-not-home-goods`. This is the strongest false-rejection witness in this packet. A shared family with other refrigerator/home-goods failures is only a hypothesis until independently reproduced with controlled examples.
- Wrong item type retained: I16-R03 and I16-R12 are catalyst listings, both human grade 1, yet retained as eligible for a whole-car hunt. They are two independent witnesses to the same candidate error type, not separate failure families.
- Separate under-scoring signal: I16-R01, I16-R06, and I16-R08 are human grade 3 while the engine labeled them `near`. Do not conflate this with the I16-R05 eligibility rejection or catalyst item-type error.
- Gate: build a new frozen, blinded packet from unseen IDs only, with preregistered positive and negative controls for each of the two primary hypotheses. Keep hypotheses separate. No ranker change, hard rejection, or generalized rule until each pattern repeats across independent listings and controls remain healthy. Do not reuse IDs from prior packets or open the key before grades are locked.


## Issue 16 — Capture 05F human-grade reconciliation (2026-10-24)

- Seven freshness-reconciled rows were graded and recorded in [I16-CAPTURE-05F-FRESH-SUBSET-GRADED.md](evaluations/I16-CAPTURE-05F-FRESH-SUBSET-GRADED.md); source/engine join is separate in [I16-CAPTURE-05F-FRESH-SUBSET-INTERNAL-KEY.md](evaluations/I16-CAPTURE-05F-FRESH-SUBSET-INTERNAL-KEY.md).
- Grades: H05F-B01=1, B02=3, B03=1, B04=1, B05=1, B06=1, B07=3. Total 11/7, mean 1.57/3.
- Wrong-kind eligible near-misses repeated across catalyst sale/buying, catalyst service, and body-parts inventory (B01/B03/B04/B05). B04 is especially important: engine score 2.8333 and `near`, while the human judged the body-parts inventory weak for a whole-vehicle hunt.
- Whole-vehicle positive controls B02 (damaged-vehicle buyer/exchange) and B07 (FMC511 dealer sale/exchange) were human grade 3 but engine `near`. Preserve transaction-role vs item-kind separation; do not reject buyers globally.
- B06 (tire-only exchange) was rejected by the typed-kind gate and human grade 1, a healthy negative control. One other selected row (`gapYR7Ug`) was excluded from the blind subset because it overlapped Capture 04B.
- This adds an independent E4 sample consistent with the earlier Capture 03/04/05E wrong-kind observations, but the targeted, small sample is not a population estimate and is not a paired comparison. It does not alone authorize an engine change. Continue evidence-only work; no engine/ranking change, merge, deployment, or `main` change.
