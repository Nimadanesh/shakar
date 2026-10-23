# INTERNAL KEY — BRH Cross-Category Blind Packet — 2026-10-23 (Run 101)

**Do not share with graders until their scores and reasons are locked.**

Source run: https://github.com/Nimadanesh/shakar/actions/runs/39925034571  
Commit: `b93aa37042455853e2ce3903abb03accbfe1a8ac`

Observation capture timestamps:
- Main observation: `2026-10-23T08:30:39.427Z`
- Role-regression sub-report: `2026-10-23T08:30:20.808Z`

These are **capture times only**. Per-listing Divar publication timestamps were not captured and must not be imputed.

| Blind ID | sourceAdId | Scenario / source bucket | Observed match state | Audit note |
|---|---|---|---|---|
| P01 | `gaaHG-1B` | exact-negated-phrase / top result | near | Product listing; “like new/clean/low use” does not establish repair or replacement history. |
| P02 | `ga3ur5vR` | exact-negated-phrase / rejected sample | rejected: part offering | Piano cabinet/box accessory rather than a piano itself. |
| P03 | `gaMHOPjJ` | negated-replacement-history / top result | near | Piano listing; says no change/manipulation in captured description, but does not directly establish original parts or all replacement history. |
| P04 | `gaTfSd0P` | repair-service-control / rejected sample | rejected: service offer for negative-history product hunt | Repair/service offer; wrong intent direction for a product hunt requiring no repair history. |
| P05 | `gadYM7Nw` | repair-service-control / rejected sample | rejected: no match | Title suggests repair, description says seller buys keyboards/pianos; useful counterexample for role direction and title/body conflict. |
| P06 | `gaZj__jh` | explicit-exchange-flatbed / top result | exact | Explicitly offers a trailer in exchange for a three-axle flatbed in title. |
| P07 | `gaXHuaUP` | explicit-exchange-flatbed / top result | exact | Exchange with a tanker of three axles, not necessarily the requested flatbed; inspect exact fit. |
| P08 | `QalrenkT` | seek-seller-refrigerator / top result | exact (engine) | Mixed buyer/seller wording; description says buying refrigerators and advertises rapid sale. Query-direction relevance requires human judgment. |
| P09 | `gaf2x6qk` | seek-seller-refrigerator / top result | exact (engine) | Buyer-seeking listing: buys used/broken refrigerators. Likely wrong direction when user seeks a seller to buy from. |

## Important methodological constraints
- The packet contains **9 unique listings across three categories** (music/piano, commercial vehicle exchange, refrigerators).
- Source candidates were selected by a bounded diagnostic probe, not sampled randomly. Do not report population precision or use these grades as a standalone quality estimate.
- Price is copied as observed from the live result; currency/unit display was not included in the artifact. Treat the numeric value as a captured listing price, not a verified normalized amount.
- Some listings appear only in a query-specific scenario; their relevance must be judged against that query, not in isolation.
- The same refrigerator listings appeared under both `فروشنده یخچال` and `یخچال` in the artifact. They are included once each here, under the seller-seeking query, to keep the packet at unique-listing level.
- No scoring/ranking code or live service was changed by packet creation.
