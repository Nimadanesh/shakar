# BRH follow-up — mixed transaction cue validation protocol

Status: protocol only; no new human judgments or live listing evidence are claimed.

## Why this is the next step

BRH-2026-10-23-B contains four judgments but only two unique refrigerator listings. The current title-scoped mixed-transaction penalty fixes the observed ordering while keeping both candidates eligible. This is a useful local correction, not evidence that the cue generalizes across categories or Persian phrasing.

## Frozen behavior to preserve

- A title explicitly advertising both buying and selling (e.g. «خریدوفروش انواع یخچال») may receive a ranking penalty.
- The penalty must not hard-reject the listing.
- A buying/selling phrase found only in descriptive/editorial body text must not classify an otherwise direct offer as a mixed-transaction listing.
- Unknown transaction direction remains unknown; do not infer buyer/seller role from silence.
- Do not add broad synonyms or category-independent hard filters as part of this follow-up.

## Next blinded packet: minimum case matrix

Collect real Divar listing IDs and full title/description snapshots. Keep query and listing labels blinded to graders; preserve an internal key separately. Do not invent or paraphrase listings as if they were observed.

| Case | Query intent | Required listing pattern | What it tests |
|---|---|---|---|
| C01 | seek seller | title explicitly says «خریدوفروش» | Existing positive cue |
| C02 | seek seller | title says «خرید و فروش» with spaces | Spacing variant |
| C03 | generic product | direct product offer; body text mentions buying/selling as general shop copy | False-positive guard |
| C04 | generic product | explicit buyer/collector listing | Buyer-side role recognition |
| C05 | generic product | direct offer with barter/exchange condition | Human relevance vs transaction preference |
| C06 | seek seller | mixed catalogue whose body describes buying from owners | Directional mismatch without title cue |
| C07 | seek seller | ordinary direct seller offer, no role cue | No-cue baseline |
| C08 | seek buyer | explicit buyer-seeking listing | Mirror-direction guard |

Aim for at least 8–12 unique listings across at least two categories before changing the heuristic. Include counterexamples, not only cases expected to improve.

## Human grading and comparison

- Use the existing 0–3 relevance rubric and retain “insufficient” outside the denominator.
- Each case must be graded independently by at least two blinded reviewers where feasible.
- Record both human grade and engine rank / matchKind. Do not let a passing unit test substitute for human quality.
- Compare top-5 ordering, eligibility/recall, and critical false demotions. Report the per-query outcomes, not just an aggregate.
- Keep the current paired refrigerator replay as a regression test.

## Decision gate

Keep the current narrow rule unless new blinded evidence shows a repeatable failure. Any change that expands the cue beyond title text, changes eligibility, or introduces a category-wide rule requires a fresh test-first commit and human review. No merge to main or deployment is authorized by this protocol.
