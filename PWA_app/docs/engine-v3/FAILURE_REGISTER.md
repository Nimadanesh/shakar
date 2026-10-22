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
