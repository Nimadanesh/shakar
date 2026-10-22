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

## Packet-integrity audit — corrected after source matching

The first packet was intended to contain five candidates from each allocation-only arm per query. Matching each displayed example to the experiment artifact shows that `کفی ماشین` was in fact balanced (5 baseline-only / 5 alternative-only in E01–E20), while `تعمیر یخچال` was not balanced in that round (4 / 6). The supplemental packet was balanced for both queries: 3 / 3 for `کفی ماشین` and 4 / 4 for `تعمیر یخچال`.

Some displayed titles/descriptions were shortened or paraphrased, so arm joins must use the unique matching source record and description—not displayed wording alone. The source-matched combined samples are summarized below. This corrects the initial audit interpretation; the raw grades remain unchanged.


## Supplemental grades (E21–E34), received 2026-10-22

| Blind ID | Query | Human grade |
|---|---|---:|
| E21 | تعمیر یخچال | 3 |
| E22 | تعمیر یخچال | 3 |
| E23 | کفی ماشین | 0 |
| E24 | تعمیر یخچال | 3 |
| E25 | تعمیر یخچال | 3 |
| E26 | تعمیر یخچال | 3 |
| E27 | کفی ماشین | 0 |
| E28 | کفی ماشین | 0 |
| E29 | تعمیر یخچال | 3 |
| E30 | تعمیر یخچال | 3 |
| E31 | کفی ماشین | 0 |
| E32 | کفی ماشین | 0 |
| E33 | کفی ماشین | 0 |
| E34 | تعمیر یخچال | 2 |

No supplemental grades were marked unknown/insufficient.

Evaluator note: the intent of `کفی ماشین` is automotive floor mats. All six `کفی ماشین` examples in this supplemental packet are irrelevant (0): three trailer/flatbed listings and three trailer-related listings/services, including the repeated Maral flatbed. No actual automotive floor mat appears in this supplemental sample. E34 is a mixed-services ad that includes refrigerator service but also many unrelated services; it received 2 (relevant), not exact.

## Corrected packet audit and provisional arm-level summary

After matching the displayed examples to the report's exact candidate records/descriptions:
- First packet E01–E20: `کفی ماشین` was balanced 5 baseline-only / 5 alternative-only; `تعمیر یخچال` was 4 baseline-only / 6 alternative-only.
- Supplemental packet E21–E34: `کفی ماشین` was balanced 3 baseline-only / 3 alternative-only; `تعمیر یخچال` was balanced 4 baseline-only / 4 alternative-only.
- Across both rounds, the sampled `کفی ماشین` disagreement candidates total 8 baseline-only and 8 alternative-only. Each arm has one exact floor-mat match (E17 in baseline-only; E19 in alternative-only) and seven irrelevant candidates: observed exact rate 1/8 (12.5%) for each arm. This is a small diagnostic sample, not a population estimate.
- Across both rounds, all 8 sampled baseline-only refrigerator-service candidates were exact; among 10 sampled alternative-only refrigerator-service candidates, 9 were exact and E34 was relevant (grade 2). All 10 alternative-only candidates were at least relevant. Because the arms are not the same size and the packet includes a mixed-services grade, do not claim statistical superiority from this small sample.
- The earlier packet-integrity caveat should be narrowed: the samples are source-matchable from titles/descriptions and are balanced for `کفی ماشین`; the first refrigerator round was not balanced (4 vs 6), but the combined refrigerator sample is still 8 baseline-only / 10 alternative-only. Some displayed titles were shortened/paraphrased, so arm joins must rely on unique matching source records, not displayed wording alone.

## Decision

**Do not promote the 80/20 allocation.** In this live diagnostic sample, the alternative arm has no demonstrated human-quality advantage: sampled disagreement candidates for `کفی ماشین` yield the same 1/8 exact rate for both arms, refrigerator candidates are relevant in both arms, and prior top-20 outputs were identical. Keep current production allocation unchanged. The stronger actionable finding is query understanding for `کفی ماشین`: disambiguate automotive floor mats from trailer flatbeds and trailer-related services before ranking. Any fix should be narrow and paired-tested with both positive floor-mat controls and hard trailer/flatbed negatives.
