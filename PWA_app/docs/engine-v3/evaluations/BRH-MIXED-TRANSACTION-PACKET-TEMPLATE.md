# BRH mixed-transaction follow-up — blank collection worksheet

Status: blank template only. This file contains no observed listings, IDs, or human grades.

## Collection rules
- Collect 8–12 unique real Divar listings across at least two categories.
- Preserve exact source title and description snapshots, source listing ID, capture timestamp, and query used.
- Keep the internal source key separate from the blinded packet shown to graders.
- Do not use search snippets as a substitute for the full available description.
- Grade relevance 0–3; record “insufficient” separately and exclude it from the denominator.
- Prefer two independent blinded graders per case.
- Never treat unjudged live observations as quality evidence.

## Blinded packet (copy one block per observed listing)

| Field | Value |
|---|---|
| Blind case ID | C__ |
| Query shown to grader | [fill from actual case] |
| Listing title (verbatim) | [paste observed title] |
| Description (verbatim snapshot) | [paste observed description] |
| Price / location | [observed value or UNKNOWN] |
| Human grade — reviewer 1 | [0 / 1 / 2 / 3 / insufficient] |
| Human grade — reviewer 2 | [0 / 1 / 2 / 3 / insufficient] |
| Human rationale | [short explanation] |

Do not include engine rank, matchKind, internal source ID, or expected case type in the blinded packet.

## Internal key (store separately; do not show graders)

| Blind case ID | Source listing ID | Captured at | Category | Case pattern | Query intent | Engine rank | matchKind | Eligible? | Notes |
|---|---|---|---|---|---|---:|---|---|---|
| C__ | [actual ID] | [ISO timestamp] | [actual category] | [C01–C08] | [seek-seller / generic / seek-buyer] | [rank] | [value] | [yes/no] | [evidence] |

## Required case coverage

- [ ] C01 — seek seller; title explicitly says «خریدوفروش»
- [ ] C02 — seek seller; title says «خرید و فروش» with spaces
- [ ] C03 — generic product; direct offer, body-only shop-copy mentions buying/selling
- [ ] C04 — generic product; explicit buyer/collector
- [ ] C05 — generic product; direct offer with barter/exchange condition
- [ ] C06 — seek seller; mixed catalogue, body describes buying from owners but title has no mixed cue
- [ ] C07 — seek seller; ordinary direct seller offer without role cue
- [ ] C08 — seek buyer; explicit buyer-seeking listing

## Per-query comparison after grading

| Query / case | Human grades (non-insufficient) | Engine rank | matchKind | Top-5 ordering | Eligibility / recall | Critical false demotion? |
|---|---|---:|---|---|---|---|
| [fill after collection] | [fill after grading] | [rank] | [value] | [describe] | [eligible / excluded] | [yes/no + why] |

## Decision gate
Do not expand the title cue, change candidate eligibility, or introduce category-wide rules based on this packet unless the blinded evidence demonstrates a repeatable pattern. Keep the existing paired refrigerator replay as a regression. No merge to main or deployment is authorized by this worksheet.
