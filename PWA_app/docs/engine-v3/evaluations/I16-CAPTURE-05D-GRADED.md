# Issue 16 — Capture 05D graded human review

Date: 2026-10-24  
Target hunt: `خرید و فروش خودرو`  
Source: bounded live capture [run 40080467492](https://github.com/Nimadanesh/shakar/actions/runs/40080467492), artifact `12554818835`. Human grades supplied by the evaluator after the blind packet was presented.

## Locked human grades

| Blind label | Human grade | Short rationale |
|---|---:|---|
| D01 | 1 | Catalyst repair/buying and replacement offer; primary item/service is catalyst, not a whole vehicle. |
| D02 | 3 | Vehicle sales dealership offering Toyota and other vehicles with installment terms. |
| D03 | 1 | Lifan spare parts inventory, not whole-vehicle sales. |
| D04 | 1 | Catalyst and oxygen-sensor trading; wrong primary item for the broad whole-vehicle hunt. |
| D05 | 3 | Direct sale of a Dena Plus vehicle. |
| D06 | 1 | New catalyst product listing, not a whole vehicle. |
| D07 | 3 | Direct installment sales of whole vehicles across brands. |
| D08 | 1 | Exhaust/catalyst sales, replacement program and scrap buying; wrong primary item. |

## Aggregate

- **8** distinct source ads graded.
- Grade sum: **14/24**; mean: **1.75/3**.
- Grade distribution: **3× grade 3**, **5× grade 1**, **0× grade 2**, **0× grade 0**, **0 unknown**.

## Human × engine comparison

The engine outcomes below come from the separate internal key and were not shown in the blind packet.

| Label | Human grade | Engine matchKind | Engine eligible | Interpretation |
|---|---:|---|---:|---|
| D01 | 1 | near | yes | Wrong-kind near miss |
| D02 | 3 | near | yes | Whole-vehicle positive admitted, but not classified exact |
| D03 | 1 | exact | yes | **Highest-priority false-positive characterization:** parts-only ad classified exact |
| D04 | 1 | near | yes | Wrong-kind near miss |
| D05 | 3 | near | yes | Whole-vehicle positive admitted, but not classified exact |
| D06 | 1 | near | yes | Wrong-kind near miss |
| D07 | 3 | near | yes | Whole-vehicle positive admitted, but not classified exact |
| D08 | 1 | rejected | no | Correctly excluded negative control |

## What this supports — and does not support

1. The sample again contains a kind-of-item error: D03 is a parts-only listing with human grade 1 but engine `exact`.
2. The three whole-vehicle positives are all admitted as `near`, showing that a broad-hunt correction must not reject whole-vehicle dealer/financing listings simply because their transaction language differs.
3. The catalyst-only control D08 is rejected, while several other catalyst listings remain eligible. That variability means this sample does **not** establish that one universal catalyst token or one simple hard gate is a safe fix.
4. These are eight bounded, deliberately selected live examples, not a random estimate of production precision. They are characterization evidence, not a paired quality comparison and not authorization to change production logic.

## Next evidence step

Use D03's exact-match false positive and the three whole-vehicle positives as explicit regression controls in a test-only characterization of transaction role versus item kind. Keep D08 as an already-rejected negative control, and retain catalyst/service and whole-vehicle buyer/dealer examples. Do not alter `HEAD_KIND` or production ranking/gating until the three-reader lexicon implications and all positive/negative controls are reviewed.
