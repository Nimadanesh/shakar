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
