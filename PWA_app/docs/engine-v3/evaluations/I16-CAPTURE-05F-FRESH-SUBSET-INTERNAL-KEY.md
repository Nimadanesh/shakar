# Issue 16 — Capture 05F Fresh Subset (Internal Key)

Target: **خرید و فروش خودرو**, category `vehicles`.  
Artifact: [Capture 05F raw artifact](https://github.com/Nimadanesh/shakar/actions/runs/40075265983), artifact `engine-v3-issue16-capture-05f`.

Only the seven rows included in `I16-CAPTURE-05F-FRESH-SUBSET-BLIND.md` were human-graded. Source `gapYR7Ug` was excluded because it overlapped concurrent Capture 04B.

| Blind label | Source listing ID | Retrieval query | Original cell | Engine eligible | Match kind | Score | Human grade |
|---|---|---|---|---:|---|---:|---:|
| H05F-B01 | `gaLrFFB1` | خریدار کاتالیزور فرسوده | catalyst-only | yes | near | 2.1667 | 1 |
| H05F-B02 | `gaxhZ6ej` | خریدار خودرو تصادفی | whole-buyer | yes | near | 0.8333 | 3 |
| H05F-B03 | `gaX1UoCy` | فروش سپر پراید | other-part | yes | near | 1.5000 | 1 |
| H05F-B04 | `gaA-wN8t` | فروش دنا پلاس | whole-clean retrieval control | yes | near | 2.8333 | 1 |
| H05F-B05 | `gaAfArzm` | تعمیر کاتالیزور خودرو | catalyst-service | yes | near | 0.8333 | 1 |
| H05F-B06 | `gaZ3F3Mv` | فروش پراید با لاستیک نو | whole-with-part-mention retrieval control | no | rejected | — | 1 |
| H05F-B07 | `gaupvO5B` | فروش موتور خودرو | other-part retrieval control | yes | near | 2.5000 | 3 |

## Integrity

- Source IDs and text snapshots are joined to the raw artifact from run `40075265983`, commit `5cfeff0e8ea70936839e674306566963b006eaf2`.
- The blind labels map to the exact snapshots in the blind packet; the labels do not imply the actual item kind. In particular, the retrieval control named `whole-clean` returned a body-parts inventory (B04), and the `engine-part` retrieval returned a whole-vehicle dealer ad (B07). Human grading remains against the fixed broad target, not the retrieval query.
- The duplicate 05F invocation was not treated as independent evidence. The overlapping row `gapYR7Ug` was excluded.
- Raw diagnostics are not themselves relevance grades. The human grades are recorded in the companion `I16-CAPTURE-05F-FRESH-SUBSET-GRADED.md`.
