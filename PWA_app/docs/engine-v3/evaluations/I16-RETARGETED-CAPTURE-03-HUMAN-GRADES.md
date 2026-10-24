# Issue 16 — Retargeted Capture 03 Human Grades

Date locked: 2026-10-24  
Packet: Retargeted Capture 03  
Blind IDs: I16-R01–I16-R12  
Purpose: durable human-grade record, separate from the diagnostic/internal key.

## Locked grades

| Blind ID | Human grade |
|---|---:|
| I16-R01 | 3 |
| I16-R02 | 3 |
| I16-R03 | 1 |
| I16-R04 | 3 |
| I16-R05 | 3 |
| I16-R06 | 3 |
| I16-R07 | 3 |
| I16-R08 | 3 |
| I16-R09 | 3 |
| I16-R10 | 3 |
| I16-R11 | 3 |
| I16-R12 | 1 |

## Locked aggregate

- Scored items: 12/12.
- Grade sum: 32/36.
- Grade distribution: ten grade-3 items, two grade-1 items, zero grade-0 or grade-2 items.
- These grades are ground-truth relevance judgments; engine verdicts are reported separately and must not be used to alter the grades.

## Known rationale from the locked handoff

- I16-R03 and I16-R12 are catalyst listings. Both received grade 1 because they are not the complete car sought by the hunt. They are two independent examples of the same wrong-item-type failure, not two distinct failure families.
- I16-R05 is a buyer-seeking used-refrigerator listing and received grade 3. The engine rejected it with `appliance-not-home-goods`, making it the clearest observed eligibility false rejection in this packet.
- I16-R01, I16-R06, and I16-R08 each received grade 3 but the engine labeled each `near`; these are under-recognition/under-scoring signals, not the same failure as the eligibility rejection.
- Do not infer additional item-specific rationales from the aggregate. Preserve any richer rationale only from the original locked message/source record.

## Interpretation boundary

This is a 12-item, source-specific evaluation packet. It identifies two separate hypotheses for controlled follow-up:
1. **Eligibility false rejection:** I16-R05, buyer-seeking used refrigerator, rejected as `appliance-not-home-goods`. This may share a family with other refrigerator/home-goods eligibility errors, but that family must be independently demonstrated.
2. **Wrong item type retained:** I16-R03 and I16-R12, catalyst listings retained for a whole-car hunt. These are independent witnesses to one candidate failure type.

The grade-3 `near` cases I16-R01, I16-R06, and I16-R08 remain a separate under-scoring thread. No ranker change, hard-rejection change, or generalization from a single example is authorized by this record.
