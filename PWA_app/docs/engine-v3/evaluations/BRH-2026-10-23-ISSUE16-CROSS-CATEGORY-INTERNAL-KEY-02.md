# Internal Key — BRH Issue 16 Cross-Category Blind Packet 02

**Post-grade key:** all six owner grades were submitted and locked in the separate human-grades file before this mapping was opened. Keep this file separate from the blind packet. Engine diagnostics are not human grades.

| Blind ID | Source ad ID | Exact query | Capture source | Scenario | Engine diagnostic (not human grade) |
|---|---|---|---|---|---|
| I12 | `gaYvJrs6` | `خرید و فروش خودرو` | run 40011900064 | vehicle-buy-sell-spaced | eligible, near, score 0.8333, sample rank 2, roleMode none |
| I13 | `wZcsAVgg` | `فروشنده یخچال` | run 40011900064 | refrigerator-reference | eligible, exact, score -4.5, sample rank 1, roleMode seek-seller |
| I14 | `gab7Jmnv` | `خریدار خودرو تصادفی` | run 40011900064 | vehicle-buyer-damaged-vehicle-control | eligible, near, score -2.5, sample rank 2, roleMode seek-buyer |
| I15 | `gaIL7h0B` | `خریدوفروش خودرو` | run 40011900064 | vehicle-buy-sell-compact | eligible, near, score 0.5, sample rank 1, roleMode none |
| I16 | `gabLLuzd` | `خرید و فروش خودرو` | run 40011900064 | vehicle-buy-sell-spaced | eligible, near, score 0.8333, sample rank 1, roleMode none |
| I17 | `gaP28UXT` | `خریدار خودرو تصادفی` | run 40011900064 | vehicle-buyer-damaged-vehicle-control | eligible, exact, score 3, sample rank 1, roleMode seek-buyer |

## Post-grade reconciliation

| Blind ID | Human grade | Comparison | Readout |
|---|---:|---|---|
| I12 | 3 | Engine `near`, sample rank 2 | Direct vehicle sale with cash/installment terms and willingness to exchange is human-exact for the broad buy/sell query. Track the grade/match-kind disagreement; do not change policy from one example. |
| I13 | 1 | Engine `exact`, sample rank 1 | Transaction-direction false positive: body seeks to buy refrigerators from people who have one for sale, while query seeks a refrigerator seller. |
| I14 | 1 | Engine `near`, sample rank 2 | Weak seller distractor for a damaged-vehicle buyer query; missing damage evidence matches the human grade, but eligibility remains a precision concern. |
| I15 | 1 | Engine `near`, sample rank 1 | Voucher-office service/product rather than a vehicle listing. Repeats the earlier voucher-office pattern. |
| I16 | 3 | Engine `near`, sample rank 1 | Direct Pride sale is human-exact for the broad query; current engine match kind is lower than human relevance. |
| I17 | 3 | Engine `exact`, sample rank 1 | Positive control aligns: explicit cash buyer for damaged vehicles is exact for the buyer-seeking query. |

## Limits and decisions

- Bounded read-only capture: four scenarios, max two pages per query, six detail reads, six unique listing IDs, `MIZAN_SHADOW=0`; no production ranks were captured.
- Human grades: 0=0, 1=3, 2=0, 3=3; total 12/18, mean 2.00/3. This is a selected diagnostic sample, not a representative estimate.
- I13 is the clearest role-direction false positive in this packet. I14 is a weak distractor under a specific query; I15 is a voucher-office false positive. I12 and I16 show human-exact broad vehicle listings labeled only `near` by engine diagnostics.
- I17 is one positive control; it does not establish general recall. Compact and spaced queries are not a controlled paired comparison.
- No ranking/hard-rejection policy change, merge, or deployment is authorized by this packet alone. Keep the blind packet unchanged and design a controlled follow-up before proposing behavior changes.
