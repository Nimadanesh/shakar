# Issue 16 — HEAD_KIND three-reader audit (2026-10-24)

Branch: `experiment/issue16-capture04-20261024`  
Scope: source inspection / decision support only. No production behavior change.

## Decision summary

Do **not** add `کاتالیزور`, `لوازم یدکی`, or `بدنه` to production `HEAD_KIND` yet. The current shadow parser demonstrates a plausible candidate classification, but the production lexicon is not a one-reader dictionary: the same kind labels feed ad-head classification, query-subject resolution, and a same-kind marker guard. The third reader creates a cross-subject side effect that a simple whole-car false-positive test would miss.

## Three-reader contract

| Candidate phrase | Ad title head | Query subject | Co-offered sibling / marker guard | Current disposition |
|---|---|---|---|---|
| `کاتالیزور` / `کاتالیز` | In an automotive title, likely `vehicle-part`; however `خرید فروش کاتالیزور` remains unknown under the current production skip list because `خرید` is not skipped. A lexicon entry alone does not solve that prefixed title. | A query whose canonical include begins with `کاتالیزور` would resolve to `vehicle-part`; a role-prefixed include may still miss the lexicon and fall back to category/unknown. Verify canonical include shape before relying on this. | The phrase is not currently in `PART_MARKERS`, so the entry alone does not make catalyst a marker. But resolving a catalyst hunt to the broad kind `vehicle-part` means existing part markers whose `HEAD_KIND` is also `vehicle-part` can be skipped as same-kind siblings (e.g. battery/disc/brake-related markers). A catalyst hunt could consequently become permissive toward other parts. | **Do not add yet.** Need a subject-specific marker counter-test and a role-prefix parsing test. |
| `لوازم یدکی` | A useful part-inventory head when it truly leads the title. A leading sale cue can be skipped, but a leading `خرید` is not currently skipped. | A canonical query beginning with `لوازم یدکی` should resolve as `vehicle-part`, if the phrase is added. Confirm the query normalizer preserves this exact phrase. | The phrase is not currently a part marker. The same broad `vehicle-part` query-kind side effect applies: existing markers of that kind may be treated as compatible siblings, even when the user seeks a specific part. | **Best candidate for further isolated shadow tests**, not a production dictionary edit. |
| `بدنه` | Can identify body-parts inventory in the observed titles, but the noun is semantically ambiguous and can refer to a vehicle body/component, repair work, or a body shell sold in different contexts. | A generic `بدنه` hunt cannot safely be presumed to mean a parts-only hunt without intent/context. Mapping it to `vehicle-part` may change legitimate body/shell hunts. | Not currently a `PART_MARKERS` entry; adding it to `HEAD_KIND` alone does not add a marker. It still introduces the broad same-kind query effect described above. | **Reject as a broad lexicon candidate for now.** Keep compound/context-sensitive interpretation in shadow analysis. |
| `اگزوز`, `سپر`, `گلگیر`, `کاپوت`, `چراغ`, `لاستیک` | Often clear automotive part heads when they lead the title; must not be inferred from later mentions after a whole-car head. | Direct part hunts may legitimately need `vehicle-part`; do not infer that every role-prefixed query canonicalizes to the part head. | These are not all current `PART_MARKERS`. Assigning the common kind would cause the same broad sibling compatibility risk for direct hunts of any one of these parts. `لاستیک` also has a strong negative control: tire-only exchange must stay rejected for whole-car hunt. | Keep as test-only candidate terms; no production entries. |

## Source-grounded implications

1. `adKindForTitle` skips only `HEAD_SKIP_TOKENS`; `خرید` is not in that set. Therefore, a dictionary addition cannot by itself repair titles such as `خرید فروش کاتالیزور`. A separate, explicitly tested transaction-role prefix parser would be needed.
2. `queryKindForDef` resolves the longest `HEAD_KIND` phrase at the beginning of `include.join(" ")`, then falls back to service intent/category. Whether a part phrase becomes the query kind depends on the canonical include order, not merely on the raw user query.
3. `assessModelSpecificity` skips a marker whenever `HEAD_KIND[marker] === queryKind`. This is kind-wide, not exact-subject matching. If `کاتالیزور` is assigned `vehicle-part`, an explicit catalyst hunt may skip existing part markers of that same kind. That can protect true co-offers, but can also let a different part survive a specific-part hunt. This counter-risk must be tested before any shared lexicon edit.
4. The part-marker loop and the kind gate are distinct mechanisms. Adding a `HEAD_KIND` entry does not automatically add that term to `PART_MARKERS`; do not describe the third reader as if it did.
5. The shadow parser currently classifies `بدنه` as a part head and uses a special whole-car phrase exception for `خودرو تصادفی`. Those are experiment-local assumptions, not approved production semantics. The dealer title `فردا موتور FMC511...` remains unknown in the shadow parser; unknown must continue to no-op rather than being guessed as a part.

## Required test matrix before proposing a production change

- **Whole-vehicle positives:** source-pinned B02, B07, D02, D05, D07 remain eligible; keep direct `فروش پراید` as known-head control. Do not let buyer/seller/exchange role decide item kind.
- **Wrong-kind negatives:** source-pinned B01/B03/B04/B05, S01/S03/S04/S05, D01/D03/D04/D06/D08; D03 is a repeat from 05E and must not be counted as a fresh sample. Do not treat repeated workflow captures as independent human evidence.
- **Negative exchange control:** B06 tire-only exchange remains rejected for the whole-car hunt.
- **Query-subject counter-risk:** direct hunts for `کاتالیزور` and `لوازم یدکی` must not admit unrelated same-kind items solely because both map to `vehicle-part`. Include at least one existing part marker (e.g. disc/brake/battery) as the wrong specific subject.
- **Role-prefix controls:** `خرید فروش کاتالیزور`, `فروش لوازم یدکی لیفان...`, and `خریدار خودرو تصادفی` must be parsed by principal item independently of transaction role.
- **Secondary mention:** a genuine whole-car title with a secondary part mention remains a required control, but the source-matched live cell is still unavailable. Do not substitute the tire-only exchange or invent a source snapshot. Until a valid source is recovered, record the limitation.
- For each row, record separately: normalized title tokens, query kind, ad kind, kind-gate verdict, semantic verdict, and final pipeline verdict. Unknown stays unknown.

## Recommendation

Continue with a test-only shadow matrix, adding the query-subject counter-risk and transaction-prefix cases above. Do not modify `HEAD_KIND`, `PART_MARKERS`, production parsing, ranking, or eligibility in this step. Human grades remain the quality authority; test success only validates the diagnostic contract.

## Addendum — evidence recovery and regression status (2026-10-24)

This addendum supersedes only the earlier statement above that a source-matched whole-vehicle positive with a secondary part mention was unavailable. The original audit text is retained as the historical state at the time it was written.

- The positive was recovered from frozen packet 05D: D05 → source ad `gacTnnuH`, human grade 3. Its title is `دنا پلاس توربو اتومات بدون رنگ 1400 فروش فوری`; its description mentions `کمک فنر` and `تایر` secondarily. See [the recovery record](./I16-SECONDARY-PART-POSITIVE-RECOVERY-2026-10-24.md).
- A paired test-only control now uses that source-backed positive and H05F-B03's frozen parts-inventory title/body as the negative. Baseline #171 on `93109026e28a7cccbd359be884be1a8d697b86fe` passed **318 focused tests** and **911 full portable tests**; the user reports the workflow's overall failure remains the separate ESLint step. This validates the paired regression assertions, not production behavior changes.
- Updated disposition: the secondary-mention marker-guard evidence gap is **closed for this specific existing-marker path**. It is not evidence for adding any new `HEAD_KIND` entries, nor does it prove every secondary-part phrase is safe.
- Remaining gates: (1) query-subject same-kind marker-skip counter-risk for specific part hunts, (2) role-prefix parsing such as `خرید فروش کاتالیزور`, and (3) whole-vehicle vs part-inventory outcomes across all three `HEAD_KIND` readers. Keep these in shadow/test-only analysis until paired source-grounded controls and a safe design exist.
- No production lexicon/parser/ranking/eligibility changes, merge, deployment, or `main` modification are authorized by this evidence.

## Follow-up diagnostic — specific-part false-acceptance counter-risk (2026-10-24)

A synthetic, explicitly non-source-grounded test was added to `issue16-shadow-kind.test.ts` to isolate the third-reader risk:

- Listing title: `دیسک ترمز پراید سالم`.
- Listing text mentions `کاتالیزور` only secondarily in a contextual phrase.
- With the current category-fallback query kind (`vehicle`), the existing `دیسک` part marker produces a subject mismatch and reject.
- With a hypothetical broad query kind (`vehicle-part`), the kind-aware marker guard skips `دیسک` because `HEAD_KIND["دیسک"] === "vehicle-part"`; the mismatch disappears.

This is a mechanism-level counterexample, **not** a real Divar sample, a human grade, or a measured production false positive. It establishes why the third reader must not be ignored when considering new part-kind entries. Baseline #172 was triggered on test commit `f60241139d96be2bba82e274ffdbab0a04ce93f4`; focused/full test status is pending at the time of this note.

Decision remains unchanged: do not edit production `HEAD_KIND`, `PART_MARKERS`, parser, ranking, or eligibility until a safe three-reader design handles specific-part subject identity and transaction-role prefixes with paired evidence.

### Validation update — Baseline #172 (2026-10-24)

Baseline [#172](https://github.com/Nimadanesh/shakar/actions/runs/40090307284) completed on test commit `f60241139d96be2bba82e274ffdbab0a04ce93f4`. The focused suite, full portable suite, TypeScript typecheck, and production build passed; ESLint failed separately. Exact test counts were not available in the returned job summary, and the downloadable logs endpoint was unavailable, so this audit does not assert counts.

The synthetic counterexample is now test-validated as a mechanism-level demonstration of the third-reader hazard. It does not change the evidence boundary or authorize production changes.


## Validation update — role-prefix characterization Baselines #173 and #174 (2026-10-24)

- Baseline [#173](https://github.com/Nimadanesh/shakar/actions/runs/40090483865) on `f020a45a3afbeb008c89a94e1ae6a14fa2fbaa46` and Baseline [#174](https://github.com/Nimadanesh/shakar/actions/runs/40090490072) on `85cd0c40a75963a73ac3ce809441e5a94cfaef0d` both completed with **320 focused tests passed** and **913 full portable tests passed**. Both runs have the same counts, each +2 focused and +2 full versus #171 (318 / 911).
- Workflow job details confirm focused suite, full portable suite, TypeScript typecheck, and production build all passed in both runs. ESLint failed separately in both runs; overall workflow status remains failure due to lint, not test failure.
- The test-only role-prefix characterization is validated. It documents the current production parser's unknown outcomes for the frozen role-prefixed titles alongside isolated shadow classifications. It does not establish that the shadow classifications are production-ready.
- Decision unchanged: no production `HEAD_KIND` / `PART_MARKERS` edits, parser, ranking, or eligibility changes. Continue only with source-grounded diagnostic design and paired controls; no merge, deployment, or `main` modification.


## Next design step — separate subject identity from broad kind (2026-10-24)

### Source-code finding

The current `assessModelSpecificity` performs both a strong subject-phrase pass and a weak adjacency pass. In both passes, the shared-kind exemption is effectively:

`HEAD_KIND[marker] === queryKind`

That comparison knows only the broad kind, not whether the marker is the hunted part. Exact query-token markers are already skipped separately by `queryTokens.has(marker)`. Consequently, for a direct hunt for one part, the same-kind exemption can suppress a different part marker simply because both are `vehicle-part`. The synthetic counterexample captures that mechanism.

### Safer candidate policy to test (not implemented)

Do not use broad `vehicle-part` equality alone as permission to skip a different part marker. Separate:
1. **Broad kind** — vehicle vs vehicle-part, useful for rejecting whole-item/part-only contradictions.
2. **Principal subject identity** — the specific item named as the offer, when confidently recoverable.
3. **Co-offer evidence** — explicit evidence that the hunted subject and another item are both offered, rather than the hunted word appearing only in description context.

Candidate behavior:
- Whole-car hunt + part marker before the vehicle subject: reject (B03 negative).
- Whole-car title whose description mentions `کمک فنر`/`تایر` secondarily: preserve (D05 grade 3).
- Specific-part hunt + a different part as the principal title subject, with the target only mentioned in the description: do not let shared broad kind suppress the wrong-subject marker (mechanism-level synthetic counterexample; real source-matched case still missing).
- Specific-part hunt + title explicitly offering the target part alongside another part: allow only if the title-level subject/co-offer evidence actually establishes the target as an offered item; mere description mention is insufficient.
- Unknown principal subject or ambiguous title: no hard rejection from the proposed identity layer; preserve existing unknown/no-op behavior unless another independent guard fires.

### Evidence boundary and next gate

The frozen 05F source packet gives source-backed role-prefix and parts-inventory controls; D05 gives a human-grade-3 whole-vehicle positive with secondary part mentions. It does **not** yet contain a source-matched, human-graded false acceptance for a direct specific-part hunt where another same-kind part is the principal subject and the target is only contextual. Keep that counter-risk labelled synthetic until such a case is found or captured under a new, immutable experiment ID.

Next work is a test-only identity/co-offer prototype with a compact matrix for the cases above, then inspect both false-reject and false-accept outcomes. No changes to production `HEAD_KIND`, `PART_MARKERS`, `assessModelSpecificity`, ranking, or eligibility until that matrix is source-grounded and passes CI. No merge, deployment, or `main` modification.


## Subject identity / co-offer prototype — validation pending (2026-10-24)

A test-local helper and five assertions were added in commit `e8353365fb2a0e65362f06a871cde9ef4e3d2c0b`. The helper is not wired into production and does not alter `assessModelSpecificity`, `HEAD_KIND`, `PART_MARKERS`, ranking, or eligibility.

| Control | Evidence status | Intended diagnostic outcome |
|---|---|---|
| D05: whole Dena vehicle, `کمک فنر`/`تایر` only in description | Frozen source, human grade 3 | Preserve whole-car result; no specific-part identity rejection |
| H05F-B03: parts inventory with part marker before model names | Frozen source, human grade 1 | Reject for whole-car hunt |
| Brake disc principal title, catalyst only in body | Synthetic only | Reject direct catalyst hunt in subject-identity prototype |
| Brake disc and catalyst explicitly co-offered in title | Synthetic only | Allow only the explicit title-level co-offer in prototype |
| Unknown service-like principal subject | Synthetic only | Return unknown/no hard rejection |

The prototype uses a deliberately small local list of part subjects and explicit co-offer wording. It is a policy-boundary experiment, not a complete Persian title parser. In particular, the synthetic co-offer does not establish that conjunction detection is sufficient for production. No source-matched human-graded specific-part false acceptance has been recovered, so that evidence gap remains open.

The commit-associated status query returned no checks or workflow runs at the time of this update. Focused/full test validation is pending; do not claim the new assertions passed until an actual run is inspected. Decision remains: no production dictionary/parser/marker/ranking/eligibility change, no merge/deploy, and no `main` modification.


## Baseline #175 result and next audit boundary (2026-10-24)

Owner-reported run on test commit `e8353365`: **325 focused tests passed and 918 full portable tests passed**, +5 in each suite relative to #173/#174 (320/913). ESLint remains the workflow failure source; this is not a fully green workflow, although both test suites passed.

This confirms the test-local prototype is executable and its defined examples pass. It does not validate the prototype as a production parser or establish real-world search-quality improvement. Adversarially inspect:
- substring collisions, such as a shorter marker embedded in a longer word;
- overlapping matches, such as `دیسک ترمز` and `دیسک` matching the same title span;
- a generic conjunction elsewhere in the title being mistaken for a connector between target and another part;
- the first matched known part not being the listing's principal subject.

Next: add test-only edge cases for these risks and refine the prototype only where the examples show a deterministic distinction. Keep synthetic cases explicitly labelled. Continue seeking a source-matched, blinded human-graded specific-part false-acceptance case. No production change, merge, deployment, or `main` modification.


## Follow-up adversarial prototype cases (2026-10-24)

After Baseline #175, two additional synthetic edge cases were added on the test-only helper in commits `866fcd2` and `61ede4c`:

- A conjunction elsewhere in the title (e.g. service wording) must not count as a connector between the two part mentions.
- A short marker embedded in a longer marker (e.g. `دیسک` within `دیسک ترمز`) must not count as a second, distinct co-offered part.

The helper now checks whether the co-offer connector lies between non-overlapping part spans. These additions have **not yet been validated by a subsequent Baseline run**; the passing #175 counts apply to the earlier `e8353365` commit only. No production behavior changed. Next, run the focused and full portable suites on the latest test commit and inspect the result. Even if they pass, this remains a synthetic diagnostic policy, not a production-ready Persian subject parser.


## Validation update — Baselines #176 and #177 (2026-10-24)

- Baseline [#176](https://github.com/Nimadanesh/shakar/actions/runs/40091509616), on `866fcd2`, failed both focused and full portable test steps because the simultaneous-offer control returned `reject` instead of the intended `allow`. Typecheck and build passed; ESLint also failed separately.
- Baseline [#177](https://github.com/Nimadanesh/shakar/actions/runs/40091527448), on `61ede4c9cde19c6ff8855b268b1be28c182e3c4b`, has the owner-reported result **327 focused tests passed and 920 full portable tests passed**. Both test steps, TypeScript typecheck, and production build passed; ESLint remains the separate workflow failure source. Do not call the entire workflow green.
- The two added adversarial cases and the corrected explicit co-offer case are now test-validated on the latest source/test commit. This remains a synthetic test-local diagnostic, not a production parser and not evidence of real-world quality uplift.
- Decision unchanged: no production `HEAD_KIND`, `PART_MARKERS`, parser, ranking, or eligibility changes; no merge/deployment; `main` remains untouched.


## Follow-up — service-title co-offer counterexample (2026-10-24)

- Test-only commit [a66e7001](https://github.com/Nimadanesh/shakar/commit/a66e7001b6de35618bd4582b11de9d11bdcdc04c) adds a conservative offer-cue requirement to the shadow co-offer helper and two synthetic controls: a service title (`تعویض دیسک ترمز و کاتالیزور فرسوده`) must not be accepted as a product co-offer; a clear `موجود` title can still pass without the word `فروش`.
- Baseline [#178](https://github.com/Nimadanesh/shakar/actions/runs/40092192113) was queued when this note was written; validation is pending. Do not claim the new cases pass until its test steps finish.
- This addresses one additional ambiguity in the synthetic prototype only. It does not solve principal-subject identification generally and does not provide a source-matched human-graded false-acceptance example. No production behavior change, merge, deployment, or `main` change.


## Validation update — Baseline #178 (2026-10-24)

- Baseline [#178](https://github.com/Nimadanesh/shakar/actions/runs/40092192113) ran on test-only commit `a66e7001b6de35618bd4582b11de9d11bdcdc04c`.
- Focused suite: **329 passed, 15 skipped**. Full portable suite: **922 passed, 16 skipped**. TypeScript typecheck and production build passed.
- ESLint failed separately with **8 errors / 42 warnings** in existing UI and other unrelated files; therefore the workflow is not fully green. The new shadow tests did not fail.
- The two new synthetic controls are validated: service/repair wording without a clear product-offer cue does not pass as co-offer, while a title marked `موجود` can pass. This remains only a local diagnostic policy; it does not solve all principal-subject ambiguity and is not a source-backed human-quality result.
- No production behavior change, merge, deployment, or `main` modification.


## Follow-up — service cue overrides generic sale cue (2026-10-24)

- Test-only commit [8b96c3af](https://github.com/Nimadanesh/shakar/commit/8b96c3af9674231fa0cf6c2403bb0a79f9fc3475) adds a synthetic counterexample: `فروش خدمات تعویض دیسک ترمز و کاتالیزور`. A generic `فروش` token must not override explicit service/repair intent and turn a service listing into a product co-offer.
- Baseline [#179](https://github.com/Nimadanesh/shakar/actions/runs/40092326171) is queued; validation pending. The change remains test-local; no source-matched human-grade claim is made.
