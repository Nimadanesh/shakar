# Issue 16 — Fresh Cross-Cell Reconciliation (2026-10-24)

## Inputs and order of operations

- Blind packet: [BRH-2026-10-24-ISSUE16-CROSS-CELL-BLIND.md](BRH-2026-10-24-ISSUE16-CROSS-CELL-BLIND.md), committed before the diagnostic key.
- Locked owner grades: [BRH-2026-10-24-ISSUE16-CROSS-CELL-HUMAN-GRADES.md](BRH-2026-10-24-ISSUE16-CROSS-CELL-HUMAN-GRADES.md), commit `0e48e4941e166d104bc72d25f0c8ed456676513f).
- Diagnostic join: [BRH-2026-10-24-ISSUE16-CROSS-CELL-INTERNAL-KEY.md](BRH-2026-10-24-ISSUE16-CROSS-CELL-INTERNAL-KEY.md). This reconciliation was created only after the human-grade file was committed.

## Per-item comparison

| Blind ID | Query | Human grade | Engine kind / score | Interpretation |
|---|---|---:|---|---|
| F16-01 | حواله خودرو | 3 | exact / 3.5 | Aligned; direct vehicle voucher listing. |
| F16-02 | معاوضه خودرو | 3 | near / 1.5 | Relevant positive control under-described by engine verdict; the ad explicitly offers a Samand in exchange for a Pars or Pride. |
| F16-03 | یخچال | 3 | exact / 3.5 | Aligned; direct refrigerator/freezer product listing. |
| F16-04 | فروشنده یخچال | 3 | exact / 3.5 | Aligned; owner sells their own refrigerator, correct direction. |

## Summary

- 4/4 human grades are 3; mean = 3.00/3. No unknown or negative examples in this convenience packet.
- Coarse exact-vs-not-exact agreement: 3/4. F16-02 is the only disagreement: the human judged it a strong relevant exchange result while the engine classified it as near with score 1.5.
- Engine score/kind is diagnostic output, not a calibrated probability or replacement for the human grade.
- This is E4 human judgment over bounded E3 live retrieval, not E5 fixed-candidate old/new comparison and not a population precision estimate.
- This packet is positive-heavy by construction and cannot estimate false-positive rate, transaction-role error rate, or general search quality.
- F16-02 merits a follow-up hypothesis about exchange-intent recognition/scoring, but one item is not enough to change a rule. Seek fresh positive and negative controls and, where feasible, run old/new against the same fixed candidates.
- Buyer-fridge, vehicle-cash, and vehicle-installment cells remain missing. No buyer-role, voucher semantics, kind-gate, exchange scoring, or ranking change is authorized.
- PR #41 remains Draft/unmerged. `main` and `engine_v3` remain untouched; no deployment.
