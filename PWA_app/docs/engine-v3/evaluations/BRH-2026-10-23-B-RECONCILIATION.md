# BRH-2026-10-23-B — Human-vs-live ordering reconciliation

Date: 2026-10-23  
Branch: `engine_v3`  
Owner grades: [BRH-2026-10-23-B-HUMAN-GRADES.md](./BRH-2026-10-23-B-HUMAN-GRADES.md)  
Scope: reconcile the graded role-control packet with existing regression expectations. No engine behavior changed.

## Finding

The four owner grades are B01=1, B02=2, B03=3, B04=2. This creates the same human preference under both query conditions: the direct `فروش یخچال` listing outranks the mixed `خریدوفروش` catalogue. The preference is stronger under the seller-seeking query, where the mixed listing is only grade 1.

The existing `pipeline.test.ts` already contains paired tests asserting exactly that ordering:
- Under `فروشنده یخچال`, barter/sale-title candidate before mixed catalogue.
- Under ordinary `یخچال`, direct product listing before mixed catalogue.

However, the frozen live observation used to build the packet records the mixed catalogue at rank 1 and the sale-title/exchange listing at rank 2 for both queries. The source mapping also says the resolved role mode changes from `seek-seller` to `none`, while the observed order does not change.

## What this does and does not prove

- It is a genuine **test/live discrepancy to reconcile**, not immediate proof that current code fails its tests.
- The internal key records observed code SHA `a65b7d3cfe055cf0c868080de033bbb9a3a6bf9f`, with an explicit warning to verify the artifact metadata before treating it as the artifact's own code SHA.
- The live observation may reflect a different source revision, listing detail text, price/score tie-break, or candidate execution path than the synthetic unit test. The current evidence does not isolate which.
- Do not change scoring to force the observed order until the exact workflow artifact and source SHA are reconciled. Doing so risks duplicating an existing mixed-role penalty or introducing a query-wide hard filter.

## Next safe action

1. Verify the exact source SHA embedded in the original Actions artifact for run `39915083572` (and the role-control artifact run if distinct).
2. Run the focused existing pipeline tests against current `engine_v3` head `d3d424d7` and record the actual result; do not infer pass/fail from test source alone.
3. If current tests pass, rerun a **bounded, deterministic local fixture** using the exact two captured titles/descriptions and resolved definitions from the artifact, emitting component score breakdowns for both queries. Keep it test-only.
4. Only if the same source inputs still invert the owner preference should a minimal isolated fix be proposed, with a paired control that ensures mixed catalogues remain eligible and ordinary product search remains intact.

## Boundaries

- Human grades and blind packet/key are preserved.
- No changes to `main`, production semantics, ranking, or deployment.
- This is a source reconciliation report, not a test run or a claim of quality uplift.
