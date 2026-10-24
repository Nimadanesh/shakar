# Issue 16 — Capture 05B Human/Engine Reconciliation

Date: 2026-10-24  
Evidence: E3 bounded live retrieval + independent human grades. Not a population estimate and not a paired E5 comparison.

## Human grades vs engine outcomes

| Blind ID | Human | Engine | Match / rejection diagnostic | Reconciliation |
|---|---:|---|---|---|
| H05B-01 | 3 | eligible | near | Positive retrieved; engine labels it near rather than exact. |
| H05B-02 | 3 | eligible | exact | Positive retrieved and labeled exact. |
| H05B-03 | 3 | eligible | near | Positive retrieved; engine labels it near rather than exact. |
| H05B-04 | 1 | eligible | near | False-positive witness: parts listing for exhaust/catalysts survives whole-vehicle hunt. |
| H05B-05 | 1 | eligible | near | False-positive witness: buying/selling catalysts and replacements survives whole-vehicle hunt. |
| H05B-06 | 1 | rejected | no-match | Excluded from results; no-match rather than kind gate. Consistent with keeping a weak adjacent item out of the final result set. |
| H05B-07 | 1 | eligible | near | False-positive witness: repair/service listing survives whole-vehicle hunt. |
| H05B-08 | 1 | rejected | kind:role:vehicle-part-not-vehicle | Other-part control rejected by the existing typed-kind gate. |

## Findings

- All 3 whole-vehicle positives were eligible; 1 was `exact`, 2 were `near`. No positive false negative in this bounded sample.
- 3 of 5 grade-1 adjacent items were still eligible. They are concrete false-positive witnesses for the broad whole-vehicle hunt: H05B-04, H05B-05, H05B-07.
- The other two grade-1 items were rejected. H05B-08 shows the current kind/role gate can reject at least one typed vehicle-part title. H05B-06 was rejected by no-match, not by the kind gate.
- The pattern is consistent with the earlier code audit: catalytic-converter-headed titles may evade the kind gate because `کاتالیزور` is not mapped as a vehicle-part head. This remains a hypothesis supported by bounded examples, not proof that adding a lexicon entry alone is safe.

## Decision

**No implementation or merge is authorized by these grades alone.** Do not add a global hard rejection or a broad title ban. Next evidence gate: run a fresh, bounded capture with all IDs selected in Capture 04A, Capture 04B, and Capture 05B excluded. Use the fixed broad whole-vehicle target, at least 3 whole-vehicle positives including a title/body counterexample where parts are mentioned secondarily, at least 3 catalyst/part/service negatives, and additional controls for other already-typed parts. Keep appliance false-rejection evidence separate. Blind packet must be frozen before grades; internal key must remain separate.
