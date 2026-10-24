# Issue 16 — Next controlled role matrix (2026-10-24)

## Verified status

- On PR head `27f7dea6d1decedeb81f167ec86320104dd0b83d`, [Issue 16 kind regression run 40063098453](https://github.com/Nimadanesh/shakar/actions/runs/40063098453) passed focused kind regression, portable hunt/search tests, and typecheck.
- [Cross-category capture run 40063098439](https://github.com/Nimadanesh/shakar/actions/runs/40063098439) succeeded. Its artifact is diagnostic capture only, not a blind-grade result.
- PR #41 remains Draft/unmerged. `main=10f3c40d70748ff27d6928eaed0875e10dab1c56`; `engine_v3=a2d8f269f32c9dcf3bf01dc960e8d12b4e8e1192`. No merge/deploy.

## Why another experiment is needed

The latest human-graded packet primarily tests query-kind and cross-category relevance. Its two engine/human divergences are useful diagnostics but insufficient for a role or ranking patch. P03-05 is one ambiguous whole-vehicle result; previously inspected catalytic-converter records are diagnostic-only. Do not recycle inspected IDs into a blind packet or count workflow reruns as independent evidence.

## Predeclared matrix (controls not yet fully collected)

| Query intent | Positive control required | Negative / contrast control required | Status |
|---|---|---|---|
| `خریدوفروش خودرو` (whole vehicle, mixed direction) | Direct whole-car listing with clear buy/sell evidence | Vehicle part/accessory, e.g. catalytic converter, without a whole-car offer | Fresh source-matched pair needed |
| `خریدار خودرو تصادفی` (buyer role) | Explicit buyer listing for damaged/accident vehicle | Seller-only whole-car listing with no buying offer | Fresh pair needed; earlier diagnostic records do not count as blind evidence |
| `حواله خودرو` (voucher/transfer product) | Explicit voucher/transfer listing | Whole-car sale that mentions voucher incidentally, or a part listing | P03-06 is a human-grade 3 anchor; independent contrast needed |
| `قطعه یخچال` (explicit appliance part) | Direct motor/parts listing | Whole refrigerator listing without a parts offer | P03-04 is a human-grade 3 positive anchor; not a negative to the narrow kind fix |

This is a design checklist, not a claim these fresh controls have been collected. Reuse a historical example only if its exact query, source ID, text snapshot, and human grade are traceable in the control documents; otherwise mark it missing.

## Protocol before a role/ranking change

1. Capture a bounded, read-only set with fixed query cells and exclusions for every inspected ID. Keep existing caps, Mizan shadow off, and production-rank mutation disabled.
2. Freeze and commit the blind packet containing query and listing text only. Commit the diagnostic key separately; do not open it until owner grades are recorded in a third file.
3. Prefer same-candidate old/new comparison for a scoring/role proposal. A fresh-live snapshot alone is not an E5 paired comparison; it remains bounded E3 capture plus E4 human judgment.
4. Report per-cell grades, top-5 critical errors, and disagreements. Do not infer population uplift from a six-item convenience sample or patch a rule from one listing.
5. If fixed-candidate comparison is technically infeasible, document that limitation and keep the code experimental rather than claiming E5.

## Decision

No buyer-role, voucher semantics, whole-vehicle eligibility, catalytic-converter filtering, or ranking-score changes are authorized. Continue the narrow query-kind experiment only. Missing cells remain missing. PR #41 stays Draft; `main` and deployment remain untouched.

## Latest bounded capture and regression status — 2026-10-24

- On the PR's current tested head, [kind regression #40063359204](https://github.com/Nimadanesh/shakar/actions/runs/40063359204), [Follow-up 03 capture #40063359140](https://github.com/Nimadanesh/shakar/actions/runs/40063359140), and [cross-category capture #40063359355](https://github.com/Nimadanesh/shakar/actions/runs/40063359355) all completed successfully.
- Follow-up 03 artifact `12548536646` used 7 details / 7 unique IDs within the configured budget, but missed refrigerator-buyer, vehicle-cash, and vehicle-installment cells. Some selected records had already been graded; those were excluded from the new blind packet.
- Four fresh unique candidates are frozen in [cross-cell blind packet](BRH-2026-10-24-ISSUE16-CROSS-CELL-BLIND.md); the source/engine map is in the separate [internal key](BRH-2026-10-24-ISSUE16-CROSS-CELL-INTERNAL-KEY.md). Owner grades are pending. Do not open/join the key for a quality conclusion until grades are recorded in a separate third file.
- This packet provides bounded E3 capture only until owner grades arrive (E4); it is not E5 paired comparison. It does not fill the missing buyer/cash/installment cells or establish general ranking quality.
- PR #41 remains Draft/unmerged. No source/ranking behavior change, merge, or deployment is authorized.