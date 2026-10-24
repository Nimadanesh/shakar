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

## Issue 16 Follow-up 03 — targeted-query capture (2026-10-24)

- Capture run [40061183031](https://github.com/Nimadanesh/shakar/actions/runs/40061183031), artifact `12546903271`, on experiment PR #41 head `de2b83c9d158b017f4235d65c18b35963ab17387`. Read-only; Node 24; Mizan shadow disabled; 8 targeted queries, maximum 2 list pages/query, 8-detail and 8-unique-ID caps. Six detail reads / six unique IDs were used; `productionRank` is null for every record.
- Captured cells: refrigerator seller, buyer, mixed; whole vehicle; voucher; vehicle exchange. Missing within budget: explicit cash and installment controls. The selector recorded encountered overlap with prior packet IDs (`wZcsAVgg`, `gaIL7h0B`, `gaPHaEfq`) but excluded those IDs from selected records. This remains a selected, ungraded live snapshot, not a blind packet or quality metric.
- **Important new diagnostic lead:** query `فروش یخچال` resolved to include terms `فروش`, `یخچال`, category `home`; its directly relevant refrigerator-for-sale listing `gaWDC3Xz` (`یخچال فریزر فروش فوری فوری زیر قیمت`) was hard-rejected with `kind:domain:appliance-not-home-goods`. The same run's explicit buyer query returned a refrigerator buyer listing and classified it exact; the mixed query returned a shop that both sells and buys refrigerators and was classified near. The seller rejection suggests a possible interaction between the category fallback (`home` → `home-goods`) and subject-kind resolution when the verb precedes the item term. It is a code-level hypothesis, not yet proven root cause or human-graded relevance evidence.
- Follow-up investigation should inspect `queryKindForDef`/definition ordering and add a focused regression test for seller/buyer/ordinary refrigerator queries before proposing any fix. Require paired wrong-kind controls (e.g. refrigerator parts versus the appliance itself) and preserve unknown/no-op behavior. Do not globally relax the kind gate.
- Vehicle whole-item and voucher controls were both captured; both are eligible in this diagnostic run and both carry `near`/low scores in the engine snapshot. Human grades for earlier Issue 16 packets do not transfer to these newly captured IDs. The vehicle exchange cell was retrieved; its title is a direct Tiba listing with explicit exchange wording, but engine match kind was near due missing `خودرو` evidence. These are hypotheses for a later blind evaluation only.
- Protocol caveat: the artifact's diagnostic key was inspected before any new blind packet was frozen, so **do not derive a purported blind packet from this capture**. If the category/kind lead is pursued, first build a separate predeclared capture design and keep the blind presentation and source/diagnostic key isolated.
- Decision: no ranking, eligibility, rejection, or category semantics change from this run. PR #41 remains Draft/unmerged; `main` and deployment untouched.


## Issue 16 — narrow query-kind follow-up (2026-10-24; experimental)

- Code inspection confirmed the candidate failure path: `queryKindForDef` only matched a lexicon subject at the start of the include phrase. For the captured `فروش یخچال` definition (`["فروش", "یخچال"]`, category `home`), this misses `یخچال → appliance` and falls through to `home-goods`; the live fridge seller was then rejected as `kind:domain:appliance-not-home-goods`.
- Experimental branch change: preserve the original subject-first lookup; only if it finds no subject, strip leading tokens already classified in `HEAD_SKIP_TOKENS` and retry once. No arbitrary interior-token search, global kind-gate relaxation, buyer-role change, or ranking rule was added.
- Regression coverage adds `فروش یخچال → appliance`, ordinary `یخچال → appliance`, and preserves `تعمیر یخچال → service` plus the existing unknown/category fallback. The existing kind-gate tests retain wrong-kind rejection and unknown/no-op controls.
- This is an experimental code hypothesis tied to one live false rejection, not a measured population-level gain. The new PR-triggered bounded captures are execution side effects only and must not be treated as independent human-quality evidence or converted into a blind packet. Await the focused/full test result before deciding whether this proposal remains in the Draft PR. No merge/deploy; `main` untouched.
