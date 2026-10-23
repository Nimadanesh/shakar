# BRH Mixed-Transaction Gap Capture — Results

Date: 2026-10-23
Evidence level: E3 — bounded live Divar retrieval; not human-graded.
Workflow run: [39974457063](https://github.com/Nimadanesh/shakar/actions/runs/39974457063)
Artifact: `engine-v3-mixed-transaction-gap-capture` (artifact ID `12510678292`)
Capture commit: `1a31314961da34f257f6a0fba5c6ef64ffcc0d30` (PR merge ref `28/merge`)
Artifact created: `2026-10-23T15:07:28.744Z`

## Integrity and limits

- Workflow job completed successfully; the raw JSON artifact was downloaded and inspected.
- Read-only live capture; `MIZAN_SHADOW=0`.
- Three fixed home-category scenarios; max two list pages per query.
- Six unique listing IDs; six detail reads used of six allowed; two detail reads per scenario.
- Full description snapshots are present for all six selected listings.
- Every selected listing has `productionRank: null`. These are diagnostic selections and engine labels, not observed production top-N ranks.
- The artifact itself explicitly says it is raw internal evidence, not a blinded packet, not human grades, and not a production top-N comparison.

## Matrix cell 1 — Compact title spelling: `خریدوفروش یخچال`

**Status: TARGET FOUND; usable as a candidate for a blinded review.**

- Query: `خریدوفروش یخچال`; task intent: `seek-seller`; target pattern: `mixed-compact`.
- Target listing: `gawtZCCr`, title: «خریدوفروش همه رقم یخچال سالم وخراب درمحل», Hamadan, listed price 8,000,000.
- Full description is available: «باسلام یخچال های سالم و سوخته شمارو بالاترین قیمت خریداری میکنم تماس از شما حضور به موقع از ما بازید رایگان تسویه نقدی».
- Capture marks `targetPatternHit: true`, `matchKind: near`, `classificationNeedsHumanReview: true`.
- Interpretation: the compact spelling is confirmed in a real title and the body clearly describes buying refrigerators from the ad reader. It is relevant to inspect for the seller-seeking task, but the engine's `near` label is not a human grade.
- Second inspected listing `ga013DCY` uses spaced «خرید و فروش» and is not a hit for the compact target pattern.

## Matrix cell 2 — Clean barter/exchange-condition example

**Status: TARGET NOT FOUND; gap remains.**

- Query: `یخچال`; task intent: `generic-product`; target pattern: `barter`.
- The two inspected details were a direct-sale refrigerator (`gabf3EHN`) and a buyer-seeking broken-refrigerator listing (`gaNc5fRN`). Neither is a clean barter/exchange-condition example.
- Full descriptions are available for both inspected listings, but no target-pattern hit was selected.
- Do not infer that no barter ads exist on Divar: this bounded capture covered at most two pages and two detail reads for this scenario.

## Matrix cell 3 — Explicit buyer-seeking refrigerator control

**Status: TARGET NOT FOUND; gap remains.**

- Query: `خریدار یخچال`; task intent: `seek-buyer`; target pattern: `buyer-seeking`.
- The two inspected listings were a direct seller in Tehran (`gaRnPAOv` and a shop-clearance direct seller in Urmia (`gaz9jWR3`. Neither is an explicit buyer-seeking refrigerator ad.
- Full descriptions are available for both inspected listings, but no target-pattern hit was selected.
- The first result mentions accepting an old refrigerator as a trade-in; that alone does not make it a clean buyer-seeking control for this target.
- This is a bounded retrieval miss, not proof that a suitable control does not exist.

## Packet and decision

The run supplies **one confirmed target-pattern candidate out of three cells**. It does **not** supply enough target evidence for a complete, balanced blinded packet that covers all three gaps. Preserve the two empty cells as gaps; do not relax the page/detail budgets or repeat capture indefinitely. The compact-title candidate may be retained for a clearly labeled partial diagnostic review, but must not be presented as filling the barter or buyer-control cells.

No human grades were produced, no causal effect of the mixed-title or role penalties can be inferred, and no ranking/eligibility policy change is justified. Keep current behavior and the gate connecting evidence logic to ranking unchanged until appropriate real samples receive human grades.


## Human grade received — compact mixed-title seller task

Grade received from the independent human evaluator on 2026-10-23:

- Candidate ID: `gawtZCCr`
- Task: refrigerator seller-seeking (user wants to buy from a seller)
- Human grade: **1 — weak relevance**
- Evidence shown to evaluator: exact captured title, listed price/city, and full description as reproduced in Matrix cell 1 above.
- This is a human relevance judgment for this one candidate, not a grade for the engine's `near` label and not a causal test of the mixed-title penalty.
- The grade is appended to the record; the original capture artifact remains immutable. Do not overwrite or reinterpret the raw E3 capture.
- The clean barter/exchange cell and explicit buyer-seeking control remain unfilled. No ranking/eligibility change is authorized by this single grade.
