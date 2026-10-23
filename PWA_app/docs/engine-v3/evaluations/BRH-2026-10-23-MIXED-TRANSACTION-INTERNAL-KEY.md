# BRH mixed-transaction capture 01 — internal key

Status: reveal only after the 12 human grades have been locked.
Source artifact: engine-v3-mixed-transaction-packet-capture
Workflow: [39970882822](https://github.com/Nimadanesh/shakar/actions/runs/39970882822)
Capture commit: e4aba4d8d30213ba44f47fcd893bc05889e4942d

sampleRank is a position in the sampled candidate pool, not production rank. productionRank is null for all records. Engine score, matchKind, eligibility, and suggested case labels are diagnostic metadata, not human grades.

| Blind ID | Task | Source ad ID | Category | Original query | Title pattern | Suggested case | Eligible | Sample rank | Match kind | Score | Rejected kind |
|---|---|---|---|---|---|---|---:|---:|---|---:|---|
| R04 | A | QaK_0q44 | home | فروشنده یخچال | mixed-spaced | C02 candidate | true | 2 | near | -3.5 | — |
| R07 | A | gaUbcnuf | home | فروشنده یخچال | direct-seller | C07 candidate | true | 1 | exact | 3.5 | — |
| R05 | B | gab72vf2 | home | یخچال | direct-seller | C03/C06 candidate — manual review required | true | 1 | exact | 3.5 | — |
| R10 | B | gaHfbQs9 | home | یخچال | buyer-seeking | C04/C08 candidate — query intent decides | true | 2 | exact | -0.5 | — |
| R12 | C | gab7ma8G | home | خریدار یخچال | direct-seller | unclassified — manual review required | true | 1 | near | -0.5 | — |
| R08 | C | gaHJo2YL | home | خریدار یخچال | other | unclassified — manual review required | false | — | rejected | — | part:offering:"رادیاتور" |
| R03 | D | gabbEP5H | music | فروشنده پیانو | mixed-spaced | C02 candidate | true | 1 | near | 0.5 | — |
| R01 | D | gamqZPQ8 | music | فروشنده پیانو | direct-seller | C07 candidate | false | — | rejected | — | training:offering:"آموزش" |
| R09 | E | wZHWN6mH | music | پیانو | direct-seller | C03/C06 candidate — manual review required | true | 2 | near | 3.5 | — |
| R02 | E | gaYWPdfV | music | پیانو | buyer-seeking | C04/C08 candidate — query intent decides | true | 1 | exact | 3.5 | — |
| R06 | F | gaoy3Rl- | music | خریدار پیانو | buyer-seeking | C04/C08 candidate — query intent decides | true | 1 | exact | 3.5 | — |
| R11 | F | gabH0VJr | music | خریدار پیانو | direct-seller | unclassified — manual review required | true | 2 | near | -0.5 | — |

## Coverage

- 12 unique source listings across six tasks and two categories (home, music).
- Four pages per query maximum; 12/12 detail reads used; MIZAN_SHADOW=0.
- All 12 full description snapshots were available.
- No compact “خریدوفروش” title; no clean barter/exchange-condition example.
- The selected seller-piano direct-seller-pattern sample is a training offer and was rejected; the selected buyer-refrigerator sample is a multi-item scrap-buying offer, not a clean category-specific buyer control.
