# Issue 16 — Retargeted Capture 03 Human Grades

Date locked: 2026-10-24
Packet: BRH-2026-10-24-ISSUE16-RETARGETED-CAPTURE-03-BLIND.md
Source: owner-locked blind judgments. This file is separate from the internal diagnostic key.

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

## Aggregate

- 12 scored listings; grade sum 32/36.
- Ten grade-3 listings and two grade-1 listings; no grade-0, grade-2, or unknown grades.
- Human grades are relevance ground truth. Engine eligibility, match kind, and score remain separate diagnostic fields.

## Rationale retained for the principal discrepancies

- **I16-R05 = 3:** the listing seeks to buy used refrigerators as part of buying/selling used refrigerators. It is relevant to the broad «خرید و فروش یخچال» hunt despite the engine's appliance-not-home-goods rejection.
- **I16-R03 = 1** and **I16-R12 = 1:** both are catalytic-converter listings, not whole vehicles. They are independent ads supporting one wrong-item-type failure hypothesis, not two different failure types.
- **I16-R01 = 3, I16-R06 = 3, I16-R08 = 3:** engine labeled these near despite strong human relevance. This is a separate under-scoring signal.
- For the remaining items, this file preserves the locked numeric judgments without inventing extra rationale beyond the available source record.

## Interpretation boundary

The packet raises two separate primary hypotheses: (1) false eligibility rejection of a relevant used-refrigerator buyer/seller listing; (2) retention of catalyst/part listings for a whole-car hunt. The grade-3 near cases are a third, separate under-scoring signal. No ranking or hard-eligibility rule should change until each primary pattern repeats across independent, previously unseen listings and preregistered positive/negative controls remain healthy.
