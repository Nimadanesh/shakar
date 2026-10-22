# E3 Human Grade Addendum — Piano Identity and Mixed Floor-Mat Listing

Date: 2026-10-22
Branch: `engine_v3`
Status: human grades received; source-ID reconciliation still required for packet aliases P01–P06 and K01.

## Annotation rules confirmed by this review

- Judge the identity of the requested product, not superficial token overlap. A piano advertised as `طرح آکوستیک` is not an acoustic piano.
- A listing can offer both acoustic and digital pianos and still be grade 3 when acoustic pianos are genuinely offered as a target product. A general-store/catalogue caveat is an observation, not an automatic relevance downgrade.
- For automotive floor mats, assess the role and salience of the target item in the listing. A multi-item listing can remain grade 3 when floor mats are a leading/core item; do not mechanically downgrade every bundle to 2. Contrast with `Aafm5Bsf`, grade 2, where the floor mat is one component of a package led by seat covers.

## Human grades received

These packet IDs are presentation aliases, not verified Divar source IDs. Do not join them to source records by title similarity alone. Reconcile exact source IDs and frozen excerpts before including them in source-matched metrics.

| Packet ID | Exact title shown to evaluator | Human grade | Evaluator rationale / annotation |
|---|---|---:|---|
| P01 | `تولید انحصاری پیانو طرح آکوستیک ست کامل 160 میلیون` | 0 | Producer's “acoustic-style” instrument; not a real acoustic piano. Canonical false-positive family. |
| P02 | `پیانو اکوستیک m2 یاماها` | 3 | Yamaha M2; “mechanical piano” detail indicates a genuine acoustic piano. |
| P03 | `فروش پیانو آکوستیک و دیجیتال` | 3 | Genuine acoustic pianos are sold alongside digital pianos. Catalogue is mixed, but the target product is itself a main offered product. |
| P04 | `پیانو یاماها SLP-48 طرح آکوستیک` | 0 | Acoustic-style instrument, not a real acoustic piano. |
| P05 | `پیانو اکوستیک ژاپنی یاماها مدل u10` | 3 | Genuine Japanese Yamaha U10 acoustic piano. |
| P06 | `وارد کننده مستقیم پیانو آکوستیک و دیجیتال یاماها` | 3 | Genuine acoustic and digital Yamaha pianos are offered. Same mixed-catalogue annotation as P03; do not automatically downgrade either. |
| K01 | `ست کف پایی و کفی صندوق ماشین تارا،بسیار تمیز ونو` | 3 | Listing starts with floor mats / floor-footwell mats as the core item; the trunk liner is an accompanying item, not the sole target. A bundle reading could argue 2, but the evaluator distinguishes this from `Aafm5Bsf`, whose package is led by seat covers. |

## Implications for the next evaluation

1. Add P01 and P04 as grade-0 controls for the piano identity failure family, once exact source IDs and original excerpts are reconciled.
2. Preserve P02, P03, P05, and P06 as grade-3 positive controls. Mixed acoustic/digital inventory alone is not grounds for a grade-2 penalty when genuine acoustic pianos are explicitly offered.
3. Preserve K01 as grade 3. Do not use a blanket “bundle means grade 2” rule.
4. Keep relevance grade separate from condition, catalogue breadth, and product-role annotations.
5. Do not claim engine improvement from these grades alone. Run a source-ID-matched baseline-vs-current comparison against the same frozen candidates, then obtain a fresh bounded live observation and blinded review.
6. No engine behavior change, merge to `main`, deployment, or allocation change is authorized by this addendum.

## Source reconciliation checklist

- [ ] Map P01–P06 to exact source ad IDs in the live-observation artifact or frozen source packet.
- [ ] Verify full details for P02 and P05 supporting acoustic/mechanical identity.
- [ ] Preserve exact title/detail snapshots and original retrieval ranks.
- [ ] Reconcile K01 to its exact source ID; do not infer identity from title alone.
- [ ] Keep the human grade, engine verdict, and secondary annotations in separate fields.
