# E3 Query Intent — `کفی ماشین` (01)

Date: 2026-10-22  
Branch: `engine_v3`  
Status: **design only — no engine behavior changed**

## Question

Can the deterministic Query Understanding layer interpret `کفی ماشین` as automotive floor mats for this intended hunt, while rejecting trailer/flatbed listings and preserving legitimate searches for trailer flatbeds in other contexts?

The human evaluator explicitly established that the intent in allocation experiment E3-DETAIL-ALLOCATION-MULTI-04 was **automotive floor mats**. That intent is ground truth for this evaluation, not proof that every unqualified future user entering the same phrase always means floor mats.

## Evidence motivating the test

The human-graded source-matched disagreement sample contained 16 candidates for this intent:
- baseline-only: 1 exact floor-mat result and 7 irrelevant trailer/flatbed-family results;
- alternative-only: 1 exact floor-mat result and 7 irrelevant trailer/flatbed-family results.

This is a small diagnostic sample, not a population estimate. It demonstrates a wrong-kind/intent failure family, not that allocation choice caused it. The two allocation arms had identical top-20 results in the preceding report.

## Frozen controls to preserve

### Positive floor-mat controls

Use exact source records from the completed artifact; do not reconstruct or paraphrase titles.

- E17, source ad `gaYjJe4y`, title rank 81: `لاستیک و کف پوش ماشین` — human grade 3. The engine had called this `near`, making it a useful false-negative/under-ranking control.
- E19, source ad `gaXjCsU5`, title rank 138: `کفی سه بعدی نمدی فابریکی اطلس` — human grade 3. The engine had called this `near`, making it a useful false-negative/under-ranking control.
- Additional ungraded positive leads: source ad `gaYjY0nM`, rank 84, `کفی لاستیکی خودرو`; and source ad `gaY3VCQ7`, rank 94, `کفی سه بعدی کوییک`. Verify details before assigning gold grades.

### Hard negatives

These source records are present in the artifact and should be preserved as exact fixtures:

- E14 / source ad `gaA3NPYd`, title rank 90: `آریسان ۲ با کفی و باربند` — human grade 0 for floor-mat intent; the vehicle is being sold with a flatbed/bar.
- Source ad `gaYDXysD`, rank 91: `کفی تریلر`; excerpt says `سلام تریلی چرخ 24`.
- Source ad `gaYrmNKn`, rank 92: `کفی تریلی ۲محور رول کش بالونی ۱۲/۶۰`.
- Source ad `gaY3kLJH`, rank 100: `کفی ایران کاوه`.
- Source ad `gaWrknHH`, rank 153: `کفی تریلی خوزستان شوش`.
- Source ad `gaUv8moP`, rank 193: `کفی دو مهور`.
- Source ad `gaUrqiuA`, rank 198: `کفی مارال ۱۳/۷۰`.
- Include trailer tarp/service listings and vehicle listings where `کفی` means a flatbed/body rather than a cabin floor mat; retain the exact source excerpt.

The source IDs and original title ranks above identify records from the completed artifact; they do not imply human grades for the ungraded records. Do not generalize from the token `کفی` alone—use the complete listing context.

## Code-path audit (2026-10-22)

Current implementation inspected on `engine_v3`:

- `buildContract("کفی ماشین")` treats the words as an ordinary subject phrase; the contract's `kind` is deliberately `UNKNOWN`.
- `resolveHuntDefinition` merges that subject into MUST/include terms, so the hunt carries lexical terms but no explicit floor-mat entity kind.
- `queryKindForDef` only resolves a subject kind from the closed `HEAD_KIND` lexicon, then service intent/category fallbacks. There is no entry for this compound, so the query kind remains unknown when the category does not provide a bridge.
- The kind gate is evaluated only on a fully MUST-matched candidate. The title-only ad-kind resolver also has no closed kind for the trailer/flatbed family. As a result, partial lexical matches can remain `near` without a wrong-kind verdict.

This means the confirmed failure is not safely fixed by adding `"کفی": "vehicle-part"`: that would classify the trailer's own flatbed as the same kind as a floor mat. Nor is it safe to silently hard-code every bare `کفی ماشین` query to floor mats: the phrase can be ambiguous outside this labeled evaluation.

## Narrow implementation boundary

The next code change must make the intended subject kind explicit and preserve it through `HuntDefinition`/resolution, then compare it against listing kind using title **and detail text** where available. The initial evaluation can use an explicit floor-mat intent fixture derived from the human-labeled task; the counter-control must explicitly request a trailer flatbed. Do not change the meaning of ambiguous live user queries without a product-level confirmation/default decision.

## Test design

1. **Freeze a source-matched fixture set.** Store exact title, description excerpt, source ad ID, original retrieval rank, and provenance. Keep human grades and source IDs immutable.
2. **Separate query interpretation from listing interpretation.** Record the structured query interpretation (intended entity/product kind, MUST/MUST NOT, confidence/ambiguity) before examining the candidate verdict. Do not let ranking alone compensate for a wrong query kind.
3. **Paired baseline.** Run current deterministic Query Understanding and the proposed narrow variant against the same frozen candidates, with the same retrieval and detail budget. Do not call Divar or change allocation during this offline comparison.
4. **Positive preservation.** Both human-graded floor-mat controls must remain eligible and must not be rejected by a wrong-kind gate. Evaluate whether intent-aware ranking moves them upward. A human grade of 3 is not itself a command to force the engine's `matchKind` to `exact`; exactness must still follow the evidence contract.
5. **Hard-negative suppression.** Trailer/flatbed records must not be exact or near for this explicitly floor-mat intent. Prefer an intent-scoped wrong-kind rejection over a global `کفی` ban.
6. **Counter-intent guard.** Add a separate control query explicitly asking for a trailer/flatbed (`کفی تریلی` or an equivalent explicit phrase). Relevant trailer listings must remain eligible for that different intent.
7. **Unknown/ambiguous behavior.** If a future query lacks enough context to disambiguate, preserve UNKNOWN or ask for clarification rather than silently hard-coding every `کفی ماشین` query to one meaning.
8. **Inspect false rejections.** Report positive-control losses separately from false-positive reductions; never report only the negative win.

## Acceptance gate

Do not modify engine behavior until:
- exact source records and the additional controls are verified;
- the query-intent decision is explicit and testable;
- both human-graded floor-mat positives remain eligible (and their ranking is measured);
- all selected trailer/flatbed hard negatives are rejected for the floor-mat intent;
- the explicit trailer/flatbed counter-intent still retrieves relevant trailer listings;
- focused tests, full portable suite, typecheck, and build pass.

A passing synthetic fixture is necessary but not sufficient for rollout. After deterministic tests pass, run a fresh bounded live observation and obtain blinded human grades on unique top results and rejected/near-miss candidates. No production allocation change, main merge, or deployment is authorized by this plan.

## Current decision

**Do not implement a broad lexicon/synonym change yet.** A global `کفی` → `vehicle-part` mapping would risk classifying trailer flatbeds as accessories and could make the exact failure worse. The next implementation should be driven by the verified query-intent representation and paired controls above.
