# BRH — Cross-category mixed-transaction capture results (2026-10-23)

## Provenance and limits

- Capture workflow: [run 39981420938](https://github.com/Nimadanesh/shakar/actions/runs/39981420938)
- Baseline on the same merge SHA: [run 39981420755](https://github.com/Nimadanesh/shakar/actions/runs/39981420755)
- Source/merge SHA: `531f6eb13b4b5ef546d8ca5e6d1e079b317566ef` (PR #31)
- Artifact: `engine-v3-mixed-transaction-packet-capture`, artifact ID `12513971253`, created 2026-10-23T15:49:13Z.
- Read-only Divar capture, Node 24; 6 scenarios, 4 pages per query maximum, 2 details per scenario / 12 total, 12 unique IDs, categories home and music, `MIZAN_SHADOW=0`.
- All `productionRank` values are null. These are bounded sampled ranks, not production top-N comparisons. This is raw internal evidence, not a blinded packet or human-graded result at capture time. Do not infer precision/recall or quality uplift.

## Human grades recorded

The independent human grades below were supplied by the project owner on 2026-10-23 and are recorded as given. Grade the listing against the **specific query intent**, not merely whether the listing mentions the product. The owner's boundary notes are preserved in the per-item notes below. No unknown grades.

| Grade | Meaning |
|---:|---|
| 3 | Exact / directly relevant |
| 2 | Relevant but materially incomplete or indirect |
| 1 | Weak relevance |
| 0 | Irrelevant to the requested intent |

## Results by scenario

### A. Seller-seeking refrigerator — query: `فروشنده یخچال`

| Source ID | Title | Human grade | Owner's judgment |
|---|---|---:|---|
| `gaVb_lLq` | یخچال بالافریزراسنواباقیمت اقتصادی درفروشگاه رسالت | 3 | Store genuinely sells refrigerators; title is a specific refrigerator. Accepting a used refrigerator in exchange is an additional option, not a reversal of the sale direction. |
| `Qakjf1_E` | یخچال ساید بای ساید دوو مدل 11-20 سری 2026 | 3 | Direct sale offer for a specific refrigerator from a central sales office. |

Scenario score: **6/6**.

### B. Generic refrigerator — query: `یخچال`

| Source ID | Title | Human grade | Owner's judgment |
|---|---|---:|---|
| `gabH4G7m` | یخچال سالم بفروش مرسد | 3 | Direct sale of the target item: a whole refrigerator. |
| `ga4-mBNz` | خریدار فروشنده قطعات تعمیرات تخصصی ساید یخچال | 1 | Borderline with 0. It offers parts and repair, not the complete target product. It is genuinely refrigerator-related, but the product/service is different; grade 0 would also be defensible if parts are treated as a distinct product. |

Scenario score: **4/6**.

### C. Buyer-seeking refrigerator — query: `خریدار یخچال`

| Source ID | Title | Human grade | Owner's judgment |
|---|---|---:|---|
| `gabDordK` | یخچال فریزر هیمالیا معاوضه با آیفون 15 یا 16 نرمال | 0 | Under a buyer-seeking task, this is a seller offering a refrigerator in exchange for an iPhone; transaction direction is reversed. |
| `gabDYxGg` | یخچال پارس فوری فروشی | 0 | Direct refrigerator sale under a buyer-seeking query; same error pattern as prior example R12. |

Scenario score: **0/6**.

### D. Seller-seeking piano — query: `فروشنده پیانو`

| Source ID | Title | Human grade | Owner's judgment |
|---|---|---:|---|
| `gabbEP5H` | کارشناسی خرید و فروش پیانو | 1 | Appraisal/buying-selling service only; no piano is offered. The main subject is intermediary service, not a product sale. |
| `ga7lYO1T` | پیانو هم خریددارم هم فروش یاماها کرگ | 2 | Explicitly claims to sell pianos, but the main focus is appraisal/guidance and no specific piano is offered; the listing's main focus is something else. |

Scenario score: **3/6**.

### E. Generic piano — query: `پیانو`

| Source ID | Title | Human grade | Owner's judgment |
|---|---|---:|---|
| `gamqZPQ8` | هنگدرام (آموزش-فروش) گیتار پیانو ویولن سنتوردف ارگ | 1 | Borderline with 0. It is a music school; piano appears in a list of instruments taught/sold, while training is the main focus. |
| `gaYWPdfV` | فروش (خریدار)پیانو اکوستیک و دیجیتال | 2 | Borderline with 3. It is a pure piano-buyer ad and strongly piano-focused, but for a generic query it seeks to buy rather than offer a piano, so it sits one level below a direct product offer. |

Scenario score: **3/6**.

### F. Buyer-seeking piano — query: `خریدار پیانو`

| Source ID | Title | Human grade | Owner's judgment |
|---|---|---:|---|
| `gaoy3Rl-` | ارگ پیانو یاماها ydp clp خریدار فروشنده | 3 | Body is purely a buying offer (“we buy at your home, cash”); the seller word in the title does not negate the real buyer intent in the body. |
| `wZHWN6mH` | فروش ارگ پیانو غرب تهران Ctk Psr یاماها کاسیو | 2 | Explicitly and genuinely buys organs/pianos from customers, but the title's main axis is shop sales and buying is presented alongside selling; target is bidirectional. |

Scenario score: **5/6**.

## Aggregate

- **12** listings graded; **0** unknown.
- Total: **21/36**; mean: **1.75/3**.
- Scenario scores: A 6/6, B 4/6, C 0/6, D 3/6, E 3/6, F 5/6.
- These are human relevance grades for the captured query/listing pairs. They are **not** a ranking-uplift measure: production ranks are absent, the sample is small and bounded, and capture ordering is not a production top-N comparison.

## Interpretation and next-step guardrails

1. The strongest confirmed failure in this packet is transaction-role mismatch for `خریدار یخچال`: both sampled refrigerator-sale ads receive 0. This is consistent with the need to respect buyer-seeking direction, but two samples alone do not establish a universal rule or justify a broad new penalty.
2. Do not conflate a mixed title with a mixed body. The piano examples show the body can establish a genuine buyer intent despite title wording; conversely, a seller-seeking query can match a listing whose main focus is intermediary service only weakly.
3. Whole-item relevance matters: refrigerator parts/repair and instrument-school services are weak for whole-product hunts even when they mention the target product.
4. For generic product queries, a buyer-only listing is related but not equivalent to an offer of the product. Preserve this distinction in evaluation rather than treating every product mention as a direct match.
5. Do not add a penalty or hard rejection based only on this capture. Use these grades to formulate narrowly scoped regression cases, then gather additional counterexamples/controls and compare against frozen evaluation before changing production ranking or eligibility.
6. Frozen evaluation artifacts and prior human grades remain untouched. This report records the supplied grades; it does not alter production code, ranking, retrieval, eligibility, or scoring.
