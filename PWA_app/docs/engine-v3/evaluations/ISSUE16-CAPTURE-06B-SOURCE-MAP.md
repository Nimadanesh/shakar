# Issue 16 Capture 06B — Source Map and Reconciliation

This is the post-grade join for the immutable blind packet. The independent human grade is preserved separately in [ISSUE16-CAPTURE-06B-HUMAN-GRADES.md](ISSUE16-CAPTURE-06B-HUMAN-GRADES.md). The blind packet remains unchanged; engine fields are diagnostic only.

- **Target query:** `کاتالیزور خودرو`
- **Original live report:** [workflow run #1](https://github.com/Nimadanesh/shakar/actions/runs/40098538799), artifact ID `12562225909`, file `engine-v3-issue16-capture-06b.json`
- **Artifact SHA-256:** `bf99179d9301b206adb0b520592dca34f7ea87a8994e127bb7dbd763a88c1829`
- **Artifact branch / commit:** `experiment/issue16-specific-part-body-20261024` / `137512d920adbcce2885ee6f634eb61981c91344`
- **Capture limits:** four retrieval queries, max two list pages/query, max eight detail reads total; actual details used 4, unique IDs 4, 11 previously inspected IDs excluded, Mizan Shadow disabled.
- **Human grade:** B01 = 1; human note: none. This was locked before source mapping.

## Blind code → original report record

| Blind code | Source ad ID | Original report title | Retrieval query | Human grade | Engine diagnostic in original report |
|---|---|---|---|---:|---|
| B01 | `gaPD6_BG` | سپر و سنسور اکسیژن و هدرز تیوفایو207 | `کاتالیزور سنسور اکسیژن` | 1 | eligible=true; matchKind=near; score=1; evidence=`کاتالیزور`; missingInfo=`خودرو`; rejectedKind=null |

## Join-integrity audit

- The blind packet contained one item, B01, and did not contain the source ID or engine diagnostics. The post-grade mapping matches B01 to the exact `listings[].sourceAdId` record in the original immutable Capture 06B artifact.
- Original report fields confirm `targetTermInBody=true`, `targetTermInTitle=false`, `bodyOnlyCandidate=true`, and `descriptionSnapshotAvailable=true`.
- The engine diagnostic is `eligible=true`, `matchKind=near`, `score=1`, `rejectedKind=null`. These values remain separate from the human grade.
- The ad title focuses on bumper, oxygen sensor, and header. The catalytic-converter mention appears in a parenthetical repair-history explanation (“اشتباه مکانیک به جای کاتالیزور سنسور عوض کردم”), not as a clearly offered catalytic converter. The owner independently graded relevance 1 and provided no note. This is consistent with a **source-backed, human-graded false-acceptance example for this specific target**, but only one targeted case has been observed.
- Do not generalize this single item into a population error rate or use it alone to justify a broad marker, parser, ranking, or eligibility change. Seek a paired control set, including genuine direct offers of the hunted part and other-part/body-context negatives, before evaluating any production change.

## Interpretation and limits

This is E4 human judgment over one bounded, non-random live candidate, not E5 paired comparative evidence, not a population precision estimate, and not proof of overall search-quality uplift. Preserve the human grade as 1 even though the engine returned eligible/near. No production behavior, ranking, eligibility, `HEAD_KIND`, `main`, merge, or deployment change is authorized.
