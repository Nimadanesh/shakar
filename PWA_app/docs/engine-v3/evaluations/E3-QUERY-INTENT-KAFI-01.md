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

## Implementation status (2026-10-22)

A first **narrow, query-scoped guard** has now been added on `engine_v3`:

- `floorMatFlatbedConflict` only activates when the query contains both `کفی` and `ماشین`, and does not activate for explicit `تریلی`/`تریلر` queries.
- It uses a closed set of high-signal flatbed cues from the verified E3 records (e.g. تریلی/تریلر, محور, رول‌کش, ایران کاوه, مارال, ماموت, جرثقیل, باربند).
- It runs before MUST-completeness scoring so a candidate that matches only `کفی` cannot survive as `near` when the listing explicitly identifies a flatbed.
- It does not globally assign a kind to `کفی` and does not change detail allocation.

Focused unit tests and pipeline-level counter-control tests have been added. GitHub Actions is running; **the patch is not yet validated**. If checks pass, the next gate is a bounded read-only live replay plus blinded grading of both retained floor-mat candidates and rejected flatbed candidates. The cue list must be audited for false rejections before any broader use. No main merge or deployment.


## Human review and bounded live observation — 2026-10-22

### Human grades for retained live candidates

The evaluator graded all three retained candidates as **3 (exactly relevant)** for the explicitly intended automotive floor-mat query:

| Candidate | Source ad ID | Human grade | Additional observation |
|---|---|---:|---|
| `کفی ماشین کوییک نو` | `gaYfODFa` | 3 | Direct positive control from live observation |
| `کفی ماشین` | `gaZjj5GY` | 3 | Complete set and correct product; driver-side mat has a stain |
| `کفی قالبی یه تیکه پرایدی` | `gaZftRr4` | 3 | Directly relevant molded one-piece floor mat |

**Annotation policy learned from candidate B:** keep relevance grade 3. Record the stain as a condition/quality observation, not as a relevance penalty. This preserves the distinction between *is it the requested item?* and *what is its condition?* It is consistent with the evaluator's H09 lesson. Do not rewrite a relevance grade to encode condition defects.

### Bounded live observation

- Workflow: [Live observation run 39756287700](https://github.com/Nimadanesh/shakar/actions/runs/39756287700)
- Branch/commit observed: `engine_v3` / `97bf6101c779f903f613cca0c1a5ae22f89ffa82`
- Read-only limits: 2 list pages and 8 detail checks per query; no Mizan shadow writes.
- For `کفی ماشین`: 49 ads seen, 48 candidates after duplicate collapse, 8 details checked, 3 confirmed, 2 near misses, 5 rejected as no match, no stale data.
- The three surfaced candidates above were human-graded 3. Two earlier monitor/audio false-positive patterns did not appear in this bounded top-result sample. This is a useful observed signal, **not proof of population-wide precision or complete false-positive removal**.
- The live observation is not a paired baseline-vs-patch quality comparison; no before/after uplift claim is justified.

### Positive and negative control accounting

- Previously human-graded floor-mat controls remain: `gaYjJe4y` (`لاستیک و کف پوش ماشین`, grade 3) and `gaXjCsU5` (`کفی سه بعدی نمدی فابریکی اطلس`, grade 3). These came from the frozen source-matched artifact; this new live run did not independently re-fetch or re-grade them.
- Previously graded hard negative `gaA3NPYd` (`آریسان ۲ با کفی و باربند`) remains grade 0 for floor-mat intent. Other trailer/flatbed examples in the frozen artifact are useful negative controls, but do not assign new human grades to them without reviewing the exact records.
- Counter-intent `کفی تریلی` must continue to retrieve relevant flatbed listings. Unit and pipeline tests cover the explicit-trailer counter-control; a fresh live counter-intent observation and full blinded negative review are still outstanding.

### Validation status and next gate

- Bounded read-only live observation: **PASS as a run**, with the limitations above.
- Human grades for three retained candidates: **3/3 exact**.
- Focused tests, portable suite, typecheck, and production build passed in the baseline workflow; ESLint failed with 8 `react-hooks/set-state-in-effect` errors in unrelated UI files (including `KaminDetailSheet.tsx`, `BottomTabBar.tsx`, `MarketSheet.tsx`, `HomeCityUpdateNudge.tsx`, `HuntProgress.tsx`, `SearchSheet.tsx`, `HomeCityRow.tsx`, and `useProfile.ts`). The run also reports existing warnings. This is not a clean all-checks pass.
- Next: build a source-ID-matched blinded packet of rejected trailer/flatbed candidates and retained floor-mat candidates; reuse prior grades only for exact ID matches. Obtain a fresh bounded observation for explicit `کفی تریلی`, verify the positive controls against exact source details, and measure both false-positive suppression and positive preservation before deciding whether to keep/refine the cue list.
- No merge, deployment, production allocation change, or broad quality claim is authorized.


### Explicit flatbed counter-intent — fresh live check

- Workflow: [Live observation run 39758555126](https://github.com/Nimadanesh/shakar/actions/runs/39758555126)
- Commit: `554686fa7d58932e0835b5b32475b4ea6dd34435`; the read-only harness now includes `کفی تریلی`.
- Query `کفی تریلی`: 49 ads seen, 48 after duplicate collapse, 8 details checked, 7 confirmed, 0 near misses, 1 rejected; no stale data.
- Top confirmed examples included `gaAhLdl5` (`تریلی کفی و لبه و‌تیغه`), `gaZDdTtK` (`تریلی کفی سه محور`), `gaYLnuaK` (`تریلی کفی ۱۳۷۰ مارال جارولیدار`), and `gaZTrXq5` (`تریلی کفی`). This is strong evidence that the narrow `کفی ماشین` guard did not globally ban trailer-flatbed listings. The eight-detail cap means it does not establish full-query recall.
- In the same fresh run, `کفی ماشین` returned four top candidates, including a newly observed positive lead `Aafm5Bsf` (`پک کامل روکش صندلی ، کفی ، دورفرمان`), with detail describing a three-piece set including a 3D floor mat. This candidate has **not yet been human graded**; add it to the positive-preservation packet rather than assuming its grade.
- Fresh `کفی ماشین` counts: 49 ads seen, 49 after duplicate collapse, 8 details checked, 4 confirmed, 3 near misses, 4 rejected; no stale data. The three already graded candidates remained in the top four and retain grade 3.
- These two query observations are not a paired baseline comparison. Next, human-grade `Aafm5Bsf` and a source-matched sample of rejected flatbed candidates. Do not claim a measured uplift or broad recall guarantee.


### Human grade received — Aafm5Bsf (2026-10-22)

- Source ad `Aafm5Bsf`: `پک کامل روکش صندلی ، کفی ، دورفرمان` — provisional human grade **2 (relevant, not exact; evaluator marked it as a draft)** for the explicitly intended automotive-floor-mat hunt.
- Evaluator rationale: the 3D floor mat is genuinely included, but it is one of three components in a complete seat-cover / floor-mat / steering-wheel-cover package, rather than the listing's sole or central product. This follows the E34 distinction (a relevant but non-central item receives 2) and contrasts with E17 (`لاستیک و کف پوش ماشین`), where the floor covering is co-present as a titled item in a two-item listing and received 3.
- Annotation rule: grade the role/salience of the requested product within the listing, not mere token presence. A target product included as one component of a multi-item package can be grade 2; do not automatically call it exact.
- Existing grade-3 candidates `gaYfODFa`, `gaZjj5GY`, and `gaZftRr4` remain unchanged. The stain on `gaZjj5GY` remains a separate condition annotation, not a relevance penalty.
- Next: inspect a source-ID-matched packet of floor-mat positives and trailer/flatbed-family candidates using exact frozen titles/excerpts. Keep the human grade, engine verdict, and condition annotation as separate fields. No merge/deploy or population-level quality claim.


### Human review — ambiguous and mixed-role candidates (2026-10-22)

For the explicitly intended automotive-floor-mat hunt, the evaluator reviewed eight candidates in the latest audit:

| Source ad | Listing title | Human grade | Annotation |
|---|---|---:|---|
| `gaI0HKIy` | `ضبط پخش سیستم باند کف پوش ماشین` | 2 | A floor mat is genuinely offered, but the listing is centered on audio equipment. |
| `gaYfZnPP` | `کفی مبلی نیسانی` | INSUFFICIENT | Ambiguous between a Nissan pickup cargo bed/platform and a cabin floor mat; context does not disambiguate. Excluded from relevance denominators. |
| `gaYjY0nM` | `کفی لاستیکی خودرو` | 3 | Direct match; two sets are offered. |
| `gaYfYfl4` | `اجاره کفی` | 0 | Rental of a three-axle roll-curtain flatbed, not an automotive cabin mat. |
| `ga4uraIe` | `تودوزی.تعمیر صندلی.کفپوش سه بعدی.کفی یه تیکه` | 2 | Service listing that includes floor mats; not clearly a standalone product sale. |
| `gaYDXysD` | `کفی تریلر` | 0 | Explicit trailer flatbed, wrong intent for this query. |
| `gaY3VCQ7` | `کفی سه بعدی کوییک` | 3 | Direct match. |
| `gaYf5rLj` | `فروش جرثقیل ۱۰ تن کفی اطلس سالم` | 0 | Crane/flatbed listing, not a cabin floor mat. |

Grade 3 remains about relevance to the requested item; condition defects are annotated separately. A real but non-central component can be grade 2. `INSUFFICIENT` means evidence cannot resolve the intended item and is not a grade of zero.

### Corrective change — do not hard-reject `کفی مبلی` alone

The previous guard treated the closed cue `کفی مبلی` as definitive flatbed evidence. That is overconfident for `کفی مبلی نیسانی`: the human evaluator marked the source listing INSUFFICIENT because both cargo-platform and cabin-mat interpretations remain plausible. The cue was removed from the hard-rejection list and a regression test now asserts that this ambiguous title/detail pair is left untouched. Clear trailer/flatbed cues and the explicit `کفی تریلی` counter-intent remain in place.

This is a narrow guard correction, not a general semantic resolution for the phrase. The ambiguous record remains unknown; it must not be silently relabeled as a floor mat or flatbed. Validation of the new commits is pending CI/results inspection. No merge, deployment, or production allocation change.


### Post-correction CI and live observation (2026-10-22)

- Regression commit: `3bf9bc12df7e50bb018950e17c19c6cb08991138`.
- Baseline workflow: [run 39767995269](https://github.com/Nimadanesh/shakar/actions/runs/39767995269). Focused hunt/search tests, full portable suite, TypeScript typecheck, and production build all passed. ESLint remains the only failing step: 8 `react-hooks/set-state-in-effect` errors in pre-existing UI files; this does not establish a failure in the changed search guard. The run is therefore **not a clean all-checks pass**.
- Bounded read-only live observation: [run 39767995345](https://github.com/Nimadanesh/shakar/actions/runs/39767995345), on the regression commit. It completed successfully with 5 query scenarios, at most 2 list pages and 8 detail checks per query, and no Mizan shadow writes. These are unjudged observations, not relevance grades or a paired quality comparison.
- `کفی ماشین`: 49 ads seen, 49 after filters, 8 details checked, 2 confirmed, 1 near miss, 6 rejected; no stale data. The visible top results were `gaZvu9P8` (`ست کف پایی و کفی صندوق ماشین تارا،بسیار تمیز ونو`) and `gaZjj5GY` (`کفی ماشین`, demoted by bait). The previously human-graded ambiguous `کفی مبلی نیسانی` was not among these surfaced top results, so the run does **not** directly validate its new treatment.
- `کفی تریلی`: 49 ads seen, 48 after duplicate collapse, 8 details checked, 7 confirmed, 0 near misses, 1 rejected; no stale data. Examples include `gaAhLdl5`, `gaZDdTtK`, and `gaYLnuaK`. This supports preservation of explicit trailer intent within the bounded sample, not a full recall guarantee.
- `پیانو اکوستیک`: 50 ads seen, 49 after duplicate collapse, 8 details checked, 8 confirmed, 5 near misses, 0 rejected. The top 8 included `gaiCb1F-` (`تولید انحصاری پیانو طرح آکوستیک ست کامل 160 میلیون`) at rank 6 as a near match demoted by cap. This remains a live quality concern for the separate piano-identity scenario; do not infer it is solved by the kafi guard change.
- `تعمیر یخچال`: 50 ads seen, 50 after filters, 8 details checked, 8 confirmed, 2 near misses, 0 rejected. `ماشین بدون رنگ`: 50 ads seen, 8 details checked, 5 confirmed, 5 near misses, 3 rejected. No stale data in these bounded observations.
- Slug capture was buffered (8 attempted per scenario) but wrote 0 in this hosted run; the observation remains useful for bounded top-result review, but it did not persist the slug capture buffer as direct output.
- Overall gate: the ambiguous hard-rejection correction is committed and focused tests pass. Keep the change on `engine_v3`; no merge, deployment, or production allocation change. Next quality gate is a source-ID-matched human review of the new `کفی ماشین` live candidates and a separate targeted review of `طرح آکوستیک` false positives. Do not claim a general search-quality uplift from this run.
