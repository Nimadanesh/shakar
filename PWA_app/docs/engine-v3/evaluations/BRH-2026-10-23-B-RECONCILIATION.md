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
