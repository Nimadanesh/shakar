# Issue 16 Capture 06A — Source Map and Reconciliation

This file is the post-grade join key for the blind packet. Human grades remain independently recorded in [ISSUE16-CAPTURE-06A-HUMAN-GRADES.md](ISSUE16-CAPTURE-06A-HUMAN-GRADES.md); engine fields below are diagnostics only.

- **Query:** `کاتالیزور خودرو`
- **Original live report:** [workflow run #10](https://github.com/Nimadanesh/shakar/actions/runs/40096410639), artifact ID `12560808508`, file `engine-v3-issue16-capture-06a.json`
- **Report created:** `2026-10-24T13:02:40.011Z`
- **Artifact branch/commit fields:** branch `43/merge`, commit `37c2b9adf0c0d893fc7f64b2905d656ef7f1987a` (GitHub PR merge ref); PR head at capture `9d4297c590e0c6e90d263b506ebc7a5c262862cb`.
- **Capture limits:** four retrieval queries, max 2 list pages per query, max 8 detail reads total; actual details used 4, unique listing IDs 4, body-only candidates 4, 9 overlapping previously inspected IDs excluded; Mizan shadow disabled.

## Blind code → source report record

| Blind code | Source ad ID | Original report title | Retrieval query | Human grade | Engine diagnostic in source report |
|---|---|---|---|---:|---|
| C01 | `gaPT4jAd` | لنت برلیانس،سنسور اکسیژن بنز،پمپgdi،استارت سانتافه | `کاتالیزور لنت ترمز` | 2 | eligible=true; matchKind=near; score=1; evidence=`کاتالیزور`; missingInfo=`خودرو` |
| C02 | `gaVv-2zg` | دیسک صحفه فابریکی ساینا | `کاتالیزور دیسک ترمز` | 1 | eligible=false; matchKind=rejected; rejectedKind=`no-match` |
| C03 | `gaODFbLY` | موتور و گیربکس هایلوکس فورچونر ۶ سیلندر | `کاتالیزور گیربکس` | 2 | eligible=false; matchKind=rejected; rejectedKind=`no-match` |
| C04 | `gaTnu9bU` | موتور کامل بادروچین ان فیو تیوفایو | `کاتالیزور گیربکس` | 2 | eligible=false; matchKind=rejected; rejectedKind=`no-match` |

## Join-integrity audit

- All four blind codes map one-to-one to the four listing records in the original run #10 artifact by exact title and body excerpt.
- The IDs above are taken from the original report's `listings[].sourceAdId`, not inferred from title search or a later live query.
- All four source records have `bodyOnlyCandidate=true`, `targetTermInBody=true`, `targetTermInTitle=false`, and `descriptionSnapshotAvailable=true`.
- No source ID was reused within this four-item packet. The report itself excluded nine IDs previously inspected by earlier captures.
- Human grade and engine diagnostics are intentionally separate. C03 and C04 are human grade 2 despite engine rejection; retain these as **candidate false-rejection signals for follow-up**, not as proof of a general defect or permission for a code change. C02's grade 1 is consistent with weak/tangential relevance despite rejection. C01's grade 2 is separate from its engine `near` label.

## Interpretation and limits

The four human grades are 1, 2, 2, 2 (mean 1.75/3; no insufficient grades). Three ads were judged relevant but incomplete, and one weak/tangential. Because this is a small, bounded, non-random retrieval sample with no paired baseline, it supports targeted investigation of the rejected-but-human-relevant C03/C04 examples only. It does **not** establish population precision, rank-order quality, or overall uplift.

No production behavior, ranking, eligibility, `HEAD_KIND`, `main`, merge, or deployment change is authorized by this reconciliation.
