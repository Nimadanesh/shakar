# Internal Mapping — BRH-2026-10-23-A

**Do not provide this file to the evaluator before grades are returned.** This is the answer-key/mapping record; human grades must be recorded in a separate file.

Source workflow: [39911832666, attempt 2](https://github.com/Nimadanesh/shakar/actions/runs/39911832666)  
Artifact: `engine-v3-live-observation-84`  
Code SHA: `70a077e06e069b3d40f1b0673b5289c3194b5539`

| Blind ID | Scenario | Source ad ID | Exact title | Engine observation | Evidence note |
|---|---|---|---|---|---|
| A01 | exact-negated-phrase | `gaaHG-1B` | پیانوC1 AIR KORG ژاپن اصلی | `near`; listing role unknown | Excerpt says clean/low-use but does not establish repair/replacement history. |
| A02 | repair-service-control | `gadYM7Nw` | تعمیرLCDکیبورد یاماها اتیری (خریدار ارگ و پیانو ) | rejected `no-match` | Description explicitly says advertiser buys organs and pianos; role mismatch for this product hunt. |
| A03 | exact-negated-phrase | `gaH4GOSc` | فروشگاه پیانو شهرام فر | `near`; capped | Seller/catalogue role; excerpt does not establish repair/replacement history of a specific piano. |
| A04 | repair-service-control | `gaTfSd0P` | تعمیر پیانو دیجیتال | rejected `service-offer-for-negative-repair-history-product-hunt` | Explicit repair/service offer, not a product listing satisfying negative history. |
| B01 | negated-replacement-history | `gaa7yUyl` | پیانو. (مشاوره خرید با اساتید مجرب | `near` | Product-adjacent consultation/catalogue text; excerpt does not establish original parts or no replacement. |
| B02 | negated-replacement-history | `gaMHOPjJ` | پیانو اصلی بتهوون اصلی | rejected `no-match` in this specific query | Description says no changes/handling and healthy condition, but does not explicitly establish original parts; human review should judge evidence independently. |

## Integrity notes

- The blind packet uses fixed IDs A01–B02 and contains no engine verdicts or source IDs.
- Human grades are not inferred from engine labels and are not yet recorded.
- This six-record packet is a targeted diagnostic sample, not a representative precision estimate.
- The artifact stores bounded excerpts, not full frozen listing details; do not infer facts absent from these excerpts.
