# E3 — Live observation: buyer/service role boundary

Date: 2026-10-23  
Workflow: [GitHub Actions run 39911832666, attempt 2](https://github.com/Nimadanesh/shakar/actions/runs/39911832666)  
Code SHA: `70a077e06e069b3d40f1b0673b5289c3194b5539`  
Artifact: `engine-v3-live-observation-84` (read-only JSON artifact)  
Classification: bounded, unjudged live observation; not a relevance score, paired comparison, or quality-uplift claim.

## Observed evidence

- **Negative repair/replacement-history target:** `پیانو تعمیر یا تعویض نشده است`. The service-control scenario retrieved using `تعمیر پیانو` and evaluated against the target definition. It rejected `تعمیر پیانو دیجیتال` with `service-offer-for-negative-repair-history-product-hunt`.
- **Buyer-seeking control:** the same scenario rejected `تعمیرLCDکیبورد یاماها اتیری (خریدار ارگ و پیانو )` as `no-match`. Its description explicitly says the advertiser buys organs and pianos. This is direct live evidence for the intended role boundary in the targeted hunt.
- **Unknown-history behavior:** in the separate exact-phrase scenario, `فروشگاه پیانو شهرام فر` and `پیانوC1 AIR KORG ژاپن اصلی` remained `near`. Neither was marked as having confirmed negative repair/replacement-history evidence in the report.
- **Exchange control:** query `معاوضه با کفی سه محور` returned two exact results whose listing role was `exchange`.
- **Negated replacement-history query:** `پیانو قطعات اورجینال تعویض نشده` resolved `تعویض` into `absentAttributes`; one product result was observed as `near`. The bounded result does not establish recall.

## Limits and unresolved gates

- Four scenarios, at most two list pages per query, eight detail reads total; no writes to application services and Mizan shadow disabled.
- No seller-seeking refrigerator scenario was included.
- No paired ordinary-search baseline or controlled before/after comparison was included.
- The report is unjudged; it cannot establish precision, recall, NDCG, or human-perceived uplift.
- Acceptance remains partial until seller-seeking/ordinary-search regression controls and a blinded source-matched human review are completed.

## Decision

Keep the existing narrow guard unchanged for now. Treat the sampled service/buyer rejection and UNKNOWN-history near behavior as supportive live evidence only. Do not merge to `main`, deploy, or broaden the rule based on this artifact.
