# Internal Key — Issue 16 Retargeted Capture 03 (2026-10-24)

**Internal diagnostic only. Keep separate from the blind packet until owner grades are locked.**
Sources: cross-category run [40068287594](https://github.com/Nimadanesh/shakar/actions/runs/40068287594), artifact `12550077918`; Follow-up 03 run [40068287579](https://github.com/Nimadanesh/shakar/actions/runs/40068287579), artifact `12549687957`. Both artifacts report PR merge-ref commit `82f6718369e931a91df80c5470e773837be305a2`, matching PR #41 head `aa2faf2a0f1f55c37af387ed7f79b31f40e7459e` at dispatch time.

## Blind label mapping and engine diagnostics

| Blind ID | Query / capture cell | Source ad ID | Title | Eligible | Match kind | Score | Rejected kind |
|---|---|---|---|---:|---|---:|---|
| I16-R01 | خودرو نقدی / cash | `gaEWi1OQ` | نیسان ex ۱۴۰۵تک سوز و دوگانه نقدی (تحویل فوری) | true | near | 3 | — |
| I16-R02 | فروش یخچال / seller | `gacj0uNF` | یخچال امرسان فروش | true | exact | 3.5 | — |
| I16-R03 | خرید و فروش خودرو / adjacent-item | `gaBPPjUm` | خریدار کاتالیزور کاتالیز به قیمت استثنای درایلام | true | near | -2.5 | — |
| I16-R04 | حواله خودرو / voucher | `gaqu1hx_` | دفتر حواله خودرو (مشاوره رایگان)207 | true | exact | 3.5 | — |
| I16-R05 | خرید و فروش یخچال / mixed role | `gaU2U0Mv` | فروش یخچال دست دوم و خرید یخچال دست دوم | false | rejected | — | kind:domain:appliance-not-home-goods |
| I16-R06 | خریدار خودرو تصادفی / adjacent-service | `gaHbT4ov` | پژو۲۰۷ مدل۱۴۰۰ ،قیمت گذاری خودرو های تصادفی و چپی | true | near | 0.5 | — |
| I16-R07 | یخچال / ordinary appliance | `gaPj2RbK` | یخچال هتلی ال جی | true | near | 3.5 | — |
| I16-R08 | خرید و فروش خودرو / whole vehicle | `gaTbR5Rb` | اتوگالری صابری نمایشگاه خرید و فروش خودرو ایرانی | true | near | 0.5 | — |
| I16-R09 | خریدار یخچال خراب / buyer | `Qa0L6SxA` | سمساری خرید خریدار یخچال سالم خراب سوخته بدون گاز | true | exact | 4.5 | — |
| I16-R10 | خریدار خودرو تصادفی / buyer | `gaZX_Yj3` | ۲۰۶تصادفی معاوظه وخریدار تصادفی | true | exact | 3 | — |
| I16-R11 | معاوضه با سمند / exchange | `gacjUsaz` | پراید معاوضه با سمند | true | near | 3.5 | — |
| I16-R12 | خریدوفروش خودرو / adjacent-item | `QaRyXg2a` | خریدوفروش انواع کاتالیزور... | true | near | -1.5 | — |

## Capture validity and limits

- Follow-up 03: 7 unique listing IDs / 8-detail cap; 3 cells missing within the bounded pool: whole vehicle, installment, and wrong-kind control. Cash was captured. No missing cell was substituted with a different type.
- Cross-category: 6 details / 6 unique IDs / 4 scenarios, within the fixed cap.
- The two independent workflows ran in parallel and selected the same ID `gacj0uNF` for the refrigerator seller reference. The blind packet deduplicates it, leaving 12 unique listings total.
- The Follow-up artifact's `overlapWithPriorPackets` contained 60 previously inspected IDs, but none of its selected IDs were in that overlap list. The cross-category artifact's `overlapWithInspected` contained 24 IDs, none of which were selected. This is consistent with the current filter-before-selection source being applied on the synthetic PR merge ref; it resolves the prior stale/mismatched snapshot concern for these runs.
- `productionRank` is null for every listing. These are E3 live diagnostics, not evidence of uplift or population-level error rates. The buyer/seller and cross-category examples require human grades before interpretation.
- Do not let this key bias the reviewer. Lock owner grades in a separate grades file before reconciliation. No ranking, eligibility, or production behavior change is authorized; PR #41 remains Draft/unmerged and `main` / `engine_v3` remain untouched.
