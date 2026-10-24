# Issue 16 — Capture 05E Fresh Subset: Human-Graded Result

Date received: 2026-10-24  
Target hunt: **خرید و فروش خودرو**, category `vehicles`  
Evidence level: **E4 — Human judged**, on a freshness-checked five-record subset of a live retrieval artifact.

## Grades

| Blind label | Human grade | Engine eligible | Engine match kind | Finding |
|---|---:|---:|---|---|
| H05E-F01 | 3 | yes | near | Buying damaged 206/vehicles is relevant to the broad buy/sell-vehicle intent. |
| H05E-F02 | 1 | yes | near | Catalyst buying/selling and replacement with warranty; not a whole vehicle. |
| H05E-F03 | 1 | yes | near | Used-catalyst buying and new/stock catalyst/exhaust selling; not a whole vehicle. |
| H05E-F04 | 1 | yes | near | L90 catalyst repair/replacement/recovery service; wrong item/service kind. |
| H05E-F05 | 1 | yes | near | Pride aftermarket bumper; vehicle part, not a whole vehicle. |

Summary: **1 grade-3, 4 grade-1; mean grade 1.4/3.** All five were eligible and labelled `near`. All four non-whole-vehicle records were admitted as near-misses.

## Interpretation

This is consistent with the Issue 16 hypothesis that whole-vehicle hunts can admit component/service listings when retrieval matches vehicle-related tokens but the typed-kind gate does not establish a whole vehicle. The false-positive family is not limited to catalysts: this subset also includes catalyst service and a bumper listing.

The whole-vehicle positive control (a damaged-vehicle buyer) graded 3, so the evidence does **not** support a blanket rule that rejects listings whose transaction role is “buyer.” Transaction role and item kind must remain separate.

## Integrity and limitations

- Only the five-record freshness-checked subset is graded; the full 05E artifact is invalid as a complete packet because two rows overlap the parallel 05D run and one planned cell was missing.
- This is a small, deliberately targeted diagnostic sample, not a population estimate and not a paired before/after comparison.
- These grades support further targeted evidence collection. They do not by themselves choose or authorize a code fix.
- No engine/ranking logic was changed from this evidence. No merge, deployment, or `main` change occurred.
- See the [internal key](./I16-CAPTURE-05E-FRESH-SUBSET-INTERNAL-KEY.md) for source IDs, retrieval queries, and raw engine scores.
