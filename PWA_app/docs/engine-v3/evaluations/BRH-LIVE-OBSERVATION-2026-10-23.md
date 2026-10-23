# BRH live observation log — 2026-10-23

Status: real read-only observations; **unjudged candidate leads only**. This is not a human evaluation, quality comparison, or authorization to change ranking logic.

## Source and reproducibility

- Workflow run: https://github.com/Nimadanesh/shakar/actions/runs/39920561481
- Artifact: `engine-v3-live-observation-96`
- Branch / commit: `engine_v3` / `51c379c3c1742566540d024345931aebdadc7091`
- Captured at: 2026-10-23 07:51–07:52 UTC
- Read-only observation; `mizanShadow=0`; no service or database writes reported.
- Observation JSON warns explicitly that records are unjudged. Candidate detail excerpts are not full immutable listing snapshots; refresh/capture full title and description before putting any candidate into a blinded grading packet.

## Refrigerator role-regression observations

| Query | Rank | Listing ID | Title | Observed excerpt / interpretation |
|---|---:|---|---|---|
| `فروشنده یخچال` | 1 | `ga_mGzEH` | خرید و فروش انواع یخچال فریزر | Excerpt says all types of fridges/freezers are bought and sold, tested, with warranty; ambiguous catalogue/dealer offer. Engine role `product`, matchKind `near`. |
| `فروشنده یخچال` | 2 | `gaQ200XW` | خرید و فروش یخچال ساید نو ودرحد | Description says `خریدار انواع یخچال ساید بای ساید` and offers cash pickup; buyer-side intent conflicts with seek-seller query despite title sale cue. Engine role `product`, matchKind `near`. |
| `یخچال` | 1 | `ga_mGzEH` | خرید و فروش انواع یخچال فریزر | Same catalogue listing; generic product query. Engine role `product`, matchKind `near`. |
| `یخچال` | 2 | `gaQ200XW` | خرید و فروش یخچال ساید نو ودرحد | Same buyer-side listing; generic query. Engine role `product`, matchKind `near`. |

The two queries returned the same two candidates at the top of the diagnostic detail sample. This is a small, role-cue-prioritized sample, **not** proof these were the global top results or that the ranking fix failed. The sample does expose a useful candidate for human review: whether a buyer-side ad should rank below actual fridge offers for `فروشنده یخچال`, while remaining eligible for generic `یخچال`.

## Cross-category candidate leads from the same artifact

| Query | Listing ID | Title | Observed signal | Follow-up use |
|---|---|---|---|---|
| `پیانو قطعات اورجینال تعویض نشده` | `gaZ37iPY` | پیانو اسباب بازی | Toy piano; missing `قطعات` and `اورجینال`; `near`. | Potential negative/weak example for query specificity; not a mixed-transaction case. |
| `پیانو قطعات اورجینال تعویض نشده` | `gaa7yUyl` | پیانو. (مشاوره خرید با اساتید مجرب | Consulting/shop listing; description promotes piano-buying advice. | Potential service/editorial false positive. |
| `پیانو تعمیر یا تعویض نشده است` | `gaTfSd0P` | تعمیر پیانو دیجیتال | Repair-service offer rejected as `service-offer-for-negative-repair-history-product-hunt`. | Useful service-vs-product control; not transaction-role evidence. |
| `پیانو تعمیر یا تعویض نشده است` | `gadYM7Nw` | تعمیرLCDکیبورد یاماها اتیری (خریدار ارگ و پیانو ) | Description says the advertiser buys organs and pianos. | Potential buyer-role counterexample; requires full snapshot and human grade. |
| `معاوضه با کفی سه محور` | `gaZj__jh` | تریلی بیات معاوضه با کفی سه محور | Explicit exchange; exact. | Positive exchange control. |
| `معاوضه با کفی سه محور` | `gaXHuaUP` | کفی اطلس ۱۲۶۰ معاوضه با تانکر سه محور تمیز | Explicit exchange; exact. | Positive exchange control. |
| `پیانو تعمیر یا تعویض نشده است` | `gaaHG-1B` | پیانوC1 AIR KORG ژاپن اصلی | Generic piano product; description says near-new/clean/lightly used, but does not establish no repair/replacement history. | Candidate for grading on evidence sufficiency for absent-attribute constraint. |
| `پیانو تعمیر یا تعویض نشده است` | `gaTTuvES` | فروش نقد و اقساط انواع پیانو طرح آکوستیک یاماها | Shop offer for acoustic-style digital pianos; `near`, capped. | Potential category/variant mismatch control. |

## Current decision

1. Preserve the current title-scoped mixed-transaction penalty and all eligibility behavior until blinded evidence supports a change.
2. Add the refrigerator buyer-side listing as a candidate for the next blinded role-direction packet, not as a pre-graded example.
3. Before grading, refresh each chosen listing and save the full title, full description, query, city, price, capture timestamp, and stable internal ID. Do not use these excerpts as if they were full snapshots.
4. Collect 8–12 unique listings across at least two categories for the C01–C08 matrix in `BRH-MIXED-TRANSACTION-FOLLOWUP-PROTOCOL.md`. The current artifact has useful leads but does not fill that matrix.
5. Do not expand the heuristic, merge to `main`, or deploy based on this observation alone.
