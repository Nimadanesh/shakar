# BRH mixed-transaction capture 01 — post-grading handoff

Date: 2026-10-23
Source workflow: [39970882822](https://github.com/Nimadanesh/shakar/actions/runs/39970882822)
Human grades: [locked owner grades](./BRH-2026-10-23-MIXED-TRANSACTION-HUMAN-GRADES.md)
Internal key: [source mapping and diagnostic fields](./BRH-2026-10-23-MIXED-TRANSACTION-INTERNAL-KEY.md)

## Locked outcome

All 12 blind items received a numeric grade:
- Grade 3: 4
- Grade 2: 4
- Grade 1: 2
- Grade 0: 2
- Insufficient: 0
- Sum: 22/36; mean 1.83/3.

Per-task totals (two judgments per task): seller refrigerator A 4/6; generic refrigerator B 5/6; buyer refrigerator C 2/6; seller piano D 3/6; generic piano E 5/6; buyer piano F 3/6.

## What the evidence says

- Seller refrigerator: mixed title but body only supports buying = 1; direct cash seller = 3.
- Generic refrigerator: mixed title/body-only-buying = 2; direct seller = 3.
- Buyer refrigerator: direct seller is opposite direction = 0; multi-item scrap buyer of broken goods = 2.
- Seller piano: mixed buy/sell/appraisal service without a specific piano = 2; education-led listing where piano sale is a minor list item = 1.
- Generic piano: piano-focused shop = 3; buyer-only offer = 2.
- Buyer piano: body-explicit cash buyer = 3; direct seller = 0.

This reinforces that product relevance, listing focus, and transaction direction must remain separate. It does not justify a general mixed-title penalty or hard rejection.

## Measurement boundary

The raw capture has no production ranks (productionRank is null); sampleRank is only a sample-pool position. These grades cannot establish production ranking lift, precision@5, nDCG@5, or causal impact of the current penalty.

## Next bounded task

Capture only the remaining decision-relevant cells:
1. a real compact “خریدوفروش” title;
2. a clean barter/exchange-condition listing;
3. a clean explicit buyer-seeking refrigerator control.

Keep read/detail budgets bounded and Mizan shadow disabled. Preserve the existing title-scoped cue and candidate eligibility. Blind any newly captured listings before requesting grades. No ranker change, main merge, or deployment until the new evidence is reviewed.
