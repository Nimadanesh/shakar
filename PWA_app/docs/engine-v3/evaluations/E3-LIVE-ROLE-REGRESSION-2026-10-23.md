# E3 live role regression observation — 2026-10-23

Branch: `engine_v3`
Observed code SHA: `48703004ea38412538781e53f66800ccaa811d20`
Live workflow: [run 39913211370](https://github.com/Nimadanesh/shakar/actions/runs/39913211370), artifact `engine-v3-live-observation-85`.
Baseline workflow: [run 39913211263](https://github.com/Nimadanesh/shakar/actions/runs/39913211263).

## Method and limits

Read-only Divar observation; Node 24.21.0; two list pages maximum per query; two detail fetches per scenario, four total for the role-control test; Mizan shadow disabled. Reports were buffered as workflow artifacts; no app or Supabase writes. These are unjudged snapshots, not precision/recall, paired relevance scores, or proof of user-quality improvement.

## Seller-role and ordinary-search controls

- Query `فروشنده یخچال`: 50 ads seen, 50 candidates after filters, 10 role-cue candidates, two details checked. Both selected candidates were retained as exact: `فروشندی و/ خریدار یخچال ۲ در تک در همه جا'سمساری'` and `فروش یخچال فیلکو`.
- Query `یخچال`: same 50 ads/candidates, same two details and same two exact top results, including the mixed seller/buyer ad above.
- No selected listing was eliminated in either query. The ordinary query is a bounded no-global-rejection control, but because both queries retrieved the same 50-candidate set and the same top two, this is not an independent paired comparison or proof that all buyer listings remain eligible.
- Important unresolved limitation: the mixed-role ad survives the seller-intent query, and the resolver reports `roleMode: "seek-seller"` while `queryRole.role` remains `product`. This observation does not establish whether mixed-role or buyer-only ads should be demoted/rejected. Do not add a broader buyer guard without explicit positive seller controls and blinded review.

## Negative repair/replacement-history observation in the same artifact

- `پیانو تعمیر یا تعویض نشده است`: both detail-checked candidates in the service-control scenario were rejected: `تعمیر پیانو دیجیتال` as `service-offer-for-negative-repair-history-product-hunt`, and `تعمیرLCDکیبورد یاماها اتیری (خریدار ارگ و پیانو )` as `no-match`. This is useful evidence for these two examples only.
- For the same target phrase, two piano product listings with unknown repair/replacement history were retained as `near` in the separate exact-phrase scenario. That is consistent with UNKNOWN remaining distinct from violated, but is still a tiny sample.
- Explicit exchange control `معاوضه با کفی سه محور` returned two exact exchange-role listings.
- `پیانو قطعات اورجینال تعویض نشده` produced one near result and one no-match rejection; the surviving consultation ad is not enough to validate relevance of the query overall.

## CI / validation

For [baseline run 39913211263](https://github.com/Nimadanesh/shakar/actions/runs/39913211263):
- Focused hunt/search tests: PASS
- Full portable test suite: PASS
- TypeScript typecheck: PASS
- Production build: PASS
- ESLint: FAIL — 8 errors and 37 warnings. The eight errors are `react-hooks/set-state-in-effect` in existing UI components/hooks; the new observation test file did not appear among the lint errors. Do not call this a clean CI pass. No lint cleanup was mixed into the search experiment.

## Decision / next step

Keep engine behavior unchanged. The observation supports that seller listings remained eligible and that the ordinary `یخچال` sample was not globally rejected, but it does not prove seller-role discrimination or quality uplift. Keep the current narrow negative-history guard; no broad role changes. Next high-value step is independent blinded grading of packet [BRH-2026-10-23-A](./BRH-2026-10-23-A-BLIND.md), with its internal key withheld until grades are returned. Then decide from exact candidate-level grades whether any role/history change is justified. No main merge or deployment.
