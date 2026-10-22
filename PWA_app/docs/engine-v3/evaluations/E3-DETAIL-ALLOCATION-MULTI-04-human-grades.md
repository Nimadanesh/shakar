# E3 Detail Allocation Multi-04 — Human Grades

Date: 2026-10-22
Branch: `engine_v3`
Experiment report commit: `a1233202cb20918ac012bfd0ec3c916f16fe0506`
Artifact: `engine-v3-detail-allocation-multi-4`, workflow run [39740034802](https://github.com/Nimadanesh/shakar/actions/runs/39740034802)

## Raw grades as submitted

| Blind ID | Query | Human grade |
|---|---|---:|
| E01 | تعمیر یخچال | 3 |
| E02 | تعمیر یخچال | 3 |
| E03 | تعمیر یخچال | 3 |
| E04 | کفی ماشین | 0 |
| E05 | کفی ماشین | 0 |
| E06 | تعمیر یخچال | 3 |
| E07 | کفی ماشین | 0 |
| E08 | تعمیر یخچال | 3 |
| E09 | تعمیر یخچال | 3 |
| E10 | تعمیر یخچال | 3 |
| E11 | کفی ماشین | 0 |
| E12 | تعمیر یخچال | 3 |
| E13 | کفی ماشین | 0 |
| E14 | کفی ماشین | 0 |
| E15 | کفی ماشین | 0 |
| E16 | تعمیر یخچال | 3 |
| E17 | کفی ماشین | 3 |
| E18 | تعمیر یخچال | 3 |
| E19 | کفی ماشین | 3 |
| E20 | کفی ماشین | 0 |

No grades were marked unknown/insufficient.

## Human interpretation

The evaluator explicitly defined the intent for `کفی ماشین` as **automotive floor mats**, not truck/trailer flatbeds. E17 (`لاستیک و کف پوش ماشین`) and E19 (`کفی سه بعدی نمدی فابریکی اطلس`) are exact matches (3). E04, E05, E07, E11, E13, E14, E15, and E20 are irrelevant (0): trailer flatbeds, trailer rental, or a vehicle sold with a flatbed/bar. In particular, E14 (`آریسان ۲ با کفی و باربند`) is 0 for this intent; a previous illustrative score of 2 would have been incorrect.

For `تعمیر یخچال`, all 10 presented candidates were graded exact (3).

## Important packet-integrity limitation

The presented 20-item packet was described as five samples from each allocation-only arm per query. A post-grade audit against the actual report does **not** support that claim: the visible titles map unevenly across `baselineOnly` and `alternativeOnly`, and at least some displayed titles/descriptions were abbreviated or paraphrased. Therefore, these grades are valid human judgments about the presented ads and strongly demonstrate the query-intent ambiguity for `کفی ماشین`, but **must not be used as a balanced paired-arm estimate or as a go/no-go result for the 80/20 allocation**. Do not retroactively infer arm-level precision from this packet.

## Next action

Prepare a corrected, source-matched, blinded balanced packet from the artifact: five `baselineOnly` and five `alternativeOnly` candidates for each query, preserving exact titles and source description excerpts. Reuse prior grades only where the candidate ID and exact source record are unambiguous; ask for fresh grades for missing slots. Keep the arm mapping concealed until all needed grades are collected. No production allocation change is approved by this evaluation.
