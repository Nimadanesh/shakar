# BRH Live Observation — Run 109 — 2026-10-23

## Execution
- Run: [#109](https://github.com/Nimadanesh/shakar/actions/runs/39936557919)
- Artifact: `engine-v3-live-observation-109` (artifact ID `12492949434`)
- Source commit: `f7baa1aa3e4290529e1bbe98d72a555a2f309eae`
- Branch: `engine_v3`
- Observation timestamp: 2026-10-23 10:05:56 UTC
- Status: successful read-only observation; artifact downloaded and inspected.

## Bounded collection
- Query: `معاوضه سمند بیرنگ`
- Four list pages requested and completed for this scenario; 97 ads observed, 97 candidates after filters, no duplicates collapsed, no stale flag.
- Detail budget remains two for this scenario; two details checked. The selection method prioritized explicit paint-related title cues; eight candidate titles matched the cue, including the two inspected.
- Mizan shadow remained disabled (`0`). Slug capture buffered 2, wrote 0, failed 0.
- The broader run's overall cap remains 8 details across four primary scenarios; this scenario-specific page increase did not raise the detail budget.

## Blind cases
- S04: `فروش سمند ۹۵ ای اف سون بیرنگ.معاوضه دارم`, Hamedan, price 1,380,000,000. Description: `ماشین بسیار تمیز مرتب کم کار بدونه رنگ یه سواری سبک قیمت باشه برمیدارم`. The title and description jointly provide an explicit no-paint phrase and an exchange offer for the Samand itself. This is a candidate positive target-side attribute control; human grade is pending.
- S03 remains the separate unknown-evidence case from [Run 106](https://github.com/Nimadanesh/shakar/actions/runs/39935969832): a Samand is offered in exchange for another vehicle, but the description's `بدون نقطه` does not establish paint condition. Human grade is pending.
- A second inspected listing has a no-paint Samand title but lacks exchange evidence; it is useful as an item-attribute-only control, not a complete exchange match, and is not included as an exchange-grade case.

## Interpretation guardrails
- Treat S03 and S04 as ungraded until the blind review is returned.
- Do not infer direction from one phrase alone. Evaluate the complete offered/requested relation.
- Attribute ownership matters: evidence must belong to the target vehicle, not merely occur in the listing text.
- Do not generalize from this small targeted sample or integrate evidence-state logic into ranking yet.
- No production ranking change, main merge, or deployment is authorized.
