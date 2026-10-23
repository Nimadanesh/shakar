# BRH mixed-transaction capture 01 — locked human grades

Date: 2026-10-23
Branch: engine_v3
Source capture: [workflow run 39970882822](https://github.com/Nimadanesh/shakar/actions/runs/39970882822)
Blind packet: BRH-mixed-transaction-blinded-packet.md
Internal key: [BRH-2026-10-23-MIXED-TRANSACTION-INTERNAL-KEY.md](./BRH-2026-10-23-MIXED-TRANSACTION-INTERNAL-KEY.md)

## Locked owner grades

These are the owner-supplied grades, recorded without changing any prior frozen packet or grade.

| Blind ID | Task | Grade | Human judgment |
|---|---|---:|---|
| R04 | A — seller refrigerator | 1 | Title says mixed buy/sell, but body only supports buying; no evidence of selling. Mirrors B01. |
| R07 | A — seller refrigerator | 3 | Direct, unambiguous cash sale of a Samsung refrigerator-freezer. |
| R10 | B — generic refrigerator | 2 | Mixed title but body only says buyer-seeking; relevant to the product, transaction direction incomplete. Mirrors B02. |
| R05 | B — generic refrigerator | 3 | Clean direct refrigerator-freezer sale; moving is the stated reason. |
| R12 | C — buyer refrigerator | 0 | Pure seller listing, opposite transaction direction. |
| R08 | C — buyer refrigerator | 2 | Explicit purchase of broken refrigerators, but part of a multi-item scrap-buying package and limited to broken goods. |
| R03 | D — seller piano | 2 | Explicit buy/sell service, but no specific piano is offered; offer is split between appraisal and trading. |
| R01 | D — seller piano | 1 | Music school/training ad; piano sale is one item in a broad list, with no specific offer, model, or price. |
| R09 | E — generic piano | 3 | Piano-focused shop with explicit buying and selling, warranty, price, and consultation. |
| R02 | E — generic piano | 2 | Title mentions sale/buyer, but body only supports buying; relevant to a generic piano hunt with incomplete transaction direction. Mirrors B02. |
| R06 | F — buyer piano | 3 | Explicit cash-at-home buying offer for Yamaha YDP/CLP; body controls over title wording. |
| R11 | F — buyer piano | 0 | Direct piano sale, opposite transaction direction. |

## Distribution

- Grade 3: 4
- Grade 2: 4
- Grade 1: 2
- Grade 0: 2
- Insufficient: 0
- Sum: **22 / 36**; mean grade **1.83 / 3** across 12 query-conditioned judgments.

Per-task sums (two judgments each): A = 4/6; B = 5/6; C = 2/6; D = 3/6; E = 5/6; F = 3/6.

## Interpretation and limits

1. In seller-refrigerator task A, the mixed-title/body-only-buying ad (R04=1) is clearly below the direct seller (R07=3). In generic refrigerator task B, the mixed-title/body-only-buying ad remains relevant but below the direct offer (R10=2 vs R05=3). This is consistent with the prior B-packet concern and supports preserving the distinction between product relevance and seller-role evidence.
2. In buyer-refrigerator task C, the direct seller is a critical direction mismatch (R12=0), while the scrap buyer is relevant but conditional and peripheral (R08=2).
3. In seller-piano task D, the mixed buy/sell/appraisal offer is somewhat relevant (R03=2), while the education-led listing is weak (R01=1). This reinforces the need to judge listing focus, not just whether a product word appears.
4. In generic piano task E, the piano-focused shop is exact in human relevance (R09=3), while the buyer-only offer is still product-relevant but transaction-incomplete (R02=2).
5. In buyer-piano task F, the body-level explicit buying offer is highly relevant (R06=3), while the pure sale is opposite-direction (R11=0).

These are 12 human relevance judgments across six task-conditioned pairs, not a representative estimate of engine quality. The capture does **not** contain production ranks (productionRank is null); therefore the grades do not establish a ranking delta, precision@5, nDCG@5, or causal impact of the mixed-title penalty. Do not interpret engine score or matchKind as human labels.

## Locked decision

- Preserve all 12 grades as recorded.
- Keep the existing narrow title-scoped cue and eligibility behavior unchanged.
- Do not generalize the penalty or introduce a hard filter from this sample alone.
- Matrix gaps remain: no compact “خریدوفروش” title and no clean barter/exchange-condition example. The explicit buyer-seeking refrigerator control is also weak/absent in the selected detail budget.
- Next step: a bounded, targeted supplement for missing matrix cells, without widening global retrieval budgets; then blinded human review if a decision-relevant case is captured. No main merge or deployment.
