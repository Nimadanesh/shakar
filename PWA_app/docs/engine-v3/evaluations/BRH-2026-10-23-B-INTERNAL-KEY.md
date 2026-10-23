# Internal Mapping — BRH-2026-10-23-B

**Do not provide this file to the evaluator before grades are returned.** Record grades in a separate report; never edit the blinded packet after grading begins.

Source workflow: bounded read-only observation, 2026-10-23  
Source artifact: `engine-v3-role-regression-observation.json`  
Observed code SHA: `a65b7d3cfe055cf0c868080de033bbb9a3a6bf9f` (the role-control artifact is a bounded observation; verify the exact artifact metadata before using this SHA as the artifact's own code SHA).

| Blind ID | Query | Source ad ID | Exact title | Engine observation | Evaluation question |
|---|---|---|---|---|---|
| B01 | `فروشنده یخچال` | `gaT3a_qu` | خریدوفروش انواع یخچال سالم موتورسوخته پوسیده | rank 1, `exact`; role unknown | Does the title/description express selling, buying, or both? |
| B02 | `فروشنده یخچال` | `gabbQJUc` | فروش یخچال | rank 2, `near`, demoted by cap; listing role `exchange` | Does the exchange wording undermine seller intent despite the title? |
| B03 | `یخچال` | `gabbQJUc` | فروش یخچال | rank 2, `near`, listing role `exchange` | Is this still relevant under an ordinary refrigerator query? |
| B04 | `یخچال` | `gaT3a_qu` | خریدوفروش انواع یخچال سالم موتورسوخته پوسیده | rank 1, `exact`; role unknown | Is the listing relevant to an ordinary refrigerator query despite mixed transaction wording? |

## Integrity and interpretation

- This packet reuses two exact source listings across two queries to create a paired intent contrast. Repeated source listings are intentional, not four independent ads.
- The observed engine output was the same two listings in the same order for both queries, despite resolver `roleMode: seek-seller` for `فروشنده یخچال` and `roleMode: none` for `یخچال`. This is a concern to investigate, not proof that the implementation is wrong; the human grades determine whether the examples truly expose a user-facing defect.
- This is a four-judgment, two-listing diagnostic sample. Do not calculate population precision/recall or claim general role-discrimination performance.
- Keep the frozen `BRH-2026-10-23-A` packet and its internal key unchanged.
