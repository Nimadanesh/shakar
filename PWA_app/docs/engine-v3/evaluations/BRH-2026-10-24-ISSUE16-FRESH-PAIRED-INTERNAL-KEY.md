# Internal Key — Issue 16 Fresh Paired Capture (2026-10-24)

**Internal diagnostic only.** Keep separate from the blind packet until owner grades are locked.
Source: run 40062192939; artifact 12547517801; capture commit `ac168f25fc5d9a667ee34dd79f2a3d7c91065383`; blind packet frozen first in commit `e4f83a3de9896e52ba21d953b7d21f4b00d711d1`.

## Blind label mapping and engine diagnostics

| Blind ID | Query / cell | Source ad ID | Title | Eligible | Match kind | Score | Rejected kind |
|---|---|---|---|---:|---|---:|---|
| P03-01 | فروش یخچال / seller | `gab_ekWg` | فروش یخچال خانگی | true | exact | 3.5 | — |
| P03-02 | خرید و فروش یخچال / mixed | `Qa9fP53U` | خرید (فروش) همه نوع یخچال سالم و غیر سالم | true | exact | 3.5 | — |
| P03-03 | یخچال / ordinary-appliance | `gaKTlAwq` | یخچال فریزر دوقلو زیرووات | true | exact | 3.5 | — |
| P03-04 | قطعه یخچال / wrong-kind-control | `gaaPW6zt` | موتور و قطعات یخچال | true | near | 1.5 | — |
| P03-05 | خریدوفروش خودرو / whole-vehicle | `gabvBEiY` | خریدوفروش خودرو صفر کیلومتر دنا، تارا، سورن، ۲۰۷ | true | near | 0 | — |
| P03-06 | حواله خودرو / voucher | `ga726UUL` | حواله ایثارگر ایران خودرو سایپا بهمن ارگانی شاهین | true | exact | 3.5 | — |

## Capture limits and missing cells

- 10 targeted scenarios, maximum 2 list pages per query, maximum 8 details and 8 unique IDs total; 6 detail reads / 6 unique IDs used.
- Mizan shadow was off (`MIZAN_SHADOW=0`). `productionRank` is null for all captured listings.
- Missing: refrigerator buyer, vehicle cash, vehicle installment, vehicle exchange. These remain missing and were not replaced with unrelated listings.
- The query-kind fix's direct seller and ordinary-appliance controls are eligible/exact. The part-only control remains eligible/near rather than rejected; this may be expected for a query explicitly asking for a refrigerator part, so it is not by itself a negative relevance failure.
- The whole-vehicle result is eligible/near with score 0; human grade should determine relevance. The voucher result is a direct voucher listing and must be judged against the query `حواله خودرو`, not automatically treated as noise.
- All six selected source IDs are new relative to the inspected capture artifacts. The harness did encounter previously observed IDs and excluded them; the field `overlapWithPriorPackets` also records excluded IDs, including prior diagnostic observations, so interpret that field as exclusion evidence rather than selected-item overlap.

Do not use these engine diagnostics to bias the human reviewer. Lock owner grades in a separate grades file before using this key for reconciliation.
