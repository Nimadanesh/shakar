# Issue 16 — Capture 05F supplement 02 (internal key)

Do not expose this mapping before the human grades S01–S07 are locked.

Source: live capture run [40079121984](https://github.com/Nimadanesh/shakar/actions/runs/40079121984), artifact `12553843717`. All rows are newly selected source IDs, but remain a small bounded sample and must not be pooled as independent runs.

| Blind label | Source ad ID | Capture cell | Raw engine outcome | Human grade |
|---|---|---|---|---|
| S01 | `gaR1NLBL` | other-part | near / eligible | pending |
| S02 | `gac3G6Ob` | whole-clean | near / eligible | pending |
| S03 | `gaTvl5u2` | catalyst-service | near / eligible | pending |
| S04 | `gauW_tpf` | catalyst-only | near / eligible | pending |
| S05 | `Aaeryw6N` | other-part | near / eligible | pending |
| S06 | `gacP29Ul` | whole-buyer | near / eligible | pending |
| S07 | `gaLrFFB1` | catalyst-only | near / eligible | pending |

The selector did not find a valid `whole-with-part-mention` positive in this capture. The seventh retrieved row was `missing-cell` and has no source ID to grade. Do not infer a grade for it.

This supplement is for human relevance judgments only. The raw engine outcomes are diagnostics, not labels. Keep the earlier locked B01–B07 grades unchanged; after these grades are returned, join them by this internal key and report sample limits explicitly.
