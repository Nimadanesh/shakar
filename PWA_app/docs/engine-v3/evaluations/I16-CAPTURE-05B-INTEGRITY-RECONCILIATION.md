# Issue 16 — Capture 05B Integrity and Reconciliation

Date: 2026-10-24  
Branch: `experiment/issue16-capture04-20261024`  
Evidence level: E3 live retrieval, bounded and read-only. This is a controlled diagnostic sample, not a population estimate or an E5 paired comparison.

## Runs and artifacts

- Capture 04A/04B rerun: [run 40072403347](https://github.com/Nimadanesh/shakar/actions/runs/40072403347), success.
- Capture 05B: [run 40072417965](https://github.com/Nimadanesh/shakar/actions/runs/40072417965), success.
- 05B report artifact ID: `12551573898`, `engine-v3-issue16-capture-05b.json`.
- Target contract: fixed broad `خرید و فروش خودرو`, category `vehicles`; retrieval queries only locate controls.
- Limits: max 2 pages/query, 8 details total, 8 unique selected IDs, Mizan shadow disabled.

## Freshness check

Capture 05B selected IDs:
`gacXlFBL`, `gazms9IA`, `gacL14Hy`, `QZji3t1d`, `gaXGdt9a`, `gaM76Zea`, `QadoH4Gg`, `QaFK7cdB`.

Comparison against the concurrent Capture 04A and 04B reports:
- Selected-ID intersection with Capture 04A: **0**.
- Selected-ID intersection with Capture 04B: **0**.
- Selected IDs intersecting either Capture 04 report's `overlapWithPreviouslyInspected` set: **0**.
- The 05B report's `overlapWithPreviouslyInspected` list contains `gaXXxCBa`, which was selected in Capture 04B, and several older overlap markers. These appear in the overlap/skipped list, not among the 05B selected listings. No Capture 04 selected ID was reused as a 05B item.
- All 24 selected listing IDs across 04A, 04B, and 05B are unique.

Conclusion: **05B's eight selected items pass the cross-capture freshness check**. The reported overlap entries are not part of the 05B graded sample; retain them as diagnostics and do not grade them.

## Diagnostic observations (not human judgments)

- Whole-vehicle positives: all three were eligible (two `near`, one `exact`).
- Catalyst-only negatives: two eligible (`near`), one rejected (`no-match`).
- Catalyst/exhaust service negative: eligible (`near`).
- Other-part negative (vehicle battery offer): rejected by `kind:role:vehicle-part-not-vehicle`.

These engine outcomes are not human relevance grades. No code, ranking, or hard-rejection change is authorized by this capture alone. Wait for independent human grades, then reconcile the exact mismatches and counterexamples before deciding whether another bounded capture is needed. Keep the appliance false-rejection hypothesis separate.
