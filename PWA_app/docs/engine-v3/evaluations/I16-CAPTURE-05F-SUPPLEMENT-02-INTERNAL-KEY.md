# Issue 16 — Capture 05F supplement 02 (internal key)

Human grades S01–S07 are now locked and joined to the raw capture.

Source: live capture run [40079121984](https://github.com/Nimadanesh/shakar/actions/runs/40079121984), artifact `12553843717`. These are seven newly selected source IDs from one bounded capture; do not pool them as independent runs.

| Blind label | Source ad ID | Capture cell | Raw engine outcome | Human grade |
|---|---|---|---|---:|
| S01 | `gaR1NLBL` | other-part | near / eligible | 1 |
| S02 | `gac3G6Ob` | whole-clean | near / eligible | 3 |
| S03 | `gaTvl5u2` | catalyst-service | near / eligible | 1 |
| S04 | `gauW_tpf` | catalyst-only | near / eligible | 1 |
| S05 | `Aaeryw6N` | other-part | near / eligible | 1 |
| S06 | `gacP29Ul` | whole-buyer | near / eligible | 3 |
| S07 | `gaLrFFB1` | catalyst-only | near / eligible | 1 |

## Locked score summary

- Grades: 1, 3, 1, 1, 1, 3, 1.
- Total: 11/21; mean: 1.57/3.
- Grade 3: 2/7; grade 1: 5/7; no grade 0, 2, or unknown.
- All seven rows were engine-eligible as `near`. Thus all five grade-1 adjacent/wrong-primary-item rows were admitted, while both whole-vehicle positives remained eligible.
- The selector did not find a valid `whole-with-part-mention` positive in this capture. A seventh retrieved `missing-cell` row had no source ID and was not graded.

This remains a small bounded sample. Raw engine outcomes are diagnostics, not human labels. Keep the earlier locked B01–B07 grades unchanged.

**Deduplication note:** S07 (`gaLrFFB1`) is the same source ad as H05F-B01; it is a repeat, not a seventh distinct fresh example.