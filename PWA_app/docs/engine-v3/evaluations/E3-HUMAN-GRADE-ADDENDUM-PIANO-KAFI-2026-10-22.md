# E3 Human Grade Addendum — Piano Identity and Mixed Floor-Mat Listing

Date: 2026-10-22
Branch: `eval/full-detail-capture-20261022` (isolated evidence branch; not merged)
Status: human grades received; exact source IDs and fresh full-detail snapshots captured for P01–P06 and K01. Baseline pairing remains open.

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

- [x] Map P01–P06 to exact source ad IDs in the live-observation artifact or frozen source packet.
- [x] Verify full details for P02 and P05 supporting acoustic/mechanical identity.
- [x] Preserve exact title/detail snapshots and original retrieval ranks in the immutable workflow artifact.
- [x] Reconcile K01 to its exact source ID; do not infer identity from title alone.
- [x] Keep the human grade, engine verdict, and secondary annotations in separate fields.


## Source-ID reconciliation — bounded live artifact

Reconciled against the exact-title records in the immutable workflow artifact below (not by fuzzy title matching):

- Workflow run: [39767995345](https://github.com/Nimadanesh/shakar/actions/runs/39767995345)
- Artifact: `engine-v3-live-observation-20`, artifact ID `12421221962`
- Captured commit: `3bf9bc12df7e50bb018950e17c19c6cb08991138`
- Artifact SHA-256: `cfc30f126b887a981189f41bf4806ffbbcfa86570becd7d36aa0785f58d32e74`
- Observation created: `2026-10-22T11:08:47.568Z`
- Query: `پیانو اکوستیک` for P01–P06; `کفی ماشین` for K01.

| Packet alias | Exact source ad ID | Captured rank | Exact artifact title | Engine label in artifact | Human grade |
|---|---|---:|---|---|---:|
| P01 | `gaiCb1F-` | 6 | `تولید انحصاری پیانو طرح آکوستیک ست کامل 160 میلیون` | near | 0 |
| P02 | `gaZze3Z1` | 4 | `پیانو اکوستیک m2 یاماها` | near | 3 |
| P03 | `gaZzOCha` | 5 | `فروش پیانو آکوستیک و دیجیتال` | near | 3 |
| P04 | `gaZb-8lt` | 8 | `پیانو یاماها SLP-48 طرح آکوستیک` | near | 0 |
| P05 | `gaZnujck` | 7 | `پیانو اکوستیک ژاپنی یاماها مدل u10` | near | 3 |
| P06 | `Qa0_1GLb` | 3 | `وارد کننده مستقیم پیانو آکوستیک و دیجیتال یاماها` | exact | 3 |
| K01 | `gaZvu9P8` | 1 | `ست کف پایی و کفی صندوق ماشین تارا،بسیار تمیز ونو` | exact | 3 |

### Reconciliation limits and next gate

- All seven packet aliases now have an exact source-ID/title/rank match in the captured artifact. The artifact's engine labels are preserved separately from the human grades.
- The artifact stores only a truncated `descriptionExcerpt`, not the complete original detail payload. In particular, the captured excerpts for P02 and P05 do not themselves show the evaluator's cited acoustic/mechanical identity evidence. Their human grades remain valid as received, but the original full-detail snapshot must be located or recaptured before claiming that this artifact independently verifies that evidence.
- K01's captured excerpt explicitly describes a Taraa floor-mat set plus trunk liner, consistent with the evaluator's role/salience rationale.
- This is a source-mapping step, **not** a paired baseline-versus-current quality comparison. The artifact is an unjudged live observation; no uplift or metric claim is made.
- Next: locate the frozen full-detail records for P02/P05 and the matching baseline candidate/verdict records. If no immutable full-detail snapshot exists, mark the evidence gap rather than reconstructing details from memory. No engine behavior change, merge to `main`, deployment, or allocation change is authorized.


## Full-detail source verification — latest bounded artifact

The previous source-ID reconciliation section above records the earlier excerpt-only artifact and its limitations at that time. Those full-detail gaps are now closed for the seven packet aliases by a later, exact-ID capture.

- Workflow run: [39783668174](https://github.com/Nimadanesh/shakar/actions/runs/39783668174)
- Artifact: `engine-v3-live-observation-25`, artifact ID `12427871523`
- Captured commit: `210804e65386d527dd3b143c6dc68021636f0260`
- Artifact SHA-256: `35478f8e4fe40696ed294aebd86dadd97ec2bba624de785aadb08a21ee4d489b`
- Observation created: `2026-10-22T13:06:19.857Z`
- Limits: 5 query scenarios; max 2 list pages/query; max 8 pipeline detail checks/query; 7 additional direct source-ID detail reads; `MIZAN_SHADOW=0`.
- All seven target details were returned and marked non-stale. Full descriptions are in the workflow artifact, not copied into this repository document. The artifact's warning remains: these are unjudged live observations, not a paired quality comparison.

| Alias | Exact source ID | Detail evidence observed | Evaluation implication |
|---|---|---|---|
| P01 | `gaiCb1F-` | Description says the back is made to look acoustic (`شبیه به آکوستیک زده شده`) and says the internal device can later be replaced with Yamaha. | Supports the grade-0 acoustic-style false-positive family when read with the exact title; do not infer that the title token alone proves acoustic identity. |
| P02 | `gaZze3Z1` | Full description explicitly says `پیانو مکانیکی یاماها مدل m2`; it also says parts are original and not repaired/replaced. | Independently supports the human grade 3 identity rationale. |
| P03 | `gaZzOCha` | Full description explicitly offers `انواع پیانو آکوستیک و دیجیتال` and describes availability, advice, delivery, warranty, and payment. | Supports grade 3 under the E17 rule: mixed catalogue is not an automatic downgrade when acoustic pianos are a genuine offered product. |
| P04 | `gaZb-8lt` | Detail says `SLP-48 طرح آکوستیک یاماها`; it adds no independent mechanism/specification evidence beyond the title family. | Preserve grade 0; be explicit that the source detail itself is sparse. |
| P05 | `gaZnujck` | Full description explicitly says `پیانو مکانیکی یاماها مدل u10`; it lists height 121, condition, original parts, and accompanying stool. | Independently supports the human grade 3 identity rationale. |
| P06 | `Qa0_1GLb` | Full description separately lists digital Yamaha series (P/YDP/CLP) and acoustic Yamaha/Kawai model families (U/YU/YUS, etc.). | Supports grade 3 under the same mixed-catalogue rule as P03. |
| K01 | `gaZvu9P8` | Full description says `ست کف پایی تارا و کفی صندوق عقب`, then explains the items had been used on the seller's car. | Supports grade 3: floor mats are the core item; trunk liner accompanies them. |

### Redaction and evidence limits

- The artifact includes full descriptions for the seven exact source IDs and the bounded query's top results. Contact-number redaction covers common Iranian mobile formats (including Persian/Arabic-Indic digits and `0098` prefixes) and common fixed-line formats. A scan of the captured descriptions found no remaining matches for those patterns. This is pattern-based screening, not a guarantee that every possible contact detail is removed.
- Artifact `engine-v3-live-observation-23` used the earlier mobile-only scrubber and missed one fixed-line contact number in P06. It is superseded and must not be used for review; its 14-day artifact retention may leave it downloadable until expiry. Artifact 25 is the review copy.
- This closes the P02/P05 full-detail evidence gap. A later paired replay now compares the specific floor-mat conflict guard on fixed source-matched records; it **does not** rerun full pipeline retrieval/scoring/ranking, establish end-to-end baseline-versus-current result quality, or support a statistical uplift claim.
- No search/ranking behavior change, merge to `main`, deployment, or Mizan write is included or authorized by this documentation update.


## Paired baseline/current replay — floor-mat conflict guard

A deterministic replay now runs the same fixed records against the exact pre-ambiguity-removal baseline and the current branch. This isolates the one relevant source delta in this comparison: removal of the `"کفی مبلی"` hard-rejection cue after the human grade for that listing was marked insufficient/ambiguous.

- Workflow: [E3 Fixed-Candidate Baseline Replay #3](https://github.com/Nimadanesh/shakar/actions/runs/39788391628)
- Artifact: `e3-fixed-candidate-baseline-replay-3`, ID `12429309932`
- Artifact SHA-256: `5ab9116c52bbb1333b174e4a0a5dcd712d97f67165a79f8a4773ba57bd978746`
- Baseline source: `554686fa7d58932e0835b5b32475b4ea6dd34435`
- Current source under test: `292544d443d5ced72dbf48712752f5b23a7764b4`
- Both baseline and current replay tests passed. Same 17 records, same title/detail fixture strings, no live Divar calls, no Mizan calls or writes.

### Result

| Fixed record group | Baseline guard | Current guard | Interpretation |
|---|---|---|---|
| P01–P06 piano controls | No floor-mat conflict | No floor-mat conflict | Unchanged; this guard does not address piano identity |
| K01, E17, E19 graded floor-mat positives | No conflict | No conflict | All three remain eligible at this guard stage |
| N01, N02 graded hard negatives | Conflict flagged | Conflict flagged | Both human grade-0 examples remain suppressed by this guard |
| U01–U05 ungraded trailer/flatbed controls | Conflict flagged | Conflict flagged | Guard behavior unchanged; these records remain ungraded |
| AMB01 `gaYfZnPP`, `کفی مبلی نیسانی` (human grade: insufficient) | Conflict flagged by `کفی مبلی` | No conflict | Intended change: remove an unsupported hard rejection; **not** a claim that this ad is relevant |

### Scope and next gate

This is a paired **guard-level replay**, not a full engine replay. It does not calculate matchKind, final score/rank, recall, precision, nDCG, or live result-set overlap. It supports only the narrow conclusion that the ambiguous listing no longer triggers this hard-rejection cue while the tested positives and explicit flatbed controls retain their guard outcomes.

The human grade-2 audio-centred listing family and other mixed-role cases still need a detail-backed false-rejection audit before treating every guard cue as validated. Do not infer human grades for the ungraded controls. No search/ranking behavior was changed by this replay, and no merge to `main`, deployment, or Mizan write occurred.
