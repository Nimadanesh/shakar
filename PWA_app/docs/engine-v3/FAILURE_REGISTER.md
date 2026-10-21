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
| P1 | Service intent / wrong listing role | Two bounded live samples for `تعمیر یخچال` placed explicit service offers at the top; no clear non-service exact was observed. Historical R2 notes had weak S3 scores, but the old 10-record diagnosis found no defect in its retained pool. | No service heuristic added. Keep monitoring with a larger, human-judged sample; do not infer general correctness from eight details. |
| P1 | Hard constraints / UNKNOWN evidence | In `ماشین بدون رنگ`, an explicitly `بی‌رنگ` car was `exact`; descriptions without paint evidence stayed `near`. A separate sample had explicit repaint evidence and the result was demoted. | Current bounded evidence is consistent with the contract. Add no change absent a reproducible violation. |
| P1 | Retrieval/detail-budget starvation | Live observation deliberately used only 2 list pages and 8 detail fetches per query. Production default is 20 pages and up to 100 details. Current human grades do not cover candidates below the retained detail shortlist. | **Open.** Next technical experiment: use one fixed query/candidate pool to compare production title-only top-100 allocation with a controlled alternative allocation; keep the same detail budget and record which candidates receive detail verification. |
| P2 | Global synonym overreach | Existing architecture warns that related products must not become aliases. No new synonym groups were added. | Keep frozen. Test context-specific positive and negative pairs before any future expansion. |
| P2 | Mizan runtime/decision role | Live observation explicitly set `MIZAN_SHADOW=0`; deterministic results were captured without model calls. Current architecture keeps Mizan log-only/shadow. | No model authority changes. Evaluate only via ablation after deterministic baseline is stable. |

## Evidence and links

- [Latest portable baseline](https://github.com/Nimadanesh/shakar/actions/runs/39682413600): focused tests, full portable suite, typecheck, build PASS; ESLint FAIL due to eight existing UI errors.
- [Latest bounded live observation](https://github.com/Nimadanesh/shakar/actions/runs/39682408569): four query families; max 2 list pages and 8 details per query; read-only; Mizan disabled.
- [Prior live observation before the styled-variant fix](https://github.com/Nimadanesh/shakar/actions/runs/39678990763).
- [First live observation showing the style guard working](https://github.com/Nimadanesh/shakar/actions/runs/39679635361).

## Next experiment

**E3-DETAIL-ALLOCATION-01 — candidate coverage under the production detail cap.**

1. Use one critical query and one fixed, read-only candidate pool.
2. Record titleStrength, fetch order, dedupe result, and which candidates fall inside/outside the production top-100 detail cap.
3. Where safe and available, retrieve details for the same fixed pool to estimate how many below-cap candidates would be relevant; do not use model-generated relevance labels.
4. Compare the existing top-100 title-strength allocation with one alternative that reserves a small exploration budget for weaker-title candidates. Keep total detail requests equal and use the same candidate pool.
5. Do not change production allocation unless a measured recall gain exists without a critical false-positive regression. Any real quality claim requires fresh human grades.

Frozen evaluation artifacts are not inputs to overwrite or rerun for this experiment.
