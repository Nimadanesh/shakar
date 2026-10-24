# Issue 16 — Capture 05F item-kind code-path characterization

Date: 2026-10-24  
Branch: `experiment/issue16-capture04-20261024`  
Scope: documentation-only diagnosis; no production behavior change.

## Question

Why can a broad whole-vehicle hunt (`خرید و فروش خودرو`, category `vehicles`) retain catalyst-only, repair/service, and body-parts listings as `near`, while a whole-vehicle buyer or dealer offer can also be `near`?

## Source inspection

Inspected current branch source:

- `PWA_app/src/lib/server/hunt/kindLexicon.ts` (blob `4665b0d848fb1229250a508a73d3b4b64e62cc17`)
- `PWA_app/src/lib/server/hunt/kindLexicon.test.ts` (current blob `adb9b2301248d3ee8ef590651796ee2063b3aa04`; includes the Issue 16 characterization assertions described below)
- `PWA_app/src/lib/server/hunt/pipeline.ts` (blob `ce180f10b0055b4e3a05c300aa9866deefa85f33`)

The exact 05F source snapshots and raw engine outcomes were independently re-opened from Actions artifact `12552478200` (run [40075265983](https://github.com/Nimadanesh/shakar/actions/runs/40075265983), raw commit `5cfeff0e8ea70936839e674306566963b006eaf2`). The seven graded IDs and their titles/descriptions in that artifact match the internal-key and graded reports. The overlapping row `gapYR7Ug` is excluded from the graded fixture.

## Current code path

1. `queryKindForDef(include, serviceIntent, category)` checks the closed `HEAD_KIND` phrase lexicon, then uses the category bridge. For a vehicle-category hunt whose include phrase has no lexicon hit, the category bridge resolves the query kind to `vehicle`.
2. `adKindForTitle(title)` classifies the normalized title head after skipping a small list of sale cues. It returns `null` for unknown heads.
3. `kindGateRejects(queryKind, adKind, ...)` explicitly returns `null` when either side is unknown. This is an intentional anti-overfilter rule.
4. The pipeline invokes the kind gate only after the listing has MUST evidence (`missingInfo.length === 0`). A null title-head kind therefore cannot structurally reject a wrong-kind ad; other semantic rules may still cap it, but lexical/MUST evidence can leave it eligible as `near`.

## How the graded 05F examples map to the code

| Blind label | Human grade | Observed principal item | Current title-head coverage expectation | Diagnostic implication |
|---|---:|---|---|---|
| B01 | 1 | Catalyst buying/selling | Unknown: `کاتالیزور` is not a `HEAD_KIND` entry | Kind gate likely no-ops; not evidence that a catalyst-specific patch is automatically safe |
| B02 | 3 | Whole damaged-vehicle buyer/exchange | Title begins with valuation/buyer wording, not a known vehicle head | Must remain eligible; transaction role must not be mistaken for item kind |
| B03 | 1 | Bulk body parts | Unknown: `بدنه` is not a `HEAD_KIND` entry | Kind gate likely no-ops |
| B04 | 1 | Stock body and body-parts inventory | Unknown: the title head is `بدنه`, before the later `پژو/پراید/دنا` mentions | Particularly clear title-head limitation; later vehicle tokens do not establish that whole vehicles are the principal item |
| B05 | 1 | Catalyst repair and used-material buying | Unknown: title begins with `کاتالیزور` | Kind gate likely no-ops; service/transaction wording alone must not determine item kind |
| B06 | 1 | Tire-only exchange | Engine rejected it in this sample | Healthy negative control; retain it in any paired regression |
| B07 | 3 | FMC511 whole-vehicle dealer offer/exchange | Unknown: title begins with `فردا موتور`, not a lexicon key | Must remain eligible; the later `موتور` substring alone is not a safe title-head classification |

“Unknown” in this table is a source-based prediction from the current title-head algorithm, not a claimed runtime trace. The human grades and engine outcomes are taken from the locked 05F report; no unseen listing text or grade has been reconstructed.

## Characterization assertions already added

The current `kindLexicon.test.ts` now includes an Issue 16 section that asserts:

- `فروش پراید` remains classifiable as `vehicle`.
- The seven source-matched 05F titles currently classify as unknown at the title-head layer.
- The vehicle-category fallback resolves the broad query kind to `vehicle`.
- Unknown ad kinds for the B01 and B03 title examples produce no kind-gate verdict.

These are characterization assertions of current behavior, **not** the desired future behavior. They do not execute the full pipeline against immutable listing snapshots and do not prove a fix. Test execution has **not** been verified in this session; no test pass is claimed.

## Falsifiable full-pipeline fixture — next step

A deterministic, source-grounded fixture is still required before changing the lexicon or gate. It should assert the current classification and full pipeline verdict separately, so a future patch cannot pass by merely changing one layer.

### A. Whole-vehicle positives (must remain eligible)

- Direct whole-car sale: `فروش پراید` → `adKindForTitle = vehicle`.
- Damaged whole-vehicle buyer/exchange: exact source-matched B02 title/body from the raw artifact; it must remain eligible for the broad hunt.
- Dealer whole-vehicle offer/exchange: exact source-matched B07 title/body; it must remain eligible.

### B. Wrong-kind negatives (should not be primary whole-vehicle results)

- Catalyst buying/selling: exact B01 source snapshot.
- Body-parts inventory: exact B03 and B04 source snapshots, especially B04 where vehicle names occur after the body-parts head.
- Catalyst repair/service: exact B05 source snapshot.
- Tire-only exchange: exact B06 source snapshot, which is already rejected and must stay rejected.

### C. Role and mention counter-controls

- A whole-vehicle buyer ad is not a part listing merely because it seeks to buy; preserve B02.
- A whole-vehicle dealer listing is not a part listing merely because it mentions exchange; preserve B07.
- A genuine whole-car title/description that mentions a part as a secondary detail must remain eligible.
- A parts inventory that mentions vehicle models later in the title/description must not become a whole-vehicle listing solely from those mentions.

### Acceptance gate

1. Pin exact source IDs, titles, and available immutable descriptions before coding; keep internal IDs out of the blind packet.
2. Record current `queryKind`, `adKindForTitle`, gate verdict, semantic verdict, and final pipeline verdict for every fixture row.
3. Verify the paired positives and negatives against the locked human grades; unknown kind must not silently become a hard rejection.
4. If source snapshots are incomplete, report the gap instead of recreating ad descriptions from memory.
5. No lexicon entry, global marker, rank penalty, or hard rejection until this characterization is reviewed and a narrow candidate fix has counter-controls.

## Current conclusion

Evidence points to a **closed title-head coverage gap**: known whole-item heads are classifiable, but several wrong-kind listings start with unrecognized principal-item nouns and therefore bypass the kind gate under the deliberate unknown-no-op contract. This is a plausible mechanism, not yet proof that adding `کاتالیزور`, `بدنه`, or other nouns to `HEAD_KIND` is safe. The lexicon contract says each new entry must be valid in all three uses: ad head, query subject, and co-offered sibling marker. A future fix must satisfy that three-reader constraint and preserve whole-vehicle buyer/dealer controls.

No engine or ranking logic changed. No merge, deployment, or `main` change.


## Capture selector integrity correction (2026-10-24)

An audit of the raw Capture 05F artifacts found that the **capture-cell selector**, not the engine, had mislabeled some listings:

- Artifact `12552478200` (run [40075265983](https://github.com/Nimadanesh/shakar/actions/runs/40075265983)) placed the body-parts inventory `فروش بدنه استوک فابریک پژو، پراید، تیبا، دنا، سمند` in `whole-clean` because it searched for any vehicle-model token anywhere in the title.
- The same artifact placed the tire-only exchange `لاستیک تیبا 95درصد معاوضه با پراید` in `whole-with-part-mention`; the mention of Tiba/Pride made the part listing look like a whole-vehicle ad to the broad regex.
- It placed the FMC511 dealer offer `فردا موتور FMC511/صفر و خشک برج روز/نمایندگی` in `other-part` because the substring `موتور` was treated as a part signal, despite the listing being a whole-vehicle offer. These are selector-label errors; the underlying raw engine outputs and separate human grades must not be conflated with the cell names.

The helper `isCell` in `live-issue16-capture-05f.test.ts` was corrected in commits `ce66d0f` and `99172c9`: part heads now take precedence, whole-car matching is anchored to the title head, and the FMC511 dealer title is explicitly recognized as a whole-vehicle positive. No production code changed.

Validation on branch head `99172c9ca8dc9ace47953dc40245ba8f5829d45f`:
- Run [40077666348](https://github.com/Nimadanesh/shakar/actions/runs/40077666348) completed successfully.
- The focused `kindLexicon.test.ts` step passed; the bounded Capture 05F step and artifact upload also succeeded.
- Artifact `12554390133` now correctly records `whole-with-part-mention` as `missing-cell` rather than falsely selecting the tire-only exchange. The other seven scenarios captured: one whole-car sale, one whole-vehicle buyer/exchange candidate, two catalyst-only candidates, one catalyst-service candidate, and two parts candidates. This means the selector integrity issue is corrected, but the whole-car-with-secondary-part-mention positive control is **still missing** and must be captured before that contrast is considered tested.
- These newly captured rows are raw diagnostic observations, not human grades. Do not add them to the locked 05F graded sample or treat repeated workflow invocations as independent observations.

No full-pipeline paired fixture exists yet. The next step remains to use exact source snapshots for a deterministic fixture that records the title-head kind, gate verdict, semantic verdict, and final verdict separately. No engine/ranking change, merge, deployment, or `main` change.


## Deterministic full-pipeline baseline fixture added (2026-10-24)

- Added a source-pinned characterization test to `PWA_app/src/lib/server/hunt/pipeline.test.ts` for all seven rows in the locked 05F blind packet. It uses the exact source-matched titles and descriptions, the resolved target query `خرید و فروش خودرو`, and mocked Divar I/O; it does not contact live services.
- The baseline expectations encode the observed 05F outcomes: B01/B03/B04/B05 wrong-kind catalyst/body/service rows are `near`; B02 and B07 human-grade-3 whole-vehicle buyer/dealer controls are also `near`; B06 tire-only exchange is rejected. This test is a regression baseline, not an assertion that the current behavior is desirable.
- The workflow runs both `kindLexicon.test.ts` and `pipeline.test.ts` before the bounded live capture. The later validation section below records the successful run on head `78dcc3bd2722d196b1d2e7877c40aeeb153e3144`.
- The valid whole-car-with-secondary-part-mention positive remains unavailable in the locked source set. The test therefore covers the existing whole-vehicle buyer/dealer positives and the tire-only negative, but cannot fully close the secondary-mention counter-control. Do not use the older misclassified tire row as a substitute.
- No production code or ranking behavior changed. PR #42 remains Draft/open/unmerged; `main` untouched; no deployment.


### Validation correction — pipeline-suite environment cap (2026-10-24)

- The first combined run [40078999302](https://github.com/Nimadanesh/shakar/actions/runs/40078999302) executed the new source-pinned Issue 16 pipeline test successfully, but the overall focused command failed one unrelated existing batching test: the workflow-level `HUNT_MAX_DETAILS=8` changed its expected 25-detail test budget. Result: 123 tests passed, 1 unrelated test failed; live capture was skipped.
- Corrected the focused test command to set `HUNT_MAX_DETAILS=25` for the unit/pipeline test invocation. The live capture step retains its separate bounded budget of 8. This correction was verified by successful run [40079121984](https://github.com/Nimadanesh/shakar/actions/runs/40079121984), documented below.
- This is test-environment isolation only; no production code or ranking logic changed.


### Validation result — source-pinned fixture and latest bounded capture (2026-10-24)

- Corrected workflow run [40079121984](https://github.com/Nimadanesh/shakar/actions/runs/40079121984) completed successfully on head `78dcc3bd2722d196b1d2e7877c40aeeb153e3144`. Both `kindLexicon.test.ts` and `pipeline.test.ts` passed (2 test files); the new source-pinned Issue 16 pipeline characterization passed. The workflow-level test budget is now `HUNT_MAX_DETAILS=25`, while the live capture retains its separate cap of 8 detail fetches.
- The same run's bounded live capture completed and uploaded artifact `12553843717`. It found a direct whole-car sale, a whole-vehicle buyer/exchange candidate, a further whole-car sale, a whole-vehicle dealer candidate, two catalyst-only candidates, one catalyst-service candidate, and two other-part candidates. `whole-with-part-mention` is still `missing-cell`; the selector has not found a valid whole-car positive whose secondary detail mentions a part. Do not substitute the tire-only exchange or infer a grade for any new live row.
- Raw engine outcomes in this capture: whole-car sale, buyer/exchange, dealer, catalyst-only, catalyst service, and the two part listings all landed as `near`; this includes obvious wrong-kind ads such as `خرید فروش کاتالیزور`, `تعمیر تخصصی کاتالیزور با ضمانت 1ساله`, `فروش سپر جلوپنجره چراغ پراید پژو سمند ساینا کوئیک`, and `فروش موتور کامل پژو پراید نیسان سمند تیبا xu7 tu5`. The tire-only exchange remains rejected in the locked source-pinned fixture. These new live rows are ungraded diagnostics and are not independent human-quality samples.
- Interpretation remains unchanged: the code-path gap is reproducible in a deterministic full-pipeline baseline, and the live capture is consistent with it; the missing secondary-part-mention positive prevents closing that counter-control. Do not add a lexicon entry or hard gate yet. Next high-value step is to obtain an exact-source whole-car-with-secondary-part positive (or explicitly close that cell as unavailable), then design a candidate fix against the locked positives/negatives and test all three lexicon reader contexts before any production behavior change.
- PR #42 remains Draft/open/unmerged. No production logic, ranking, `main`, or deployment changed.

## Expanded full-pipeline characterization — Capture 05D controls (2026-10-24)

- Expanded the deterministic test in `PWA_app/src/lib/server/hunt/pipeline.test.ts` with exact source-matched 05D controls, using the same broad target query `خرید و فروش خودرو` and mocked Divar I/O. No live calls occur in this test.
- Current full-pipeline outcomes asserted by the characterization:
  - D02 — whole-vehicle Toyota dealership/installment offer, human grade 3: `near` (eligible).
  - D03 — Lifan parts-only inventory, human grade 1: `exact` (eligible). This is the strongest counterexample: the engine can classify a parts-only listing as exact for the whole-vehicle hunt.
  - D05 — direct Dena Plus whole-vehicle sale, human grade 3: `near` (eligible).
  - D07 — whole-vehicle installment sales, human grade 3: `near` (eligible).
  - D08 — exhaust/catalyst replacement control, human grade 1: `rejected` (ineligible).
- D03 duplicates an invalid-selection record from Capture 05E. It remains useful as a regression fixture, but it is not a fresh independent observation and must not be counted twice in sample metrics. The locked 05D per-row grades are unchanged.
- Validation on current PR head `639ed262f4f28b8c5057bc683816f133d73b5331`:
  - [Run 40082025322](https://github.com/Nimadanesh/shakar/actions/runs/40082025322): unit/kind-lexicon and full-pipeline characterization tests passed; bounded read-only Capture 05F passed and artifact `12555228673` was uploaded.
  - [Run 40082025317](https://github.com/Nimadanesh/shakar/actions/runs/40082025317): the companion bounded Capture 05E workflow completed successfully on the same head.
  - The earlier parse failure on parent commit `04eaf109d48a2b6141919a58e99974f858f350b3` is superseded by the corrected fixture-array commit; do not treat that old run as the status of the current head.
- Interpretation: the evidence now includes a reproducible exact-grade mismatch for parts-only inventory (D03), repeated near-miss wrong-kind catalyst/parts examples, and several whole-vehicle grade-3 controls that are only `near`. The catalyst/exhaust D08 negative control is rejected, demonstrating that behavior is not a universal pass-through. This still does **not** establish a safe global lexicon token or a safe hard gate.
- Remaining gap: a valid whole-car positive whose secondary detail mentions a part is still missing from the exact-source set. The tire-only exchange is not a substitute. Keep production behavior unchanged until this counter-control is found or explicitly closed as unavailable and a narrowly scoped candidate is reviewed against the locked controls.

No production engine/ranking logic changed. PR #42 remains Draft/open/unmerged; `main` remains untouched; no deployment.

## Candidate-fix triage after the expanded baseline (2026-10-24)

The next experiment should separate **transaction-role parsing** from **principal-item-kind parsing**. A token-only addition is not sufficient:

- Adding `کاتالیزور` to `HEAD_KIND` alone would not classify titles such as `خرید فروش کاتالیزور` or `فروش خرید انواع کاتالیزور...` while `خرید` remains an unskipped leading token. It also would not solve the service-on-goods policy, which deliberately demotes service ads to `near` instead of rejecting them.
- Adding `بدنه` broadly is high-risk: it is an ambiguous noun and occurs in body-parts inventory, while later model names must not turn a part listing into a whole car. Prefer an explicit compound such as `لوازم یدکی` only as a candidate to evaluate, not as an approved lexicon edit.
- The strongest candidate experiment is a test-only shadow parse with two independent outputs: (a) transaction role/cues (buy, sell, exchange, service), and (b) principal item kind from the title head. It should compare the current parser with a proposed role-skipping set on the exact source-pinned fixtures, without changing production behavior.
- Before proposing a production patch, test all three lexicon-reader contexts for each candidate phrase: (1) ad title head, (2) query subject resolution, and (3) co-offered sibling/marker guard. In particular, confirm that `خرید و فروش خودرو` still resolves to `vehicle`, a parts-only head resolves to a vehicle-part kind, and a genuine whole-vehicle title that mentions a secondary part remains eligible.
- Required paired assertions for any future candidate: B02/D02/D05/D07 whole-vehicle buyer/dealer/direct-sale positives stay eligible; B01/B03/B04/B05 and D03 wrong-kind examples stop being `exact`/eligible where the evidence supports exclusion; B06 tire-only exchange and D08 catalyst/exhaust control remain rejected; and unknown item kinds still no-op rather than causing broad false rejection.

Decision: **do not edit `HEAD_KIND`, `HEAD_SKIP_TOKENS`, production gate logic, or ranking yet.** The successful characterization establishes a target for the next isolated shadow experiment, not authorization or proof for a production fix.

## Test-only shadow parser experiment (2026-10-24; validation pending)

A separate test file, `PWA_app/src/lib/server/hunt/issue16-shadow-kind.test.ts`, now compares the current title-head parser with a deliberately isolated candidate parser. The candidate strips leading transaction-role cues before reading the principal title head, checks part heads before vehicle aliases, and falls back to the established parser before broad vehicle aliases so compounds such as `ماشین لباسشویی` keep their existing appliance classification. It includes paired controls for catalyst-only, spare-parts inventory, body/bumper listings, direct Dena/Toyota vehicle offers, a whole-vehicle buyer cue, tire-only exchange, and a title that mentions a secondary spare tire.

This is **not production code** and its small local candidate lexicon is not yet approved for promotion. In particular, the candidate has an explicit narrow `خودرو تصادفی` positive cue for the source-matched damaged-vehicle buyer title; this must be reviewed as a scoped exception, not generalized into a broad substring rule. FMC511 dealer title remains unknown by design until an exact safe head rule is evidenced, so the gate remains a no-op rather than guessing.

The Capture 05F workflow was updated to include this new test file in both its path filters and focused Vitest command. Validation on head `d941c9bf7e5f840e12001825e7cd6c7255c84712` succeeded in [run 40084024959](https://github.com/Nimadanesh/shakar/actions/runs/40084024959): all 3 focused test files passed (131 tests total), including all 5 shadow-parser cases; the separate bounded live Capture 05F test also passed and uploaded artifact `12556706332`. The successful tests establish only that the isolated candidate behaves as its tests specify; they do not establish production precision/recall or justify promotion. Do not use the candidate parser for production ranking, hard exclusion, or human-grade computation.
