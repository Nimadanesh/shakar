# Issue 16 — Retargeted Capture 04 Reconciliation

Capture: https://github.com/Nimadanesh/shakar/actions/runs/40070942322
Locked owner grades: [I16-RETARGETED-CAPTURE-04-HUMAN-GRADES.md](I16-RETARGETED-CAPTURE-04-HUMAN-GRADES.md). The blind packet and internal key remain separate.

## Join

| Blind ID | Source ID | Human grade | Eligible | Match kind | Finding |
|---|---|---:|---|---|---|
| C04-01 | gaXXxCBa | 1 | yes | near | Catalyst-only; not a whole car |
| C04-02 | gacHF7dN | 3 | yes | near | Refrigerator positive retained |
| C04-03 | AaDSxXZ8 | 1 | yes | near | Refrigerator motor/compressor, not appliance |
| C04-04 | gaQzayLB | 3 | yes | near | Whole-car positive retained |
| C04-05 | gaMVLohg | 3 | yes | near | Refrigerator buyer positive retained |
| C04-06 | gaK92UdI | 1 | yes | near | Catalyst purchase retained for whole-car hunt |
| C04-07 | gacLFEvk | 0 | no | rejected | Unrelated negative correctly rejected |
| C04-08 | gaKeKHIz | 1 | yes | near | Catalyst repair/service retained for whole-car hunt |
| C04-09 | gacz0OBI | 3 | yes | near | Refrigerator seller positive retained |
| C04-10 | gaY_7zyW | 1 | yes | near | Motorcycle parts bundle retained for whole-car hunt |
| C04-11 | gaOSC1Mb | 3 | yes | near | Refrigerator buyer positive retained despite low diagnostic score |
| C04-12 | wYL_5mWC | 3 | yes | near | Mixed buy/sell refrigerator positive retained |
| C04-13 | gaJaj2PY | 1 | yes | exact | Catalyst-only ad classified exact |

## Findings

### Appliance boundary
Five positive controls received grade 3 and were all eligible. The component-only negative C04-03 was also eligible; unrelated negative C04-07 was rejected. This supports a narrow component-versus-whole-appliance concern, but does not reproduce the earlier buyer-positive false rejection: C04-05 and C04-11 were both eligible. No broad category change is supported.

### Whole car versus catalyst/parts/service
All five part/service negatives (C04-01, C04-06, C04-08, C04-10, C04-13) received human grade 1 yet remained eligible. C04-13 is the clearest witness: a catalyst-only listing classified exact. The repeated pattern strengthens the item-type eligibility hypothesis but does not by itself authorize a code change.

## Limits and next step

This is bounded E4 human judgment, not an E5 paired comparison or population precision estimate. One whole-vehicle control cell was missing and remains missing. Earlier flawed runs and previously inspected IDs remain excluded. Do not merge PR #42 or change ranking/eligibility from this report alone. Next, inspect existing item-type signals and the preregistered matrix; if incomplete, collect unseen IDs with valid whole-car positives, catalyst-only negatives, and ambiguous controls. Keep appliance and whole-car hypotheses separate. main remains untouched.
