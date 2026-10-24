# Issue 16 — retargeted capture readout (2026-10-24)

## Provenance
- Capture code head: `5d802bba3bf7361fe2db099da24548c057ae43a6`.
- [Follow-up 03 run 40066771760](https://github.com/Nimadanesh/shakar/actions/runs/40066771760), artifact `12549078515`, completed successfully.
- [Cross-category run 40066771757](https://github.com/Nimadanesh/shakar/actions/runs/40066771757), artifact `12550090272`, completed successfully.
- [Kind regression run 40066771783](https://github.com/Nimadanesh/shakar/actions/runs/40066771783), completed successfully: focused kind regression, portable hunt/search suite, and TypeScript typecheck passed.
- Follow-up budget: 2 list pages/query, 8 detail reads / 8 unique IDs; cross-category budget: 2 pages/query, 6 detail reads / 6 unique IDs. Mizan shadow off, `productionRank=null`.

## Follow-up 03 observations
- Refrigerator seller query selected `gavBLU60`, but this is primarily a water-filter installation/service ad that merely mentions refrigerator filters. Engine `near`, score 3.5: diagnostic warning that lexical evidence/score can be high despite weak target fit. It is not a human-graded false positive.
- Buyer cell remained missing within the bounded query after excluding inspected/prior IDs.
- Mixed refrigerator query selected `gaVn-dm2`, “خرید و فروش یخچال”; description explicitly advertises buying and selling working/broken refrigerators. Engine `near`, score 0.5.
- Whole-vehicle query selected `gabvBEiY`, a dealer/group listing for zero-kilometer Dena/Tara/Soren/207 and broad vehicle buying/selling, with an incidental “حواله” mention. Engine `near`, score 0. This is a plausible positive but is not human-graded.
- Voucher query selected `ga7dAoCa`, “خدمات حواله خودرو”; engine `near`, score 3.5. This appears service-oriented and is not human-graded.
- Cash query selected `gaKufbEV`, Soren advertised as cash and installment; engine `near`, score 3.0.
- Installment query `ماشین قسطی` remained missing within the two-page bounded pool.
- Exchange query `معاوضه با سمند` selected `gabP-8po`, Samand 1384 explicitly offered for exchange with Pride; description notes serious engine damage. Engine `exact`, score 3.5. It appears to satisfy the exchange intent, but no human grade was collected.
- Ordinary fridge control `gaVP5Rtf` was a fridge/freezer listing, engine exact 3.5.
- Part control `gaXTjbv8` was a refrigerator motor/parts listing, engine near 1.5, with “قطعه” missing from evidence.

## Cross-category observations
- `gaTI-Kn3`: mixed “seller/buyer ... refrigerator” title, description says buyer of new household appliances; engine near 3.5.
- `gac7yxi1`: catalytic-converter/exhaust service listing for `خریدوفروش خودرو`, engine near 0.5.
- `gajmIwfW`: damaged-car buyer/consultation service, engine exact 3.5.
- `gacjTTyh`: damaged Peugeot 206 for sale, engine near -1.
- `Qa8HqiWJ`: catalytic-converter buying/repair service, engine near 2.1667.
- `gaSLpCEY`: damaged-car buyer/seller service listing, engine near 0.5.
These records were inspected diagnostically, not human-graded. They cannot be turned into a blind packet now.

## Decision
This remains E3 live diagnostic evidence only; no human grades, no production-rank comparison, and no quality-uplift claim. Add all newly inspected IDs to the exclusion list for future blind packets/captures. The exchange target now has a plausible live candidate, but installment and a fresh refrigerator-buyer target remain missing. No buyer-role, voucher, vehicle eligibility, hard-rejection, or ranking changes are authorized. PR #41 remains Draft/unmerged; `main` and `engine_v3` remain untouched.
