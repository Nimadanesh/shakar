# Issue 16 — reordered bounded capture readout (2026-10-24)

## Provenance
- PR #41 head: `06cdbca99ff54da8af4e4f2ffb5236868d8074c1`.
- Follow-up 03: [run 40066497139](https://github.com/Nimadanesh/shakar/actions/runs/40066497139), artifact `12548878598`.
- Cross-category: [run 40066497099](https://github.com/Nimadanesh/shakar/actions/runs/40066497099), artifact `12549288879`.
- Kind regression: [run 40066497141](https://github.com/Nimadanesh/shakar/actions/runs/40066497141), success (focused kind tests, portable hunt/search suite, TypeScript typecheck).
- Follow-up capture is bounded to 2 pages/query, 8 detail calls and 8 unique IDs; Mizan shadow off; `productionRank=null`.

## Follow-up 03 readout
- Fresh explicit refrigerator-buyer candidate `gaNhm4BK`, title `کار نمیکنه یخچال خریدار`; description says it buys working and broken refrigerators. Engine: exact, score 3.5.
- Cash vehicle candidate `gaanVfX4`, title `پراید مدل 99فروش نقدی پول لازمم`; engine: near, score 1.5.
- Mixed refrigerator buyer/seller `ga1M_D8i`; engine exact, score 3.5.
- Whole-vehicle query `خریدوفروش خودرو` selected a Nissan pickup bar/bed accessory listing `gac7D9Tv`, not a whole-car positive; engine near, score -1.5.
- Voucher query selected `خریدوفروش حواله خودرو` (`gaMPHkWW`); engine near, score 0.5.
- Still missing within budget: `خودرو اقساطی` and `سمند معاوضه`. Ordinary refrigerator and parts controls were also captured.

## Interpretation / gate
This is E3 live diagnostic capture only. The diagnostic payload was inspected, so **do not convert this artifact into a blind packet**; exclude all selected IDs from future blind review. No human grades were collected for these records. This does not establish installment/exchange coverage, a clean whole-vehicle positive, or ranking uplift.

Keep PR #41 Draft/unmerged. No role, voucher, eligibility, or ranking changes. `main` and `engine_v3` remain untouched. Future capture should exclude these newly inspected IDs and seek fresh positive/contrast controls without loosening selection rules; if a cell is absent from the bounded pool, record it as missing.
