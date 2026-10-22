# E3-DETAIL-ALLOCATION-01 — Internal Join and Human Comparison

Status: joined after receipt of blind grades on 2026-10-22.
Query: «ماشین بدون رنگ».
Source experiment: [GitHub Actions run #1](https://github.com/Nimadanesh/shakar/actions/runs/39683008360), source commit `8aedd5ef03b096c5a19b0e9932c44ee3ccb08362`.
Human-grade source: [blind grades](./E3-DETAIL-ALLOCATION-01-human-grades.md).

## Blind-ID join

The join below is the internal mapping revealed only after human grading. Numeric grades come from the independent evaluator; internal verdicts are the engine's labels and must not be treated as ground truth.

| Blind ID | Internal ad / distinguishing detail | Baseline rank | Alternative rank | Engine verdict | Human grade |
|---|---|---:|---:|---|---:|
| H01 | «سیستم ماشین بهترین برند» | 3 | 5 | near | 0 |
| H02 | «دنا پلاس ۶ دنده EF7P مشکی متالیک آبنوس ۱۴۰۴»; description says «بی‌رنگ» | — | 2 | exact | 3 |
| H03 | «هدلایت برای ماشین پژو سمند» | 9 | — | near | 0 |
| H04 | «تیبا ۲ مدل ۹۶»; description says «ماشین بی‌رنگ» | — | 3 | exact | 3 |
| H05 | «ماشین شاهین صفر کیلومتر» | 5 | 7 | near | 3 |
| H06 | «فروش ماشین» / پارس تندر; a small paint/bodywork mark | 10 | — | near | 2 |
| H07 | «ماشین» / «ماشین خانگی میباشد» | 2 | 4 | near | نامشخص |
| H08 | «ماشین آریسان ۲» | 8 | 10 | near | 3 |
| H09 | پلاک اروندی مدل ۲۰۱۷; stock trunk lid, small paint/bodywork mark, «ماشین بی‌رنگ» | 1 | 1 | exact | 2 |
| H10 | «فروش ماشین پراید مدل ۸۳» | 6 | 8 | near | نامشخص |
| H11 | «ماشین سالم و کم‌کار»; description mentions paint on hood and part of a rim | 4 | 6 | near | 0 |
| H12 | «امداد باطری / باتری ماشین / شبانه‌روزی / سراسر اهواز» | 7 | 9 | near; kind-demoted | 0 |

«—» means absent from that arm's top 10, not necessarily absent from its 100-candidate allocation.

## Paired human metrics — Top 5

The user rubric is 0–3 plus insufficient. Insufficient entries are excluded from graded denominators, never imputed. For nDCG, gain is (2^{rel}-1); the actual rank positions are retained when an insufficient entry is skipped from the gain sum. IDCG is computed from the numeric grades available in that arm's top five.

| Measure | Baseline | Alternative |
|---|---:|---:|
| Top-5 numeric grades available | 4/5 | 4/5 |
| Relevant (grade ≥ 2) among numeric grades | 2/4 (50%) | 3/4 (75%) |
| Grade-0 results in Top 5 | 2 | 1 |
| nDCG@5 on available grades | 0.642 | 0.845 |

Delta: nDCG@5 +0.203; graded relevance rate +25 percentage points; one fewer grade-0 result in the visible top five. These are paired results on one query and a small, overlapping candidate pool, not a population estimate.

## What the join reveals

1. **The exploration arm did discover two human-confirmed exact matches.** H02 and H04 were not in the baseline top 10, were selected from title ranks 128 and 138, and appeared at Alternative ranks 2 and 3. Both received human grade 3.
2. **The alternative improved this query's human top-five ordering, not merely engine counters.** It brought H02/H04 forward; H05 (human grade 3) fell from rank 5 to rank 7, but the top-five net still improved on the available human labels.
3. **Engine exact/near labels are imperfect proxies.** H09 was called exact by the engine but received human grade 2; H05 and H08 were called near but received human grade 3. This is direct evidence not to use engine verdict counts as the acceptance metric.
4. **H09 has two dimensions.** Human grade 2 indicates relevant but not a clean exact match to «بدون رنگ». The evaluator's note also flags possible dealer opportunity value due to the stock trunk lid and small bodywork mark. Do not collapse opportunity value into constraint satisfaction.
5. **No evidence yet justifies a global rollout.** The experiment supports a feature-flagged prototype and a second blinded live comparison on different query families; it does not establish generality, acceptable latency, or safe behavior across inventory types.

## Decision and next step

Decision: **advance to a feature-flagged, read-only experiment only; do not change production defaults or deploy.** The next live paired test is scoped to two distinct query families: «کفی ماشین» (item vs accessory) and «تعمیر یخچال» (service vs goods). Each query compares the same 100-candidate baseline against top 80 + 20 evenly spaced candidates from ranks 101–200, using a shared 120-detail union. The report must be human-graded before deciding whether to implement a production allocation flag.

Integrity: this record does not edit or rerun frozen Phase 1/R1/R2 captures, pins, grades, mappings, or denominators.
