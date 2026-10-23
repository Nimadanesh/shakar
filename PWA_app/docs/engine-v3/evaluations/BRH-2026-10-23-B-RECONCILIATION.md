# BRH-2026-10-23-B — Human-vs-observation reconciliation

Date: 2026-10-23  
Branch: `engine_v3`  
Owner grades: [BRH-2026-10-23-B-HUMAN-GRADES.md](./BRH-2026-10-23-B-HUMAN-GRADES.md)  
Scope: reconcile the graded role-control packet with existing regression expectations. No engine behavior changed.

## Finding

The four owner grades are B01=1, B02=2, B03=3, B04=2. Under both queries, the human preference is for the direct `فروش یخچال` listing over the mixed `خریدوفروش` catalogue. This distinction is stronger for the seller-seeking query: B01=1 versus B02=2.

The current `pipeline.test.ts` at the inspected branch revision already contains paired assertions for that ordering:
- Under `فروشنده یخچال`, sale-title/exchange candidate before mixed catalogue.
- Under ordinary `یخچال`, direct product listing before mixed catalogue.

The historical live observation used to build the packet records the reverse order for both queries. Crucially, its mapped code SHA is `a65b7d3cfe055cf0c868080de033bbb9a3a6bf9f`; the compare from that SHA to the owner-confirmed branch head `d3d424d78d5fe95710a3c9cdff538661eba93be6` reports 142 commits ahead, and the diff includes changes to both `pipeline.ts` and `pipeline.test.ts`. Therefore the historical observation must **not** be described as a current test/live discrepancy.

## Interpretation

- The owner grades establish a real ordering target for this two-listing paired diagnostic, not a population-level metric.
- The older live order is useful historical evidence, but it does not establish current behavior after the later pipeline changes.
- The existence of assertions in source is not proof that the tests currently pass. No test run has been executed as part of this documentation-only step.
- Do not add another mixed-role penalty or hard filter based only on the stale observation; the current code already has tests for the intended order, and duplicating a penalty could over-correct.

## Next safe action

1. Obtain a fresh focused test run on the current `engine_v3` head, including the role-control cases in `pipeline.test.ts`.
2. If those tests pass, run a bounded current-code fixture with the two exact captured listings under both queries and compare actual order plus score breakdowns. This distinguishes a unit-fixture success from source/detail-specific behavior.
3. Only if current code reproduces the inverted order should a minimal isolated fix be proposed, preserving mixed listings as eligible and keeping ordinary product search intact.
4. Keep the explicit-replacement-history gap separate; its missing positive control remains a different evidence gate.

## Boundaries

- Human grades and the frozen blind packet/key are preserved.
- No changes to `main`, production semantics, ranking, or deployment.
- This is a reconciliation note, not a test run or a claim of quality uplift.


## Score-contract inspection — 2026-10-23

A source-only inspection of the current `pipeline.ts` clarifies what the next bounded diagnostic must capture:

- Final ordering is **lexicographic by verdict first, score second**: every `exact` result sorts ahead of every `near` result, regardless of numeric score. Score only orders results within the same `matchKind`.
- `ScoredAd.breakdown` exposes only `title`, `description`, and `priceKnown`. It is not a full accounting of the final score. `scoreAd` also applies SHOULD boost, missing-information penalty, provider/goods-service adjustments, dealer/offer penalties, and a mixed-buy/sell penalty; these adjustments are not individually surfaced in `breakdown`.
- Therefore the paired order assertion alone cannot tell whether the direct listing wins because its `matchKind` improved, because its score improved within the same verdict, or because the synthetic fixture does not reproduce the source-specific verdict split. Nor would the current three-field breakdown alone explain the full score.

### Diagnostic contract

For the two frozen source listings (`gaT3a_qu` mixed catalogue; `gabbQJUc` direct sale-title/exchange), under both `فروشنده یخچال` and `یخچال`, capture without modifying ranker behavior:

1. resolved `roleMode` and MUST/SHOULD counts;
2. each listing's source ID, exact title and frozen description text;
3. `matchKind`, final `score`, existing `breakdown`, `missingInfo`, `evidence`, and `demotedBy`;
4. the two final ranks and the score delta;
5. a clearly labeled explanation of which score adjustments are not currently exposed, rather than pretending the three-field breakdown is complete.

Keep the diagnostic bounded to these two listings × two queries, keep Mizan disabled, and do not fetch mutable live details as a replacement for the frozen packet. If the existing fixture does not preserve the frozen source text, report that mismatch explicitly instead of calling it an exact-source replay.

This is a source-contract finding (E0), not a fresh execution or live result. The last reported baseline remains run [39949945856](https://github.com/Nimadanesh/shakar/actions/runs/39949945856) on `50a32cb`; its 12 commits to current `engine_v3` are documentation-only, so the engine/test source is unchanged since that baseline. No ranking code, tests, frozen grades/keys, `main`, or deployment were changed by this inspection.


## Hosted score trace reviewed — run 39958454838 (2026-10-23)

- Baseline [run 39958454838](https://github.com/Nimadanesh/shakar/actions/runs/39958454838) checked out merged engine_v3 SHA `4c19500719aafaea9e1bfb5c109ae44a73e4e68e`. Focused hunt/search tests passed (290 passed, 7 skipped across 19 files); the full portable suite, TypeScript typecheck, and production build also passed. ESLint failed at its known unrelated UI hook-rule errors; the run is not fully green.
- The new `[BRH-FRIDGE-SCORE-TRACE]` lines executed in both paired tests. Synthetic fixture result under `فروشنده یخچال`: `gabbQJUc`-analogue/direct title ranks 1 with `near`, score 3; mixed catalogue ranks 2 with `near`, score 0. Under ordinary `یخچال`, the same order and scores appear. Both results in both queries have `demotedBy: "cap"`, title component 1, description 0, priceKnown 0, no missingInfo, and evidence `یخچال`.
- Source inspection confirms `scoreAd` applies an unexposed `mixedTransactionPenalty = 3` to `mixed-buyer-seller` listings. The observed synthetic 3-point gap is consistent with that penalty, but the logged breakdown is partial and cannot prove it is the only difference.
- Interpretation: this run proves the synthetic paired tests execute and their assertions pass; it does **not** replay the exact frozen source IDs and therefore does not close the source-matched evidence gate. The historical live observation's `exact`/ `near` split is especially important because verdict sorts before score. Do not add another penalty or hard filter from this trace alone.
- Follow-up: the test-only branch `diagnostic/brh-fridge-source-matched` replaces generic fixture IDs with frozen IDs `gaT3a_qu` and `gabbQJUc`, and pins the exact title/description excerpts in the blind packet under both queries. It remains a fixture replay of frozen packet text, not a live API detail replay. Run the focused tests on that branch and inspect whether either candidate's `matchKind` diverges. Production ranker, frozen grades, `main`, and deployment remain unchanged.


## Current bounded live follow-up — runs 39960396108 and 39962509412 (2026-10-23)

### Run #120 — before packet-target selection

- [Live Observation #120](https://github.com/Nimadanesh/shakar/actions/runs/39960396108) completed successfully on merge SHA `71f3f739ebf27ff4fcbe3f641d119259fb05b66a`.
- The two role-control queries each saw 50 ads across two list pages and checked two details. Neither frozen target ID (`gaT3a_qu`, `gabbQJUc`) was selected; the diagnostic used generic role-cue candidates.
- In the seller-seeking query, `roleMode=seek-seller` coexisted with `queryRole=product`. This is a query-intent diagnostic inconsistency, not by itself proof of a final ranking defect.
- The live sample did not contain the frozen human-graded pair and therefore could not validate their relative order.

### Run #121 — after PR #20 was merged

- [Live Observation #121](https://github.com/Nimadanesh/shakar/actions/runs/39962509412) completed successfully on merge SHA `5e41b1119c5f7974cf56c292798934abfb141a13`. The test-only diagnostic now prioritizes the frozen IDs if present in the retrieved candidate pool, reports whether they were found, and records title transaction-cue classes. Production ranking/scoring and the two-detail-per-query budget were not changed.
- In both `فروشنده یخچال` and `یخچال`, retrieval saw 50 ads and reported `packetTargetCandidatesFound=[]`. The frozen IDs were absent from the retrieved candidate pool; therefore packet-target prioritization could not select them. This does **not** mean they were judged irrelevant or that the ranker rejected them.
- For `فروشنده یخچال`, the two details selected were `gaf4cqwp` (“خریدار یخچال ساید دوقلو همه مدل تمام نقاط شهر”) and `QaYsoEJD` (“یخچال و فریزر خراب(فروش ندارم)فقط میخرم”). Both were classified as buyer-seeking, and the buyer-only ad ranked first with `exact` / score 3.5. The same two details appeared in the ordinary `یخچال` probe. This is current E3 evidence that the bounded candidate sample can be dominated by buyer-seeking listings, including under the seller-seeking query; it is not an E4 human relevance judgment and does not compare the frozen pair.
- The new cue audit classified “فروش و خریدار” and “خریدوفروش” as distinct diagnostic categories in the offline test, but neither frozen target was available to exercise those categories against the current live source text.
- Limits: two list pages per query; 50 ads observed per query; two detail checks per query; Mizan disabled; no Supabase write. Absence from this bounded pool is not evidence of absence from Divar as a whole.

### Interpretation and next gate

The evidence now points to a retrieval/candidate-coverage question before it can answer the frozen pair's ranking question. Do not add another mixed-role penalty or a hard filter from these observations. Next, use a **separate bounded diagnostic experiment** to determine whether deeper pagination or a targeted current query can retrieve the frozen IDs (or current comparable direct-sale and mixed-role listings) within an explicit request budget. Keep this separate from the immutable frozen grades and report whether target IDs are found, rather than treating not-found as a ranking outcome. Only after a comparable pair is actually present in the same candidate pool should we evaluate rank order; only a newly human-graded current sample can establish relevance quality.


## Deeper live candidate scan — run 39963999459 (2026-10-23)

- [Live Observation #122](https://github.com/Nimadanesh/shakar/actions/runs/39963999459) completed successfully on merge SHA `484a3d431588af49f890c2696f079a49fe0c47f3`, after the bounded role-regression probe was extended to eight cursor-chained list pages.
- Both `فروشنده یخچال` and `یخچال` completed all 8 requested pages and observed 194 ads/candidates each. The frozen target set remained empty in both reports: `packetTargetCandidatesFound=[]` for `gaT3a_qu` and `gabbQJUc`.
- The same two detail candidates were selected for both queries: `gaDn0jsk`, “فروش و نصب موتور یخچال استوک ونو، ۱سال ضمانت”, and `gabX2QE8`, “فروش یخچال”. Both were confirmed as `exact`, score 3.5. This is a tiny diagnostic detail sample, not a representative relevance sample and not evidence that the frozen pair is ranked correctly or incorrectly.
- Query intent remains `roleMode=seek-seller` with `queryRole=product` for `فروشنده یخچال`. The ordinary `یخچال` query has `roleMode=none`, `queryRole=product`. The same observed candidate count and selected details across both queries warrant a focused check of query construction/retrieval semantics, but do not alone prove the backend issued identical requests.
- The broader run's independent scenarios also stayed bounded: 8 total detail checks across 4 scenarios; the refrigerator role probe used 4 detail checks total across its 2 queries. Mizan shadow remained disabled, and observations were read-only.

### Updated decision

The deeper scan did not locate the frozen pair even within 194 observed candidates per query. Record this as **not found in this bounded retrieval pool**, not as globally absent from Divar and not as a ranking failure. Before touching production scoring, the next diagnostic should inspect the exact normalized/provider query and pagination/request metadata for `فروشنده یخچال` versus `یخچال`, then test whether a carefully bounded alternate query can retrieve current comparable sale-title and mixed-role listings. Keep the detail budget capped and do not substitute mutable current listings for the immutable human grades. No production ranking change is justified by this run alone.
