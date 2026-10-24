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


## E4 — Issue 16 Capture 06C: paired blind follow-up (2026-10-24)

- Preregistered protocol: [ISSUE16-CAPTURE-06C-PROTOCOL.md](evaluations/ISSUE16-CAPTURE-06C-PROTOCOL.md); immutable bounded capture [run #1](https://github.com/Nimadanesh/shakar/actions/runs/40100799513), artifact ID `12563205197`, SHA-256 `c321b97cfefce573c6956b15e52c451e34915d1749e8c2a8541a681dcd82d198`.
- Capture completed successfully on Node 24.21.0. Budget: 2 pages/query, 8 details maximum; actual 5 detail reads / 5 unique records; Mizan Shadow disabled. 19 overlapping previously inspected IDs were excluded during retrieval. One selected record met the body-only condition; four selected records had the target term in the title and form a **candidate control arm**, not guaranteed true positives.
- The five-item blind packet is [ISSUE16-CAPTURE-06C-BLIND.md](evaluations/ISSUE16-CAPTURE-06C-BLIND.md). Human grades are pending; do not open or publish the source mapping/engine diagnostics until grades are locked.
- Run output shows one body-only candidate in the other-part-title context arm, plus four direct-title candidates. A title mention is not proof of an offer; exact relevance must be human-graded. This sample is targeted and non-random, not a population precision estimate or E5 paired quality comparison.
- The same PR update incidentally triggered Capture 06A run [#19](https://github.com/Nimadanesh/shakar/actions/runs/40100799490) and Capture 06B run [#6](https://github.com/Nimadanesh/shakar/actions/runs/40100799509). These are additional immutable artifacts, **not fresh evidence for the original 06A/06B grade packets**; do not merge their outputs into those frozen packets. Their IDs were checked against Capture 06C's overlap list; selected Capture 06C candidates were distinct from those concurrent reruns.
- Workflow jobs for Capture 06A/06B/06C are now gated to run live retrieval only on explicit `workflow_dispatch`, preventing further accidental capture runs on PR synchronization. Newly opened IDs from these runs are excluded in the capture test ID lists.
- No production behavior, ranking, eligibility, `HEAD_KIND`, `main`, merge, or deployment change. PR #43 remains Draft and unmerged.
