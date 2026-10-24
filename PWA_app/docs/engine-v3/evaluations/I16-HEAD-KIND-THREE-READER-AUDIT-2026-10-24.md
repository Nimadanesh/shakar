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
