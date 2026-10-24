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
- The workflow now runs both `kindLexicon.test.ts` and `pipeline.test.ts` before the bounded live capture. The first execution on the updated head is pending; no test pass is claimed until its job reports success.
- The valid whole-car-with-secondary-part-mention positive remains unavailable in the locked source set. The test therefore covers the existing whole-vehicle buyer/dealer positives and the tire-only negative, but cannot fully close the secondary-mention counter-control. Do not use the older misclassified tire row as a substitute.
- No production code or ranking behavior changed. PR #42 remains Draft/open/unmerged; `main` untouched; no deployment.


### Validation correction — pipeline-suite environment cap (2026-10-24)

- The first combined run [40078999302](https://github.com/Nimadanesh/shakar/actions/runs/40078999302) executed the new source-pinned Issue 16 pipeline test successfully, but the overall focused command failed one unrelated existing batching test: the workflow-level `HUNT_MAX_DETAILS=8` changed its expected 25-detail test budget. Result: 123 tests passed, 1 unrelated test failed; live capture was skipped.
- Corrected the focused test command to set `HUNT_MAX_DETAILS=25` for the unit/pipeline test invocation. The live capture step retains its separate bounded budget of 8. Rerun is pending; do not claim the combined suite is green until it completes.
- This is test-environment isolation only; no production code or ranking logic changed.
