# Internal Key — BRH Issue 16 Cross-Category Blind Packet

**Do not copy this key into the blind packet or reveal it before the human grades are locked.** The packet is diagnostic, non-random, and not a population estimate.

| Blind ID | Source ad ID | Exact query | Capture source | Source scenario | Engine diagnostic (not human grade) |
|---|---|---|---|---|---|
| I01 | `gab_aV8W` | `خریدار خودرو` | run 40008523406 | vehicle-buyer | eligible, exact, score 3.5, sample rank 1, roleMode seek-buyer |
| I02 | `gaLNJNwu` | `فروشنده یخچال` | run 40004257788 | seek-seller-refrigerator | exact, score 3.5, rank 1 |
| I03 | `ga4iPfzH` | `معاوضه سمند رنگ دارد` | run 39945846455 | explicit-exchange-vehicle-samand | near, score 2.5, rank 1 |
| I04 | `gaPHaEfq` | `خریدوفروش خودرو` | run 40008523406 | vehicle-buy-sell | eligible, near, score -3.5, sample rank 2, roleMode none |
| I05 | `gaRj-fI_` | `فروشنده یخچال` | run 40004257788 | seek-seller-refrigerator | rejected, part:offering:"درب" |
| I06 | `gaqV1O58` | `فروشنده یخچال` | run 40008523406 | refrigerator-reference | eligible, near, score 0.5, sample rank 1, roleMode seek-seller |
| I07 | `galu34HS` | `معاوضه سمند رنگ دارد` | run 39945846455 | explicit-exchange-vehicle-samand | near, score 1.5, rank 2 |
| I08 | `gavSad4q` | `خریدار خودرو` | run 40008523406 | vehicle-buyer | ineligible, rejected, score n/a, sample rank n/a, roleMode seek-buyer |
| I09 | `Qa4_oh_e` | `فروشنده یخچال` | run 40008523406 | refrigerator-reference | ineligible, rejected, score n/a, sample rank n/a, roleMode seek-seller |
| I10 | `gabPa811` | `یخچال` | run 40004257788 | ordinary-refrigerator-search | exact, score 3.5, rank 1 |
| I11 | `gaIL7h0B` | `خریدوفروش خودرو` | run 40008523406 | vehicle-buy-sell | eligible, near, score 0.5, sample rank 1, roleMode none |

## Source and integrity notes

- I01, I04, I06, I08, I09, and I11 come from bounded capture run [40008523406](https://github.com/Nimadanesh/shakar/actions/runs/40008523406).
- I07–I08 are unjudged exchange controls from run [39945846455](https://github.com/Nimadanesh/shakar/actions/runs/39945846455); their exact query is preserved as captured.
- I02, I05, and I10 include previously captured but unjudged refrigerator role controls from run [40004257788](https://github.com/Nimadanesh/shakar/actions/runs/40004257788). The duplicate appearance of `gaLNJNwu` under ordinary `یخچال` is intentionally not counted twice; this packet uses its `فروشنده یخچال` context only.
- Every source ad ID appears once in this packet: 11 blind IDs, 11 unique source IDs. Description text is copied from the captured observation logs; capture time is not publication time.
- No human grades have been assigned here. Keep the grades immutable once returned and use a separate reconciliation record after grading.
- A clean explicit buyer-seeking vehicle control and a spaced `خرید و فروش` title are still not represented. Their absence from this packet must not be interpreted as absence from Divar or as evidence for a broad rule.
