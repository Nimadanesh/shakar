# Reconciliation — Issue 16 Fresh Paired Capture (2026-10-24)

**Prerequisite:** Owner grades were locked in `BRH-2026-10-24-ISSUE16-FRESH-PAIRED-HUMAN-GRADES.md` before this diagnostic join was created. Blind packet remains unchanged.

## Human grades joined to engine diagnostics

| Blind ID | Human grade | Engine match kind | Engine score | Interpretation |
|---|---:|---|---:|---|
| P03-01 | 3 | exact | 3.5 | Aligned; direct refrigerator seller. |
| P03-02 | 3 | exact | 3.5 | Aligned; mixed query allows both directions. |
| P03-03 | 3 | exact | 3.5 | Aligned; direct ordinary refrigerator listing. |
| P03-04 | 3 | near | 1.5 | Relevant part query; engine under-describes relevance. Do not reject as wrong-kind. |
| P03-05 | 2 | near | 0 | Relevant whole-vehicle result, but parenthetical «حواله» makes the offer ambiguous; engine score is low relative to human relevance in this one sample. |
| P03-06 | 3 | exact | 3.5 | Aligned; direct voucher listing for «حواله خودرو». |

## Readout

- Distribution: grade 3 × 5, grade 2 × 1, grade 1 × 0, grade 0 × 0, unknown × 0. Mean 2.83/3; 6/6 grade ≥2.
- Four engine `exact` / 3.5 outputs align with human grade 3. The two divergences are P03-04 and P03-05. Match kind and score are diagnostic fields, not calibrated probabilities or human grades.
- P03-04 is not a negative control: the query is explicitly «قطعه یخچال», and the engine surfaced a motor/parts ad that the owner judged exact. Keep this as a positive part-query control.
- P03-05 is a genuine calibration/ranking diagnostic, but a single selected listing is insufficient to justify a scoring rule change. Retain it as a regression candidate; obtain several paired whole-vehicle, voucher, and part/accessory controls before considering changes.
- The evidence supports keeping the query-kind fix narrow. It does not support broad kind-gate relaxation or a ranking patch. The packet is E4 human judgment on a bounded E3 capture, not an E5 old-vs-new paired comparison and not a population estimate.
- Missing refrigerator buyer, vehicle cash, installment, and exchange cells remain missing.
- PR #41 stays Draft/unmerged. No merge/deploy; `main` is untouched.
