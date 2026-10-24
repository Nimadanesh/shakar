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

## Retargeted-v2 capture — 2026-10-24

- Follow-up 03 run [40067010071](https://github.com/Nimadanesh/shakar/actions/runs/40067010071), artifact `12549831722`, and cross-category run [40067010065](https://github.com/Nimadanesh/shakar/actions/runs/40067010065), artifact `12550305076`, completed successfully on PR head `49a564a7e1123452ab4930d52a2619dedcdb980e`. Kind regression/portable suite/typecheck also passed in [run 40067010122](https://github.com/Nimadanesh/shakar/actions/runs/40067010122).
- The retargeted buyer query `خریدار یخچال خراب` captured `gabzLV7f` (`خرید یخچال سالم و خراب همچی پقمق`), engine exact/4.5. Mixed refrigerator query returned `QaoPqC7X`, a buyer of broken refrigerators despite a mixed title, exact/3.5. Seller query returned `gac7TJRT`, `فروش یخچال فریزر الکترو استیل`, exact/3.5.
- Whole-vehicle query returned `gaO7GNJh`, `خریدوفروش نیسان تناژ پایین`, near/-1.5. Voucher query returned `gaE5qO5h`, `حواله خودرو`, exact/3.5. Exchange query returned `gabjtdOw`, `سمند ۹۸ معاوضه با ۲۰۶`, exact/3.5. Ordinary appliance control `gaay7dtd` was an appliance sale with cash/installment wording, exact/3.5. Wrong-kind control `gaDkHop1` was a mixed refrigerator buying/selling ad mentioning a burnt motor, near/-1.5.
- Cash query `خودرو نقدی` and retargeted installment query `فروش اقساطی خودرو` both remained missing within the bounded pool. Do not broaden the cap or claim these cells were tested successfully.
- Cross-category capture returned `gayyxUTa`, `خریدار و فروشنده یخچال فریزر سالم و خراب`, near/0.5 for `فروشنده یخچال`; compact vehicle buy/sell returned `gaMPHkWW`, `خریدوفروش حواله خودرو`, near/0.5. These and the other captured IDs are inspected and must not be reused in a blind packet.
- New capture tests now exclude the newly inspected IDs. Cross-category capture also filters previously inspected IDs before selection and reports any overlap.
- E3 bounded live diagnostic only: no human grades, no production-rank comparison (`productionRank=null`), no quality-uplift claim. No behavior/ranking/eligibility changes authorized; PR #41 remains Draft/unmerged; `main` and `engine_v3` remain untouched.
## Exclusion-validation capture — 2026-10-24

- Follow-up 03 run [40067384277](https://github.com/Nimadanesh/shakar/actions/runs/40067384277), artifact `12550440345`, cross-category run [40067384263](https://github.com/Nimadanesh/shakar/actions/runs/40067384263), artifact `12550375465`, and kind regression [40067384285](https://github.com/Nimadanesh/shakar/actions/runs/40067384285) all completed successfully. Artifact commit is PR merge ref `39e40642b67cd40830232d22c78979b18107dfa4`; the tested branch head before the latest exclusion-list amendments was `a8942737bb6d70194739064cb9029f6f022b83be`.
- Follow-up 03 captured: `gacT0u2G` seller fridge; `garWfS78` buyer of good/broken fridges; `Qa9fP53U` mixed buyer/seller refrigerator listing; `gaVv8W6C` mixed whole-vehicle trade listing; `gacXDBWE` employee vehicle voucher; `gaFzv-Qd` Samand explicitly offered for exchange; `gahEL1JU` ordinary fridge sale; `gaLHWNrk` refrigerator motor/part. Cash `خودرو نقدی` and installment `فروش اقساطی خودرو` remained missing within the 2-page bounded pool.
- Cross-category capture selected `gacT0u2G` seller fridge, `galqJmNl` `خریدوفروش حواله خودرو`, `ga4d_A6Z` `مزدا خریدار تصادفی`, `gaPfmFQa` damaged Peugeot seller, `gaUP4Rl-` Toyota Venza escrow/sale, and `ga9KvfNV` car-battery roadside service. The latter two were selected by broad `خرید و فروش خودرو` query despite only partial/adjacent fit, a diagnostic observation—not a human grade.
- Important exclusion audit finding: the Follow-up 03 artifact still selected `Qa9fP53U` and `gacXDBWE`, both present in prior human-graded packets, because those two IDs were missing from its exclusion set. The cross-category artifact also selected `gacT0u2G`, which was inspected in parallel by Follow-up 03; parallel runs cannot share a live exclusion set. This is now corrected by adding the previously graded packet IDs and all selected IDs from both latest artifacts to both capture tests' exclusion sets. The next run must verify the correction before any new blind packet is considered.
- `overlapWithPriorPackets` and `overlapWithInspected` are diagnostics over candidate pools, not evidence that selected listings were cleanly novel. Treat the current artifacts as E3-only and exclude every opened ID, including those listed above. No grades were assigned to the new listings; no production-rank comparison (`productionRank=null`) or uplift claim is available.
- The corrected exclusion lists are test-only. No production behavior/ranking/eligibility change is authorized. PR #41 remains Draft/unmerged; `main` and `engine_v3` remain untouched.
## Cross-category exclusion verification — 2026-10-24

- Run [40067592333](https://github.com/Nimadanesh/shakar/actions/runs/40067592333) passed on test commit `29df89abc19bb42d1722d14521ac447745b076aa`; artifact `12549667333` was created at PR merge ref `699b354ef22ff2111800f852dfb34366b4dfceb8`. It selected six IDs not found in the then-current inspected-ID set and reported prior overlaps separately.
- Newly inspected IDs: `gacXU-Wj` (water-filter service mentioning refrigerator filters), `gaoyGo-V` (catalytic-converter service), `gaRS8JbI` (damaged-car buyer/advisor), `gacfDsAU` (damaged-car sale, rejected), `gabf9GoW` (Chery sale/exchange), and `gaBO62kC` (Soren/vehicle delivery). All six have now been added to both capture tests' exclusion sets.
- The most notable E3 diagnostic is `gacXU-Wj`: a water-filter service title mentioning refrigerator and washing-machine filters received `exact`/3.5 for `فروشنده یخچال`. This is a plausible high-severity false-positive hypothesis worth a future blinded human check, but not a confirmed human-grade failure and not grounds for an immediate patch. Likewise, `gaoyGo-V` scored near/0.5 for generic vehicle buy/sell, and the buyer-damaged-vehicle control included a service and a rejected seller. These are live observations, not population estimates.
- The run's overlap list included several IDs from the current and prior capture sets, but those were filtered before selection. Because independent live runs can execute concurrently, the tests cannot share a single mutable exclusion set across jobs; therefore all selected IDs from each completed artifact must be copied into both test exclusion sets before a subsequent capture.
- E3 only, bounded to two pages per query and six detail checks. No human grades, no production-rank comparison, no quality-uplift claim. The two newly edited exclusion sets need their own follow-up capture and regression runs to verify the latest additions.
