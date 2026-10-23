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


## Follow-up observation — latest code commit

- Workflow run: https://github.com/Nimadanesh/shakar/actions/runs/39923937783
- Artifact: `engine-v3-live-observation-99` (artifact ID `12487643656`)
- Branch / commit: `engine_v3` / `f148a7655b99a150abe1f105b8680254b49e623a`
- Captured at: 2026-10-23 08:21 UTC
- Status: bounded read-only observation succeeded; `mizanShadow=0`. Eight details were inspected across four piano/exchange scenarios; four more details across two refrigerator-role scenarios. No human grades were collected.

### Refrigerator role probe (fresh capture)

The newest run does **not** reproduce the two older refrigerator listing IDs; it captured a new pair in its role-prioritized detail sample:

| Query | Rank | Listing ID | Title | Description excerpt | Diagnostic fields |
|---|---:|---|---|---|---|
| `فروشنده یخچال` | 1 | `gabjhZ9C` | فروش خریدار یخچال آبگرمکن اجاق گاز بخاری سمساری | سمساری لوازم منزل همه نوع ضایعات یخچال فریزر اجاق گاز سالم خراب بر میداریم | Generic role classifier says `product` because it sees `فروش`; title-only mixed cue false; estimated scoring role `product`; expected mixed penalty 0. |
| `فروشنده یخچال` | 2 | `ga9lf2wH` | یخچال فریزر خراب کارکرده کل کرج شهریار پرند خریدار | یخچال فریزر در هر وضعیتی | Generic role `unknown`; title-only mixed cue false; estimated role `unknown`; expected mixed penalty 0. |
| `یخچال` | 1–2 | Same two IDs | Same two titles | Same excerpts | The same pair appeared in the diagnostic detail sample for the generic query. |

Interpretation: this is a strong candidate for blinded review of transaction direction (especially the first listing, whose title includes both `فروش` and `خریدار` while its description says the shop collects used/broken appliances). It is **not** a direct test of the narrow `خرید و فروش` / `خریدوفروش` title cue, because the cue is false for these titles. The role-prioritized sample is not the complete/global result ranking, so do not claim the penalty failed or the top-result order changed globally.

### Piano and exchange probes (fresh capture)

- Query `پیانو قطعات اورجینال تعویض نشده`: the inspected candidates were `gaMHOPjJ` (`پیانو اصلی بتهوون اصلی`, near; description claims no changes/handling but does not establish original parts) and `gaa7yUyl` (piano-buying consultation, near). The former may be relevant but lacks explicit evidence for `قطعات` and `اورجینال`; the latter is a possible service/editorial false positive.
- Query `پیانو تعمیر یا تعویض نشده است`: `gaTfSd0P` (`تعمیر پیانو دیجیتال`) was rejected as `service-offer-for-negative-repair-history-product-hunt`; `gadYM7Nw` (`تعمیرLCDکیبورد یاماها اتیری (خریدار ارگ و پیانو )`) was rejected as no-match even though its description says the advertiser buys organs and pianos. This is a useful buyer-role counterexample for human review, not proof of a bug without grading.
- Query `معاوضه با کفی سه محور`: `gaZj__jh` (`تریلی بیات معاوضه با کفی سه محور`) and `gaXHuaUP` (`کفی اطلس ۱۲۶۰ معاوضه با تانکر سه محور تمیز`) both matched exact as expected exchange controls.
- Query `پیانو تعمیر یا تعویض نشده است`: `gaaHG-1B` (`پیانوC1 AIR KORG ژاپن اصلی`) appeared near; “درحد نو / بسیار تمیز / کم‌کارکرد” does not prove no repair/replacement history. `QaJSBQQA` was a decorative/fantasy piano listing and also near, suggesting a potential product-variant mismatch.

### Follow-up decision

1. Keep the narrow title-only mixed-transaction cue unchanged; the latest refrigerator examples do not exercise it.
2. Add `gabjhZ9C` and `gadYM7Nw` as *ungraded candidate leads* to a transaction-direction packet if their full listing snapshots can be refreshed.
3. Preserve the distinction between observed generic `listingRole`, title-cue estimate, and actual internal ranking telemetry. The artifact's `cueDerivedScoringRoleEstimate` is diagnostic reconstruction only; it is not an internal score trace.
4. The artifact contains excerpts rather than a complete immutable listing snapshot. Capture full title, description, price, city, timestamp, and query before blinded grading.
5. No heuristic expansion, merge to `main`, or deployment is justified by this run alone.
