# Evaluation Protocol — Engine V3

## Purpose

Determine whether a change makes a professional user's hunt results genuinely better. No single metric or green test suite is sufficient.

## Evidence levels

Always label evidence with one of these levels:
- **E0 — Reasoning only:** hypothesis or code-review concern, not tested.
- **E1 — Automated fixture:** unit/regression tests with controlled inputs.
- **E2 — Local integration:** actual application path exercised, but no live Divar retrieval.
- **E3 — Live retrieval:** real Divar path executed with query, timestamp, and retrieval limitations recorded.
- **E4 — Human judged:** user or blinded evaluator graded actual output.
- **E5 — Paired comparative evidence:** old and new candidates evaluated on the same fixed scenarios with grades joined to the correct version.

Never imply an E0–E2 result is E3–E5.

## Core measures

Track where feasible:
- Precision@5: fraction of top five judged results that are genuinely relevant.
- nDCG@5: graded relevance with higher ranks weighted more.
- Critical error rate: wrong entity/kind, wrong transaction role, or confirmed violation of a user red line in prominent results.
- False-rejection rate: relevant ads incorrectly rejected by filters or semantic rules.
- Candidate coverage: relevant ads discovered before final ranking, measured only against a defined pool/corpus.
- Unknown-evidence rate: share of displayed results whose critical properties cannot be verified.
- Retrieval completeness/staleness, latency, failure rate, and detail-call budget.
- Per-scenario metrics; averages must not conceal a catastrophic category regression.

Use the existing grading rubric when comparing with prior evaluation. Do not silently change grade definitions or denominators. If grade 0–3 plus INSUFFICIENT is in use, preserve the rule that INSUFFICIENT is excluded from the graded denominator and reported separately.

## Required query families

The fixed suite should include, where applicable:
- item vs part/accessory (e.g. «کفی ماشین» vs «ماشین»);
- precise model/variant vs lookalike (e.g. «پیانو اکوستیک» vs «پیانوی طرح اکوستیک»);
- service vs goods (e.g. «تعمیر یخچال»);
- explicit absence/negation (e.g. «ماشین بدون رنگ»);
- transaction role/direction (buyer-seeking vs seller-seeking);
- city and price constraints;
- incomplete or contradictory ad descriptions;
- typo, alternate spellings, Persian morphology, and synonymous seller wording.

Do not use only hand-picked easy queries. Include cases that are likely to fool the engine.

## Human judge protocol

The human evaluator should:
1. run the exact requested query/scenario in the specified version;
2. inspect the same top-K window for every candidate;
3. grade based on actual usefulness and constraint correctness, not on the model's explanation;
4. flag severe errors and explain the minimum necessary reason;
5. avoid steering the implementation toward a proposed fix.

The technical agent should ask for the smallest feedback that changes a decision. Do not burden the user with debugging or implementation choices.

Where possible, hide candidate/version identity from the evaluator and randomize order. Never fabricate blind conditions if the product cannot support them.

## Experiment record template

For every meaningful experiment, record:
- experiment ID and hypothesis;
- baseline SHA and candidate SHA;
- changed files and intended mechanism;
- fixed queries/scenarios;
- exact commands and runtime environment;
- results, including failures and missing cells;
- human grades and join/mapping integrity;
- metrics before/after and uncertainty/limitations;
- regressions and rollback decision;
- next action.

## Anti-gaming rules

- Freeze query sets and rubrics before a comparison.
- Do not alter test cases after seeing results without versioning the suite.
- Do not change denominator rules to improve metrics.
- Preserve both positive and negative evidence.
- Report no-run, timeout, quota exhaustion, and partial retrieval honestly.
- A single excellent query is not proof of general improvement.


## E3 observation — Samand exchange paint contradiction, 8-page replay (2026-10-23)

- **Experiment:** `BRH-SAMAND-EXCHANGE-8P-01`; source SHA `a61658cba82621b0dbae3b263fcd8ae9b0bb2b59`; live run [#116](https://github.com/Nimadanesh/shakar/actions/runs/39943428579).
- **Query:** `معاوضه سمند رنگ دارد`. Retrieval completed 8/8 pages and saw 186 ads. The diagnostic selector found 32 Samand+exchange title candidates but zero titles carrying all three cues (Samand + exchange + paint). Only two detail calls were allocated to this scenario; global budget used was 8/8.
- **Inspected candidate `ga4iPfzH`:** title `معاوضه با خودرو رنگ سفید(سمند یا sd یا پرشیا)`. Full excerpt describes a motorcycle with one rear fender painted and a hood replaced, then says exchange only for white Samand/206SD/Pars. The paint/replacement evidence belongs to the offered motorcycle, not the requested counterparty. This is an opposite-side trap, not evidence that the Samand contradicts the requested condition.
- **Inspected candidate `galu34HS`:** title `زانتیا ۲۰۰۰ معاوضه با سمند و پژو`; details mention Xantia engine/chassis, not Samand paint. This is unknown evidence.
- **Interpretation:** E3 bounded retrieval only; not E4 human-graded and not E5 paired comparison. The 32 candidates and engine `confirmed/nearMiss` counts are not human relevance labels. No ranker change is justified.
- **Validation:** baseline run [#145](https://github.com/Nimadanesh/shakar/actions/runs/39943428525) passed focused tests, full portable suite, typecheck, and build; ESLint failed only on known unrelated UI errors (8 errors, 37 warnings).
- **Next:** stop increasing pages blindly. Construct a small, source-grounded, blinded review packet for transaction direction and target-side attribute ownership, or wait for a naturally occurring clean case. Do not use synthetic counterfactuals as live evidence.

## PR #25 — conjoined mixed-title detector validation (2026-10-23)

- Merge SHA `f32561fe4cbc1733b8b89feaf023d07a1317ea39`.
- Baseline [run 39968450657](https://github.com/Nimadanesh/shakar/actions/runs/39968450657): focused hunt/search tests PASS; full portable suite PASS; TypeScript typecheck PASS; production build PASS; ESLint FAIL (8 existing UI errors, 37 warnings).
- Live role observation [run 39968450800](https://github.com/Nimadanesh/shakar/actions/runs/39968450800): workflow PASS, max 8 pages/query, 4 details total, `MIZAN_SHADOW=0). The historical paired target IDs were not found in either query's result pool. This is a successful bounded capture, not live confirmation of the specific cue or a human-quality comparison.
- Replacement-history follow-up [run 39968450511](https://github.com/Nimadanesh/shakar/actions/runs/39968450511): bounded workflow PASS, but no explicit replacement-of-component control was captured.
- No human grades or mappings changed. The next evaluation step is a frozen, source-grounded mixed-transaction cue matrix; do not infer ranking improvement from CI success or from unjudged live engine labels.


## E4 — supplemental mixed-role gap-capture grades (2026-10-23)

- Capture: [run 40006314727](https://github.com/Nimadanesh/shakar/actions/runs/40006314727), artifact ID `12523753208`; four-item blind packet [BRH-2026-10-23-GAP-CAPTURE-131-BLIND.md](evaluations/BRH-2026-10-23-GAP-CAPTURE-131-BLIND.md).
- Locked owner grades: X01=1, X02=1, X03=1, X04=1. Rationales and post-grade join: [BRH-2026-10-23-GAP-CAPTURE-131-HUMAN-GRADES.md](evaluations/BRH-2026-10-23-GAP-CAPTURE-131-HUMAN-GRADES.md); source IDs remain in the separate mapping.
- Denominator: 4; grade 1 = 4/4 (100%); no INSUFFICIENT items. Every item was weak/tangential or wrong transaction direction for its exact query.
- This is E4 human judgment over a non-random supplemental retrieval sample, not E5 paired comparison, not a population precision estimate, and not evidence of ranking uplift. The barter target was absent from the bounded capture, so the existing human-graded sale/exchange control remains the positive control for that matrix cell.
- Decision: no new regex, broad buyer cue, hard rejection, or ranking change from these four items. PR #28 remains draft/unmerged; `main` and deployment untouched.


## E4 — Issue 16 Capture 06A: specific-part body-only candidates (2026-10-24)

- Live capture [run #10](https://github.com/Nimadanesh/shakar/actions/runs/40096410639), artifact ID `12560808508`; query `کاتالیزور خودرو`, four source-backed body-only candidates, bounded to two list pages per retrieval query and four detail reads total.
- Locked human grades: C01=2, C02=1, C03=2, C04=2; no note; denominator 4, no insufficient grades, mean 1.75/3. Human judgments are preserved separately from engine labels in [the human-grade record](evaluations/ISSUE16-CAPTURE-06A-HUMAN-GRADES.md); exact source IDs and original engine fields are joined in [the source map](evaluations/ISSUE16-CAPTURE-06A-SOURCE-MAP.md).
- Source join integrity passed: all four blind codes map one-to-one to exact `listings[].sourceAdId` records in the original artifact. Engine rejected C03 (`gaODFbLY`) and C04 (`gaTnu9bU`) even though the human judged both grade 2. Preserve these as targeted false-rejection signals for follow-up; do not overwrite the human grades or generalize from this small sample.
- Evidence is E4 over a bounded, non-random live sample, not E5 paired comparison and not a population precision estimate. No production source/ranking/eligibility/`HEAD_KIND` change, merge to `main`, or deployment is authorized.


## E4 — Issue 16 Capture 06B: specific-part body-only candidate (2026-10-24)

- Live bounded capture [run #1](https://github.com/Nimadanesh/shakar/actions/runs/40098538799), artifact ID `12562225909`, completed successfully. Retrieval used a distinct query family: `کاتالیزور اگزوز`, `کاتالیزور موتور خودرو`, `کاتالیزور سنسور اکسیژن`, and `کاتالیزور منیفولد`; max two pages/query, max eight details, Mizan Shadow disabled.
- Four detail reads were used; 11 IDs encountered in retrieval were already inspected and excluded from selection. One fresh candidate met the strict body-only selection gate and is preserved as blind item B01 in [the blind packet](evaluations/ISSUE16-CAPTURE-06B-BLIND.md). The other three selected detail records did not meet the target-in-body / target-not-in-title condition.
- B01 was independently graded **1** by the owner (weak/tangential relevance); human note: none. Denominator **1**, no UNKNOWN grades, mean **1.00/3**. The locked grade is recorded separately in [ISSUE16-CAPTURE-06B-HUMAN-GRADES.md](evaluations/ISSUE16-CAPTURE-06B-HUMAN-GRADES.md); post-grade source mapping and engine reconciliation are in [ISSUE16-CAPTURE-06B-SOURCE-MAP.md](evaluations/ISSUE16-CAPTURE-06B-SOURCE-MAP.md).
- Post-grade join integrity passed: B01 maps to source ID `gaPD6_BG`; original engine diagnostic was `eligible=true`, `matchKind=near`, `score=1`, `rejectedKind=null`. The target term appears in the description but not the title. The human grade remains 1 and is not replaced by the engine label.
- Interpretation: one source-backed, human-graded false-acceptance example for this specific query is now observed. This is E4 on a targeted, non-random single-item sample, not E5 paired evidence, a population precision estimate, or proof of general behavior. Use it to motivate a narrow paired follow-up with true direct-offer positives and other-part/body-context negatives; do not implement a broad marker/parser/ranking/eligibility change from this single case.
- The blind packet remains immutable. No production change, merge, deployment, or `main` change.


## E4 — Issue 16 Capture 06C: locked paired-follow-up grades (2026-10-24)

- Preregistered protocol: [ISSUE16-CAPTURE-06C-PROTOCOL.md](evaluations/ISSUE16-CAPTURE-06C-PROTOCOL.md); immutable bounded capture [run #1](https://github.com/Nimadanesh/shakar/actions/runs/40100799513), artifact ID `12563205197`, SHA-256 `c321b97cfefce573c6956b15e52c451e34915d1749e8c2a8541a681dcd82d198`.
- The owner supplied and locked grades C01=1, C02=1, C03=3, C04=3, C05=1; no note and no UNKNOWN. Denominator 5; grade 1 = 3/5, grade 3 = 2/5; mean **1.80/3**. Full grade record: [ISSUE16-CAPTURE-06C-HUMAN-GRADES.md](evaluations/ISSUE16-CAPTURE-06C-HUMAN-GRADES.md).
- Post-grade join integrity passed: all five blind codes map one-to-one to exact records in the original artifact. Source IDs and original engine fields are kept separately in [ISSUE16-CAPTURE-06C-SOURCE-MAP.md](evaluations/ISSUE16-CAPTURE-06C-SOURCE-MAP.md).
- Four title-term candidate controls were not guaranteed positives: only C03 and C04 received human grade 3; C01 and C02 received grade 1. Body-only C05 received grade 1 although engine marked it eligible/near (score 1.0), because the body mentions a catalytic-converter test as a service and does not establish the converter itself as offered. This is one source-backed false-acceptance example in this bounded scenario.
- Evidence is E4 over a small, targeted, non-random sample—not E5 paired old-vs-new evidence, not a population precision estimate, and not a general false-acceptance rate. Keep Capture 06B separate; do not combine the captures' denominators.
- Interpretation: preserve this narrow failure signal and continue evidence-led investigation. Do not make a broad parser, eligibility, ranking, `HEAD_KIND`, or `PART_MARKERS` change from these five records alone. No production behavior, merge, deployment, or `main` change.


## Issue 16 — Capture 06C shadow replay #7 (2026-10-25)

- The owner reports [Issue 16 Shadow Tests run #7](https://github.com/Nimadanesh/shakar/actions/runs/40107729356) passed on test head `47e53d8d85c2d37e87cb0f26b5f01cde15158512`; the replay now rejects C02 while preserving C03 and C04.
- Expected shadow-only verdicts against the five locked Capture 06C human grades: C01 reject (human 1; catalyst dust), C02 reject (human 1; exhaust service/sale is the principal title subject), C03 allow (human 3; direct catalyst buying offer), C04 allow (human 3; direct replacement converter offer), C05 reject (human 1; body mentions a free catalyst test service, not an offer of the target item).
- Human grades remain unchanged and authoritative. This is a test-local counterfactual, not a change to live engine results, not an E5 paired human comparison, and not evidence of population-level precision or ranking uplift. Do not promote to production from this five-item targeted sample alone.


## Issue 16 — repeated shadow replay confirmation (2026-10-25)

- The owner confirmed Shadow Tests runs #8 and #9 succeeded; GitHub Actions records show [run #8](https://github.com/Nimadanesh/shakar/actions/runs/40180396570) passed on `b326bec49504994ab1d505389ec60b9dd57e66ed` and [run #9](https://github.com/Nimadanesh/shakar/actions/runs/40180403570) passed on `cec257acd2ad55f46053fc8747480d6c9659cb51`.
- Both passed dependency installation and the isolated Issue 16 shadow/kind-lexicon test step. This is repeated technical validation of the test-local policy matrix, not additional human-grade evidence, not a paired old-vs-new evaluation, and not proof of live engine uplift.
- Human grades and original capture artifacts remain immutable; no production promotion is authorized by these green runs.


## Issue 16 — punctuation co-offer counter-risk (2026-10-25)

- Added a synthetic test-only boundary case: `فروش دیسک ترمز، کاتالیزور پراید` returns `reject` because the prototype currently recognizes explicit connectors such as `و` / `همراه با`, but does not infer co-offer from a comma.
- Interpretation: this records a plausible false-reject risk for comma-separated inventory titles. It is not a source ad, not a human grade, and not a measured error rate. Do not broaden the rule until a source-backed example and paired human judgement establish that punctuation reliably signals a true co-offer in this context.
- No human labels, capture artifacts, or production behavior changed. Existing 06C replay remains C01 reject, C02 reject, C03 allow, C04 allow, C05 reject.

## Issue 16 — locked 06A/06B subject-policy boundary characterization (2026-10-25)

- Added a test-only characterization for the five previously human-graded source IDs from immutable Captures 06A and 06B. The test preserves the human grades and source IDs, but uses a reduced description containing only the already-confirmed target-presence signal; it is explicitly **not** an exact full-text replay.
- Captured human grades remain: 06A C01=`gaPT4jAd` 2, C02=`gaVv-2zg` 1, C03=`gaODFbLY` 2, C04=`gaTnu9bU` 2; 06B B01=`gaPD6_BG` 1. No labels were changed.
- Test-local shadow outputs: C01 reject, C02 reject, C03 unknown, C04 unknown, B01 reject. The C01 grade-2/reject mismatch is a potential false-reject signal and must remain visible; do not tune it away by changing the human grade or generalizing from this bounded sample.
- This extends the diagnostic boundary matrix beyond Capture 06C while avoiding any new live capture. It does not establish a paired production-vs-shadow quality gain, a population error rate, or authorization for production promotion.
- Shadow Tests [run #15](https://github.com/Nimadanesh/shakar/actions/runs/40183969910) passed on earlier code commit `6bd2e225d7040302a995723cf02a8c3884761087`; the follow-up for `b750f0a` was cancelled amid overlapping workflows. The final test-only commit `8ea1260ee4786b06f59b1a0a8bac870de2a15ab3`, which explicitly pins the grade-2/C01 disagreement inside the suite, is now CI-verified by [Shadow Tests run](https://github.com/Nimadanesh/shakar/actions/runs/40184104544): dependency installation and the isolated Issue 16 shadow/kind-lexicon tests both passed. The subsequent documentation-head workflow also passed the same shadow test job in [run](https://github.com/Nimadanesh/shakar/actions/runs/40184124881). Several adjacent workflow runs in the supplied batch had no jobs (cancelled/empty) or were skipped; Capture 05F runs are separate from Issue 16 evidence and are not new 06A/06B/06C samples. CI now covers the final test assertion. This remains a test-local characterization, not a source-exact replay, paired quality comparison, or production-uplift claim.


## Issue 16 — exact C01 body-offer counter-signal, CI verified (2026-10-25)

- Frozen Capture 06A C01 source was recovered from original artifact `12560808508` without modifying the artifact or human-grade record. Exact description: `یک دست لنت عقب برلیانس سری ۳ یک عدد سنسور اکسیژن بنز کلاس e اصلی یک عدد هدرز با کاتالیزور نو پالس ان اس ۲۰۰ ۲ حلقه لاستیک ۱۸۵،۶۵،۱۴ ،یک حلقه کویر یک حلقه گلدستون یک عدد پمپ gdi سونوتا هیبرید آرمیچر یا روتور استارت سانتافه ۲۰۱۵ تا ۲۰۱۸ فابریک تماس چت دیوار`. The phrase `یک عدد هدرز با کاتالیزور نو` occurs in an item list and is a concrete body-offer counter-signal, not just a repair-context mention.
- Test-only commit `a4bcb4ff783a885932be72fd445650f886d5db75` introduced a conservative `shadowBodyOfferCounterSignal()` diagnostic, then CI exposed malformed regex escaping. Corrective test-only commit [`35532a3`](https://github.com/Nimadanesh/shakar/commit/35532a3acd34b7fff8646931da13a51685a3004e) uses the known fixed target vocabulary directly; no production code or policy path changed.
- Corrected [Shadow Tests run 40185527485](https://github.com/Nimadanesh/shakar/actions/runs/40185527485) passed dependency installation and isolated Issue 16 shadow/kind-lexicon tests. Earlier [40185515369](https://github.com/Nimadanesh/shakar/actions/runs/40185515369) and [40185515384](https://github.com/Nimadanesh/shakar/actions/runs/40185515384) failed on the pre-correction test version; 05F capture was skipped in the latter, so it is not evidence.
- The diagnostic signal is deliberately not an auto-allow. It only proposes `reject -> unknown` when the body contains a clear item-list target offer plus a new-condition cue. Tests assert C01 triggers the signal and C02/B01 do not, preserving their existing reject verdicts. This is a test-local candidate mapping, not a validated quality improvement.
- Capture 05F run [40185527528](https://github.com/Nimadanesh/shakar/actions/runs/40185527528) completed successfully and uploaded artifact ID `12595288676` (SHA-256 `c13146b9bd430640d07b79f3d9a14f163e3db36c37b5ffe61bfa3a8a8037e9d9`). It is a separate whole-vehicle/control capture and must not be counted as fresh Issue 16 evidence. Run [40185515316](https://github.com/Nimadanesh/shakar/actions/runs/40185515316) was skipped.
- C01 human grade remains **2** and immutable; no grade or source mapping changed. The evidence remains a single targeted E4 counterexample, not E5 paired evaluation or a population estimate. Next: retain the conservative counter-signal in shadow tests and compare it against all locked source-matched controls; do not wire it into production without a human-graded paired gate. No production behavior, `main`, merge, or deployment change.


## Issue 16 — locked 06C controls for body-offer counter-signal (2026-10-25)

- Test-only commit [a81fa38](https://github.com/Nimadanesh/shakar/commit/a81fa38ecdf4c982cf11f5dee86023075673bb41) adds an audit over all five locked Capture 06C descriptions to ensure the narrow `shadowBodyOfferCounterSignal()` does not fire on the wrong evidence types: catalyst dust/subtype (C01), exhaust repair/purchase-role context (C02), buyer-seeking inventory (C03), a direct replacement-part offer without the specific immediate-new-condition pattern (C04), or free catalyst testing/service context (C05).
- [Shadow Tests run 40186463053](https://github.com/Nimadanesh/shakar/actions/runs/40186463053) passed dependency installation and the isolated Issue 16 shadow/kind-lexicon test step on commit `a81fa38ecdf4c982cf11f5dee86023075673bb41`. The five 06C human grades remain unchanged: 1, 1, 3, 3, 1. This is a narrowness/regression check, not new human evidence or proof of production quality improvement.
- [Capture 05F run 40186463076](https://github.com/Nimadanesh/shakar/actions/runs/40186463076) also passed and uploaded artifact ID `12596278104`, SHA-256 `d398035708e3066e64d8765e5cd828c6f3b3b0e6446c35fa2c3b67ebda02603a`. This is a separate whole-vehicle/control capture and must not be counted as Issue 16 evidence or as a new 06A/06B/06C sample.
- No source labels or frozen artifacts were changed. No production path was modified; keep the counter-signal test-only and do not promote it without source-matched, human-graded paired evaluation.


## Issue 16 — C01 body-offer counterfactual decision gate (2026-10-25)

- Reconciled the locked source-matched evidence before considering any policy change. Capture 06A C01 (`gaPT4jAd`) is human grade **2** and current shadow verdict `reject`; its frozen body explicitly lists `یک عدد هدرز با کاتالیزور نو`. This is direct item-offer evidence despite the title being led by other parts. The human grade is immutable.
- The test-local `shadowBodyOfferCounterSignal()` is a narrow diagnostic only. For C01 it proposes the counterfactual `reject -> unknown`; it must never convert this evidence to `allow`. The distinction matters because UNKNOWN means the evidence does not justify hard rejection, not that the ad is proven relevant.
- Negative/control checks remain important: 06A C02 and 06B B01 are repair/purchase-context controls and the signal must remain off; all five locked 06C descriptions must also leave the signal off. The existing shadow verdict matrix remains 06C C01/C02/C05 = reject and C03/C04 = allow; the signal does not alter those controls. 06A C03/C04 remain unknown under the current shadow subject-policy characterization.
- This comparison supports a **single source-backed false-reject counterexample**, not an error-rate estimate, population-level precision claim, or paired old-vs-new human-quality result. Green CI validates the diagnostic assertions, not user-visible search quality.
- Decision: keep the signal and its counterfactual mapping test-only. Do not change production eligibility, ranking, parser, `HEAD_KIND`, `PART_MARKERS`, or pipeline. Do not rerun 05F as a substitute for Issue 16 evidence; repeated 05F artifacts are whole-vehicle/control captures, not new 06A/06B/06C samples. A production proposal requires a separate preregistered, source-matched, human-graded paired evaluation with positive and negative controls.
- Governance remains unchanged: PR #43 stays Draft/unmerged; `main` and deployment remain untouched.


### CI confirmation — Issue 16 evidence gate (2026-10-25)

- On PR head `00914930ebc6cff69cc21ed7cd389489603f16de`, Shadow Tests run [40187089792](https://github.com/Nimadanesh/shakar/actions/runs/40187089792) completed successfully.
- Capture 05F run [40187089797](https://github.com/Nimadanesh/shakar/actions/runs/40187089797) completed successfully and produced artifact `engine-v3-issue16-capture-05f` (artifact ID `12596279386`, created 2026-10-25T11:02:53Z). This is a control/whole-vehicle capture, not a new 06A/06B/06C source-matched sample and not evidence that the C01 mismatch is resolved.
- Shadow Tests run [40187084486](https://github.com/Nimadanesh/shakar/actions/runs/40187084486) also completed successfully; it is a repeated technical check, not additional human-quality evidence.
- The 06A, 06B, and 06C capture workflows associated with this head were skipped by their configured conditions. No new Issue 16 human-evaluation records were created by these runs.
- Interpretation unchanged: CI confirms the test-only counter-signal assertions pass. It does not establish production-quality improvement or authorize a production change.


### CI confirmation — paired-protocol head rerun (2026-10-25)

- On documentation/protocol head `59b2a663d0d48eeaa87d161540f9cca8d64d2045`, [Shadow Tests run 40187626395](https://github.com/Nimadanesh/shakar/actions/runs/40187626395) completed successfully.
- [Capture 05F run 40187626379](https://github.com/Nimadanesh/shakar/actions/runs/40187626379) completed successfully and uploaded artifact `engine-v3-issue16-capture-05f`, artifact ID `12597590097`, SHA-256 `cf35497df022c74e4f93604200f28645def203b23cf73a5ce16e0b9f2cd75d10`. This remains a whole-vehicle/control capture, not a new Issue 16 source-matched sample.
- [Shadow Tests run 40187616537](https://github.com/Nimadanesh/shakar/actions/runs/40187616537) also passed on the earlier protocol commit `574d039cf8d105ea3d7eab13b7844fa008e19cb8`; it is a successful repeat, not independent human-quality evidence.
- These runs do not add human grades or alter the locked 06A/06B/06C evidence. Green tests verify the diagnostic test suite only; they do not establish production-quality uplift. Continue with the preregistered unseen paired sample; do not substitute repeated 05F captures. No production path, `main`, merge, or deployment change.
