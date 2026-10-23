# BRH — Cross-category mixed-transaction capture results (2026-10-23)

## Provenance and limits

- Capture workflow: [run 39981420938](https://github.com/Nimadanesh/shakar/actions/runs/39981420938)
- Baseline on the same merge SHA: [run 39981420755](https://github.com/Nimadanesh/shakar/actions/runs/39981420755)
- Source/merge SHA: `531f6eb13b4b5ef546d8ca5e6d1e079b317566ef` (PR #31)
- Artifact: `engine-v3-mixed-transaction-packet-capture`, artifact ID `12513971253`, created 2026-10-23T15:49:13Z.
- Read-only Divar capture, Node 24; 6 scenarios, 4 pages per query maximum, 2 details per scenario / 12 total, 12 unique IDs, categories home and music, `MIZAN_SHADOW=0`.
- All `productionRank` values are null. These are bounded sampled ranks, not production top-N comparisons. This is raw internal evidence, not a blinded packet or human-graded result. Do not infer precision/recall or quality uplift.

## Human review pending

Grade relevance to the *specific query intent*, not merely whether the listing mentions the product. Use 3 exact/relevant, 2 relevant but materially incomplete/indirect, 1 weak relevance, 0 irrelevant; use unknown only when the captured text cannot support a judgment. Listing condition should not reduce relevance unless it violates an explicit query constraint.

### A. Seller-seeking refrigerator — query: `فروشنده یخچال`

| Source ID | Title | Capture result (not a human grade) |
|---|---|---|
| `gaVb_lLq` | یخچال بالافریزراسنواباقیمت اقتصادی درفروشگاه رسالت | eligible; bounded sample rank 2; matchKind near |
| `Qakjf1_E` | یخچال ساید بای ساید دوو مدل 11-20 سری 2026 | eligible; bounded sample rank 1; matchKind exact |

Context: first listing is a store offering appliances for sale and accepting used refrigerators in exchange; second is a direct commercial offer for a Daewoo refrigerator. Neither has a production rank.

### B. Generic refrigerator — query: `یخچال`

| Source ID | Title | Capture result (not a human grade) |
|---|---|---|
| `gabH4G7m` | یخچال سالم بفروش مرسد | eligible; bounded sample rank 1; matchKind exact |
| `ga4-mBNz` | خریدار فروشنده قطعات تعمیرات تخصصی ساید یخچال | rejected; reason `dealer-mixed:offering:"فروشنده خریدار"` |

Context: second ad offers refrigerator parts and repair-related services, rather than a whole refrigerator.

### C. Buyer-seeking refrigerator — query: `خریدار یخچال`

| Source ID | Title | Capture result (not a human grade) |
|---|---|---|
| `gabDordK` | یخچال فریزر هیمالیا معاوضه با آیفون 15 یا 16 نرمال | eligible; bounded sample rank 1; matchKind near |
| `gabDYxGg` | یخچال پارس فوری فروشی | eligible; bounded sample rank 2; matchKind near |

Context: first offers a refrigerator in exchange for an iPhone; second is a direct sale ad. This pair can help assess whether the requested buyer-seeking role is respected.

### D. Seller-seeking piano — query: `فروشنده پیانو`

| Source ID | Title | Capture result (not a human grade) |
|---|---|---|
| `gabbEP5H` | کارشناسی خرید و فروش پیانو | eligible; bounded sample rank 2; matchKind near |
| `ga7lYO1T` | پیانو هم خریددارم هم فروش یاماها کرگ | eligible; bounded sample rank 1; matchKind exact |

Context: first offers piano appraisal and buying/selling services; second offers expertise to people selling their piano and also says the author buys pianos.

### E. Generic piano — query: `پیانو`

| Source ID | Title | Capture result (not a human grade) |
|---|---|---|
| `gamqZPQ8` | هنگدرام (آموزش-فروش) گیتار پیانو ویولن سنتوردف ارگ | rejected; reason `training:offering:"آموزش"` |
| `gaYWPdfV` | فروش (خریدار)پیانو اکوستیک و دیجیتال | eligible; bounded sample rank 1; matchKind exact |

Context: first is an instrument school advertisement mentioning piano among instruments taught/sold; second explicitly seeks to buy acoustic and digital pianos from the reader.

### F. Buyer-seeking piano — query: `خریدار پیانو`

| Source ID | Title | Capture result (not a human grade) |
|---|---|---|
| `gaoy3Rl-` | ارگ پیانو یاماها ydp clp خریدار فروشنده | eligible; bounded sample rank 1; matchKind exact |
| `wZHWN6mH` | فروش ارگ پیانو غرب تهران Ctk Psr یاماها کاسیو | eligible; bounded sample rank 2; matchKind near |

Context: first says the author buys at the customer's home; second is a shop selling instruments that also explicitly says it buys organs and pianos from customers.

## Interpretation guardrails

1. The two-detail budget per scenario is exhausted; the 12 listings are not a representative estimate of result quality.
2. The output mixes title-pattern suggestions, internal match labels, eligibility, and bounded sample ranks. Those fields must not substitute for human relevance judgments.
3. The capture provides useful positive/negative examples for reviewing transaction role and mixed-title behavior, but no paired production ranking evidence.
4. Do not add a penalty or hard rejection based only on this capture. First obtain independent human grades, reconcile the exact listing/intent pairs, then decide whether a narrowly scoped regression test or code change is warranted.
5. Frozen evaluation artifacts and prior human grades remain untouched.
