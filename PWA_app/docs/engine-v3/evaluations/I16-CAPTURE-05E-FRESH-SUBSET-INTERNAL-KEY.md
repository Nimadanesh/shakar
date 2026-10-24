# Issue 16 — Capture 05E Fresh Subset (Internal Key)

Target: **خرید و فروش خودرو**, category `vehicles`.

Only the five blind records in `I16-CAPTURE-05E-FRESH-SUBSET-BLIND.md` passed the freshness check. The other two selected listings in the raw 05E artifact were excluded because they overlapped the parallel 05D run. The full artifact must not be described as independently fresh.

| Blind label | Source listing ID | Retrieval query | Original cell | Engine eligible | Match kind | Score |
|---|---|---|---|---:|---|---:|
| H05E-F01 | `gaT3FZE5` | خرید و فروش خودرو کارکرده | whole-vehicle-positive | yes | near | -6.1667 |
| H05E-F02 | `QZhvyaLi` | فروش کاتالیزور با ضمانت | catalyst-only-negative | yes | near | 2.1667 |
| H05E-F03 | `gaT_9Tmj` | خریدار کاتالیزور فرسوده | catalyst-only-negative | yes | near | -2.5000 |
| H05E-F04 | `gac7VDBQ` | کاتالیزور خودرو | catalyst-only-negative | yes | near | 0.5000 |
| H05E-F05 | `QanNEG_8` | فروش لوازم یدکی خودرو | other-part-negative | yes | near | 0.8333 |

## Integrity check

- Source IDs were compared against selected IDs and `overlapWithPreviouslyInspected` lists from all downloaded 04A/04B/05B/05C/05D artifacts, including the parallel runs on the same PR merge commit.
- The five IDs above were absent from every other artifact's selected-ID set and overlap list.
- The two excluded 05E rows were `gaE35qnd` and `Qa53P1Rc`; both were also selected by the parallel 05D run.
- This is a five-item valid subset, not a full eight-item packet. One planned whole-car cell was missing in retrieval, and the full 05E run remains invalid as a whole.
- Raw diagnostics only; no human grades are inferred from engine output.
