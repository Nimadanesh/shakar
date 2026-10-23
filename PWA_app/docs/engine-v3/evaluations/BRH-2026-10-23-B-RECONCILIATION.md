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


## Source-matched frozen-packet replay reviewed — run 39960396282 (2026-10-23)

- Baseline run [39960396282](https://github.com/Nimadanesh/shakar/actions/runs/39960396282) checked out merged `engine_v3` SHA `71f3f739ebf27ff4fcbe3f641d119259fb05b66a`, which merges PR #18.
- The frozen-packet paired replay executed in both `pipeline.test.ts` runs. For `فروشنده یخچال` (`roleMode=seek-seller`) and ordinary `یخچال` (`roleMode=none`), `gabbQJUc` (title `فروش یخچال`) ranked first with `matchKind=near`, score 3; `gaT3a_qu` (mixed catalogue title) ranked second with `matchKind=near`, score 0. Both were marked `demotedBy=cap`; the exposed breakdown was title=1, description=0, priceKnown=0, with no missingInfo and evidence `یخچال`.
- The frozen title/description excerpt fixture therefore matches the owner-graded ordering target for both queries. Both verdicts are `near`, so the historical `exact`/`near` split is not reproduced by this fixture. This does **not** establish the current live Divar verdicts: the fixture intentionally uses frozen packet text and is not a live detail replay.
- Portable hunt/search suite: 290 passed, 7 skipped across 19 files; full portable suite, TypeScript typecheck, and production build passed. ESLint failed on 8 existing UI hook-rule errors across unrelated UI components (45 problems total, including warnings); the workflow conclusion is failure, not fully green.
- No ranking behavior, human grades, or frozen packet were changed. No additional mixed penalty or hard filter is justified by this result. The current evidence supports keeping the paired regression test and moving to a bounded, read-only live observation of the two listing IDs if Divar still returns them.
- Next evidence gate: run the existing `Engine V3 Live Observation` workflow via `workflow_dispatch` on `engine_v3` (or allow its existing push trigger after a relevant engine/test change), then inspect its uploaded role-regression artifact and exact `matchKind`/order. Its current detail budget is capped at eight and Mizan is disabled. The available GitHub connector can read workflow logs but cannot dispatch this workflow; do not change engine code or push a no-op solely to trigger it. If the live observation does not contain these IDs or cannot retrieve their details, record that as unavailable evidence rather than treating the frozen fixture as live confirmation.
