# BRH-2026-10-23-B — Owner grades

Date: 2026-10-23  
Branch: `engine_v3`  
Source packet: [BRH-2026-10-23-B-BLIND.md](./BRH-2026-10-23-B-BLIND.md)  
Scope: four owner-supplied judgments on two source listings, each judged under two queries. The blind packet and internal mapping remain unchanged.

## Human grades

| ID | Query | Grade | Human judgment |
|---|---|---:|---|
| B01 | `فروشنده یخچال` | 1 | Mixed buy/sell catalogue; only tangentially useful for finding sellers. |
| B02 | `فروشنده یخچال` | 2 | Explicit refrigerator sale title, but description offers exchange, so seller role remains ambiguous. |
| B03 | `یخچال` | 3 | Relevant refrigerator listing; exchange wording does not defeat ordinary product relevance. |
| B04 | `یخچال` | 2 | Mixed buy/sell catalogue; relevant to the product but transaction focus is ambiguous. |

Distribution: grade 3 = 1; grade 2 = 2; grade 1 = 1; grade 0 = 0; insufficient = 0. There are four judgments but only two unique source listings. Do not treat these as four independent ads or as a representative estimate of overall quality.

## Source-matched engine observation

The frozen packet maps:
- B01 and B04 to `خریدوفروش انواع یخچال سالم موتورسوخته پوسیده` (source `gaT3a_qu`), observed as rank 1 / `exact` in both queries.
- B02 and B03 to `فروش یخچال` (source `gabbQJUc`), observed as rank 2 / `near` in both queries.

The same two source listings appeared in the same order for `فروشنده یخچال` and ordinary `یخچال`, although the resolved query role mode differed. Engine labels `exact` and `near` are its own evidence-completeness labels, not human relevance grades.

## Interpretation

1. **Role-intent separation is not demonstrated in the observed ordering.** For `فروشنده یخچال`, the mixed buy/sell catalogue (B01=1) ranked above the explicit sale-title/exchange listing (B02=2). For ordinary `یخچال`, the mixed catalogue (B04=2) ranked above the ordinary-product-relevant exchange listing (B03=3). Both pairwise human orderings oppose the observed engine order.
2. The mixed listing's `exact` engine label is overconfident relative to B01=1 and B04=2. This is a calibration/role-evidence issue, not proof that all mixed listings should be rejected.
3. The two judgments for `فروشنده یخچال` support retaining the explicit seller-vs-mixed-role wound for follow-up. Do not turn this tiny paired sample into a broad hard filter or population metric.
4. Next safe step: add a **test-only characterization** around mixed buy/sell role evidence and seller-seeking intent, then inspect the scoring/role contract for a narrowly scoped, explainable rank penalty or confidence cap. Any behavior change needs additional source-matched controls for clear sellers, clear buyers, and mixed listings before activation.
5. Preserve all four owner grades and the frozen packet/key. No production semantics, ranking behavior, `main`, or deployment changed in this report.

## Validation

This is a documentation-only human-evaluation record. No tests were run by this documentation write. Existing baseline validation remains as reported in the source observation; do not claim this report validates a code change.
