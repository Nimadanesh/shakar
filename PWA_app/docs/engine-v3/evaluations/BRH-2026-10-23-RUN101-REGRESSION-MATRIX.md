# BRH Run 101 — Human-grade-to-regression matrix

Date: 2026-10-23  
Status: **test design only**. This document translates the locked human judgments in `BRH-2026-10-23-RUN101-HUMAN-GRADES.md` into regression obligations. It does not claim that implementation tests exist or pass.

## Safety boundary

- Keep this work on `engine_v3`; no merge to `main`, deployment, or live-service mutation is authorized.
- Do not convert nine diagnostic examples into broad lexical rules or global precision claims.
- Where feasible, assert observable outcomes (eligibility, role, rank/order, and match kind) rather than internal implementation details.
- Use counterfactual controls before implementing any rule. The human grade is a target judgment, not a license to hard-code a single listing ID.
- Preserve unknown as unknown: missing evidence of repair is not evidence that no repair occurred.

## Regression obligations

| ID | Evidence | Test obligation | Expected behavior | Guard / counterexample |
|---|---|---|---|---|
| R101-01 | P01, grade 2: «درحد نو»، clean, low-use | Separate appearance/use adjectives from repair-history evidence | Listing remains relevant but unverified for “not repaired/replaced”; do not mark condition constraint as proven | A listing explicitly saying repaired/replaced must not pass the no-repair constraint just because it says “like new” |
| R101-02 | P03, grade 3: «بدون تغییر ... دستکاری»; technician inspection offered | Distinguish explicit untouched/no-tampering evidence from service/inspection | Explicit no-change/no-tampering can support original/untouched condition; service/inspection alone is not replacement evidence | Do not treat every occurrence of «سرویس»، «کارشناس» or «تعمیرکار» as proof of replacement—or as proof of no replacement |
| R101-03 | P02, grade 0: piano cabinet/box | Distinguish requested core product from accessory | Cabinet/accessory must not be treated as a piano listing merely because title includes piano | Keep actual piano listings eligible; avoid broad rejection of all listings containing «کابین» if they also offer the core product |
| R101-04 | P04, grade 0: repair service | Distinguish service intent from product-for-sale intent | A pure piano-repair service is not a piano listing for sale | A seller listing that mentions maintenance history remains a product offer |
| R101-05 | P05, grade 0: title says repair; body says advertiser buys instruments | Resolve title/body conflict using explicit transaction direction | Explicit body-level “we buy” evidence must not be overridden by a title keyword when query seeks a seller | A repair shop that actually offers a piano for sale should not be misclassified as buyer-only solely due to service vocabulary |
| R101-06 | P06, grade 3: trailer offered for requested three-axle flatbed | Model exchange direction from the searcher's perspective | Requested counterparty item can satisfy the query even when it is not the offered item | Do not assume the first item in «معاوضه با ...» is always the wanted item; parse both sides |
| R101-07 | P07, grade 2: flatbed offered for three-axle tanker | Bind attributes to the correct exchange side | “Three axle” describing the requested tanker does not prove the offered flatbed is three-axle | Same attribute on the offered item should satisfy the constraint; attribute on the other side should not |
| R101-08 | P08, grade 1: mixed refrigerator title; body indicates buying from owners | Use body evidence to resolve ambiguous mixed title | For seek-seller query, a mixed title with body evidence of buyer/collector direction should rank weakly below clear seller offers, not be promoted as a confirmed seller | Mixed title alone should not cause hard rejection; retain eligibility unless independent hard constraints fail |
| R101-09 | P09, grade 1: body explicitly says “we buy” | Recognize buyer-only role in a seek-seller query | Wrong transaction direction is weak relevance (grade 1 under this rubric), not automatically irrelevant (0) | Mirror-direction query seeking a buyer should treat the same role as relevant |
| R101-10 | Overall packet | Keep uncertainty and role distinct from product identity | Unknown transaction direction stays unknown; do not infer seller role from silence | Ordinary direct seller offer with no explicit role cue is a no-cue baseline |

## Minimal counterfactual suite before implementation

Use real captured examples where available; otherwise mark synthetic cases clearly as synthetic test fixtures, never as observed Divar evidence.

1. **Condition/history (R101-01/02):** “low use, very clean” only; explicit “never repaired/replaced”; explicit “repaired once”; technician inspection only; explicit no-tampering plus service mention. Assert the evidence does not collapse into one Boolean based on generic keywords.
2. **Product/service/accessory (R101-03/04):** piano for sale; piano cabinet only; piano repair service only; piano for sale with a sentence mentioning repair service availability. Assert core-item and transaction intent together.
3. **Role conflict (R101-05/08/09):** title contains «تعمیر» but body says “we buy”; title contains «خریدوفروش» but body says buying from owners; title says “for sale” and body is direct seller evidence; buyer-only listing under both seek-seller and seek-buyer queries.
4. **Exchange parsing (R101-06/07):** wanted item on requested side; wanted item on offered side; required attribute only on the requested item; same attribute on the offered item. Assert item identity and attributes remain attached to their side.

## Acceptance criteria for the test-design review

- Each assertion names the query intent and the evidence supporting it.
- At least one false-positive control accompanies each proposed positive cue.
- No test treats silence as proof of a negative condition.
- No test confuses relevance grade with eligibility: weakly relevant candidates may remain eligible.
- Exchange cases identify offered item, requested item, and each item's attributes separately.
- Tests use stable fixtures and avoid live Divar dependence in ordinary CI.
- Human-evaluated packet remains the source of judgment; synthetic counterfactuals test boundaries only and do not add human-grade evidence.

## Recommended next step

Review these obligations against the existing query understanding, role assessment, hard filters, and ranking paths. Then implement **tests first**, in a focused commit, only where current behavior is demonstrably wrong. Run focused regressions plus the existing portable suite. Do not broaden the mixed-transaction heuristic as a shortcut for the distinct problems above.
