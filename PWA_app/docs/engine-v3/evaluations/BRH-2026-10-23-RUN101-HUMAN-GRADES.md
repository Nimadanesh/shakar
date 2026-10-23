# BRH Cross-Category Human Grades — Run 101 — 2026-10-23

## Status
**Human grades received and locked.** These scores are query-conditioned judgments for the nine unique listings in `BRH-2026-10-23-RUN101-BLIND.md`. This is a bounded diagnostic packet, not a random sample or a population-quality estimate.

## Final scores

| Blind ID | Grade | Human rationale / decisive evidence |
|---|---:|---|
| P01 | 2 | Correct product and seller-side listing, but “like new / very clean / low use” describes appearance and usage, not repair history. Silence on the constraint means relevant but unverified. |
| P02 | 0 | Piano cabinet/box, not a piano; accessory is not the requested product. |
| P03 | 3 | “Without change, relocation, or tampering” is explicit evidence of untouched condition for the original-parts query; technician service/inspection is not evidence of part replacement. Service is not replacement. |
| P04 | 0 | Pure repair/service offer, not a product listing or seller of a piano. |
| P05 | 0 | Description explicitly says the advertiser buys organs and pianos; wrong transaction direction. The title’s “repair” wording does not override the body’s explicit buyer role. |
| P06 | 3 | Trailer offered in exchange for a three-axle flatbed; the requested flatbed is what the advertiser wants in exchange. |
| P07 | 2 | Flatbed is offered for exchange, but its own three-axle status is not established; “three axle” describes the requested tanker. Both offered and requested sides matter in exchange matching. |
| P08 | 1 | Mixed buyer/seller title, but the body evidences buying refrigerators from owners / rapid-sale facilitation, not selling a refrigerator to the user seeking a seller. |
| P09 | 1 | Body is explicitly buyer-seeking (“we buy all types of refrigerators”); no evidence the advertiser sells one. Per the packet rubric, wrong direction is grade 1 (weak), not 0. |

## Distribution
- Grade 3: 2 listings (P03, P06)
- Grade 2: 2 listings (P01, P07)
- Grade 1: 2 listings (P08, P09)
- Grade 0: 3 listings (P02, P04, P05)
- Insufficient: 0 listings
- Sum: 12 / 27 possible; mean grade: 1.33 / 3 (descriptive only; do not interpret as a population estimate).

## Findings to carry forward
1. **Condition/history evidence must be read semantically.** “Like new / low use” does not establish no repairs; explicit “no change/tampering” can support original/untouched condition. Technician service is not synonymous with component replacement.
2. **Product vs accessory and product vs service are distinct hard intent boundaries.** A piano cabinet and a piano repair service are not pianos for sale.
3. **Exchange direction must be represented from the user's perspective.** The wanted item may be the counterparty's requested item, not the item they are offering. Check constraints on both sides of the exchange.
4. **Transaction direction should be inferred from the whole listing, with explicit body evidence outweighing ambiguous title cues.** A buyer-only listing is weak for a user seeking a seller; the packet's rubric explicitly assigns wrong direction grade 1 rather than 0.
5. These nine examples are diagnostic leads only. Do not alter broad heuristics or claim a measured global precision change from them alone.

## Provenance and limitations
- Source candidate capture: [GitHub Actions run #101](https://github.com/Nimadanesh/shakar/actions/runs/39925034571).
- Blind packet and separate key are stored beside this report in the same evaluations directory.
- Per-listing publication timestamps were not captured. Observation timestamps are capture times only.
- No ranking/scoring code, deployment, or main-branch change was made as part of grading.
