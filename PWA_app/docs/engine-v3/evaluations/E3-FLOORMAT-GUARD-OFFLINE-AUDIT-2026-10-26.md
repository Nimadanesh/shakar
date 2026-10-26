# E3 Floor-Mat/Flatbed Guard — Offline Audit

Date: 2026-10-26
Implementation snapshot originally audited: `engine_v3` / `01daf0f695de261da75f1db2c26be57ab80a2bf3`. Follow-up test-only evidence is maintained on `experiment/e3-floormat-guard-audit-20261026`.
Scope: source and regression-test audit only; no runtime behavior changed.

## Verified implementation

- `floorMatFlatbedConflict(query, title, description)` is in `PWA_app/src/lib/server/hunt/semantics.ts`.
- The guard activates only when the query contains both `کفی` and `ماشین`, and excludes explicit `تریلی`/`تریلر` queries.
- It requires `کفی` in the listing text and returns a conflict only when one of the closed cue phrases matches.
- `PWA_app/src/lib/server/hunt/pipeline.ts` invokes the guard at line 719 of the audited source, before the ordinary MUST-completeness decision, so a partial lexical match can be excluded.
- The original pipeline regression block had two synthetic controls: a trailer listing rejected for `کفی ماشین`, and a trailer listing retained for explicit `کفی تریلی`. Later source-artifact excerpt tests expanded the evidence set; neither the synthetic tests nor excerpt tests establish full-listing false-rejection safety across the full cue list.

## Source-matched human evidence and limits

The existing E3 evaluation records the following human judgments for the explicitly intended automotive-floor-mat hunt:

- `gaI0HKIy`, title `ضبط پخش سیستم باند کف پوش ماشین`: grade 2; the mat is genuinely offered but is secondary to audio equipment.
- `ga4uraIe`, title `تودوزی.تعمیر صندلی.کفپوش سه بعدی.کفی یه تیکه`: grade 2; a service listing includes floor mats, but a standalone product offer is unclear.
- `gaYfZnPP`, title `کفی مبلی نیسانی`: INSUFFICIENT; the phrase is ambiguous and must remain unknown.
- `gaYDXysD`, title `کفی تریلر`: grade 0.
- `gaYf5rLj`, title `فروش جرثقیل ۱۰ تن کفی اطلس سالم`: grade 0.

The original GitHub Actions artifact `engine-v3-detail-allocation-multi-4` (workflow run [39740034802](https://github.com/Nimadanesh/shakar/actions/runs/39740034802)) was recovered and inspected. It contains exact `title` and `descriptionExcerpt` fields for these records, but not complete original Divar descriptions. Those frozen excerpts can be replayed as excerpts; they must not be described as full-text snapshots.

## Decision

- **Do not add, remove, or broaden cues in this audit.** The two grade-2 cases are relevant false-rejection risk witnesses, but without their exact frozen descriptions it is unverified whether any current cue actually fires on either listing.
- Do not interpret the absence of a demonstrated false rejection as proof of safety.
- Do not use synthetic paraphrases as replacements for missing source snapshots.
- Preserve the existing positive controls and the explicit `کفی تریلی` counter-intent.
- The next evidence action, if the exact snapshots become available from the original artifact, is a test-only replay through the real `floorMatFlatbedConflict`/pipeline path, recording the matched cue (or no match) for each source record. Until then, the cue-list false-rejection risk remains **OPEN / UNVERIFIED**.
- No production change, merge, deployment, or `main` change was made or authorized by this audit.


## Title-only guard probe — 2026-10-26

Added a test using the exact recorded titles for the two grade-2 witnesses (`gaI0HKIy`, `ga4uraIe`) and the INSUFFICIENT witness (`gaYfZnPP), each with an intentionally empty description. All three title-only inputs return no flatbed conflict. This isolates title contribution only; it is **not** a source-matched full-text replay and says nothing about cues that might appear in the missing descriptions.

- Test commit: `e992f4a1ac7c830c0a481e6c63cc4d0c0b63296b`.
- Workflow [40303749947](https://github.com/Nimadanesh/shakar/actions/runs/40303749947) completed successfully: locked install, focused exchange tests, portable hunt/search tests (including the new title-only probe), TypeScript typecheck, and targeted ESLint all PASS.
- The full frozen descriptions remain unavailable. Do not infer guard safety from this partial probe; risk remains OPEN / UNVERIFIED. Do not modify the cue list or synthesize missing descriptions.


## Frozen artifact excerpt replay — 2026-10-26

Recovered artifact: `engine-v3-detail-allocation-multi-4`, run [39740034802](https://github.com/Nimadanesh/shakar/actions/runs/39740034802). Added a regression test using the artifact's exact recorded title and `descriptionExcerpt` fields for grade-2 witnesses `gaI0HKIy` and `ga4uraIe`, plus the INSUFFICIENT witness `gaYfZnPP`. None triggers `floorMatFlatbedConflict` for query `کفی ماشین`.

- Test commit: `4b6f74b4884c405ee7b550dc3f21670c9f661799`.
- The descriptions are **frozen excerpts only**, not complete original Divar descriptions; no claim is made about omitted text.
- Workflow [40305241230](https://github.com/Nimadanesh/shakar/actions/runs/40305241230) completed successfully: locked install, focused exchange tests, portable hunt/search tests (including the excerpt replay), TypeScript typecheck, and targeted ESLint all PASS.
- No cue-list change, production behavior change, new capture/grade, Issue 16 restart, merge, deployment, or transfer to `engine_v3`. Full-listing false-rejection risk remains **OPEN / UNVERIFIED**.


## Expanded frozen-excerpt control replay — 2026-10-26

The pipeline test now covers seven frozen artifact records using their recorded `title` and `descriptionExcerpt` fields, preserving the source excerpt text (including punctuation/markers) rather than normalizing it:

- Grade 2: `gaI0HKIy`, `ga4uraIe` — no flatbed conflict.
- INSUFFICIENT: `gaYfZnPP` — no conflict; ambiguity remains unknown, not a rejection.
- Positive automotive-mat controls: `gagsCTyG`, `gaXjCsU5` — no conflict.
- Hard negatives: `gaYDXysD` (`تریلی`) and `gaYf5rLj` (`جرثقیل`) — the expected explicit cue is returned.

These remain excerpt-level tests, not full-description replays. They test the existing guard only; no cue list or production behavior was changed. Workflow [40305511188](https://github.com/Nimadanesh/shakar/actions/runs/40305511188) passed locked dependency installation, focused tests, portable hunt/search tests, TypeScript, and targeted ESLint on commit `5195194a566d0ed7738cc519476125d945e752ea`. The follow-up correction at commit `fecf0910318e37e8da59bdcbdd097e9882af26e3` preserves the recovered excerpt literals, including punctuation/markers and trailing spaces where present. Workflow [40306804900](https://github.com/Nimadanesh/shakar/actions/runs/40306804900) also passed locked install, focused tests, portable hunt/search tests, TypeScript, and targeted ESLint. Full-listing false-rejection risk remains **OPEN / UNVERIFIED**.


Final verification: verbatim-excerpt test commit `fecf0910318e37e8da59bdcbdd097e9882af26e3` passed [workflow 40306804900](https://github.com/Nimadanesh/shakar/actions/runs/40306804900). The guard was not changed; this closes only the test-input fidelity/CI step, not the broader false-rejection risk.


## Cue-by-cue evidence coverage — 2026-10-26

This is a coverage inventory of the current closed cue list, not a recommendation to expand it. It distinguishes direct source-artifact evidence from cues that have not been exercised by the new frozen-record replay.

| Current cue | Evidence in the frozen excerpt replay | Current conclusion |
|---|---|---|
| `تریلی` | Hard negative `gaYDXysD`, title `کفی تریلر`, excerpt `سلام تریلی چرخ 24` | Expected rejection cue asserted. |
| `تریلر` | Appears in title `کفی تریلر`; guard returns first matching cue `تریلی` from the ordered cue list | Trailer family is covered, but the `تریلر` return value is not independently asserted. |
| `جرثقیل` | Hard negative `gaYf5rLj` | Expected rejection cue asserted. |
| `سه محور`, `دو محور`, `رول کش`, `کالابرس`, `ایران کاوه`, `مارال`, `ماموت`, `فوکس شاهنگ`, `آهنکش`, `باربند`, `کانتینربر`, `کانتینر`, `تیغه`, `بالونی`, `حمل بار`, `ماشین باری`, `باربندخاص` | No independently asserted cue-level source-artifact test in this replay | Not validated by this replay; keep unchanged. |
| `مانیتور`, `هدلایت`, `صوت تصویر`, `سیستم صوتی` | Audio-adjacent grade-2 witness `gaI0HKIy` has title `ضبط  پخش سیستم  باند  کف پوش ماشین`, but its excerpt does not independently prove each cue's behavior | This one listing is not sufficient to validate the full audio cue family; no inference beyond its actual no-conflict assertion. |

The grade-2 service/mat witness `ga4uraIe` also returns no conflict on its frozen excerpt. Positive controls `gagsCTyG` and `gaXjCsU5` remain no-conflict checks. The INSUFFICIENT witness `gaYfZnPP` is explicitly a no-conflict check, not a positive relevance label.

**Next bounded evidence action:** if continuing this audit, retrieve/inspect only already-existing frozen artifact records and map each current cue to a source record where it appears, then replay the existing function without changing cues. Do not create new capture, new human grades, or live requests as a substitute for missing evidence. If no source record supports a cue, record that gap rather than inventing a test fixture.


## Archived-record cue replay inventory — 2026-10-26

The 59 frozen records with title plus excerpt from the archived JSON artifact in run [39740034802](https://github.com/Nimadanesh/shakar/actions/runs/39740034802) have now been replayed through the real exported TypeScript `floorMatFlatbedConflict` function in `floorMatFlatbedArchivedReplay.test.ts`. The characterization test passed on commit `91fe5e964bb2cc2ec5b50160bbf62a8847e2ac5e` in [workflow 40309565898](https://github.com/Nimadanesh/shakar/actions/runs/40309565898); the run completed the focused tests, portable hunt/search tests, TypeScript typecheck, and configured targeted ESLint. A follow-up correction to the diagnostic field name passed the same validation in [workflow 40309625470](https://github.com/Nimadanesh/shakar/actions/runs/40309625470). The final refinement adding an explicit `textMatches` count also passed in [workflow 40309715648](https://github.com/Nimadanesh/shakar/actions/runs/40309715648) on commit `6a0913e6b9c82d3bca5e14e6ac3b99c0b7f55972`.

### Record accounting

- The first query has 79 occurrences across the nested disagreement/top-20 groups and 59 distinct IDs there. The separate `sampledTail` contains 20 IDs, 19 of which overlap those 59; it adds one more unique ID, so the artifact's query total is **60 unique source IDs**. The one tail-only ID is `gaAJZPKP`, title `با کپی کارت ملی ماشینتو ۱۰ماهه روکش کفی کن`; it has only title/rank, not a description excerpt. The current text replay therefore covers 59 records with title plus excerpt, not all 60 source IDs.
- The real TypeScript `normalizeForMatch`/`textMatches` helpers confirm 57 of the 59 excerpt-bearing records match `کفی`; 2 do not and therefore cannot trigger this guard.
- The real `floorMatFlatbedConflict` function returns a conflict for 30 records and `null` for 29 records overall. Among the 57 that match `کفی`, 27 return no cue. These are **observed current-rule outcomes**, not labels of relevance or proof that every rejection is correct.
- The replay uses only the frozen `title` and `descriptionExcerpt` values. It cannot detect cues in omitted full-description text.

### First cue returned by the current ordered list

Counts below are first-match counts, not total cue occurrences. Earlier cues can shadow later cues in the same record.

| First returned cue | Count | Source examples |
|---|---:|---|
| `تریلی` | 8 | `gaYDXysD`, `gaYrmNKn`, `gaYDVHLC`, `gaYzEo7U` |
| `تریلر` | 1 | `gaYrX8Nb` |
| `سه محور` | 5 | `gaXHuaUP`, `gaXvb8JG`, `gaXrHQw8`, `gaXH2jOT` |
| `دو محور` | 1 | `gaVnJ_p0` |
| `رول کش` | 2 | `gaYfYfl4`, `gaVrxMEP` |
| `کالابرس` | 1 | `gaUv8moP` |
| `ایران کاوه` | 1 | `gaY3kLJH` |
| `مارال` | 3 | `gaYT16dC`, `gaw6Mv67`, `gaUrqiuA` |
| `ماموت` | 2 | `gaYr1vVd`, `gaXHKR8g` |
| `فوکس شاهنگ` | 1 | `gaYbITzV` |
| `جرثقیل` | 1 | `gaYf5rLj` |
| `باربند` | 1 | `gaA3NPYd` |
| `کانتینر` | 1 | `gaVntodQ` |
| `حمل بار` | 1 | `gaYX109c` |
| `ماشین باری` | 1 | `gaVQu1V9` |

The other 27 records with a `کفی` match have no matching cue in the frozen excerpt. The real TypeScript replay produced no first-match hits for `آهنکش`, `کانتینربر`, `تیغه`, `بالونی`, `باربندخاص`, `مانیتور`, `هدلایت`, `صوت تصویر`, or `سیستم صوتی`; this does **not** mean those strings are absent from all records, only that none became the first returned cue in this replay. For example, `تیغه` can be present but shadowed by an earlier cue.

### Interpretation and next action

- The known hard negatives still show the expected first cue in this replay: `gaYDXysD` → `تریلی`; `gaYf5rLj` → `جرثقیل`.
- The grade-2 and INSUFFICIENT witnesses remain excerpt-level no-conflict controls as previously tested by TypeScript tests; do not convert the artifact's engine labels into human judgments.
- The broad cue inventory reveals more exercised terms than the seven-record regression set, but it does not establish semantic precision for the other cue families. Several records are trailer/flatbed advertisements by title and naturally collide with multiple cues.
- **Next step:** reconcile the final logged counts with the report, then decide whether any cue merits counterevidence collection. Do not change cues merely because they fired on trailer-like records; keep correctness assertions limited to the existing human-grounded controls. Keep assertions for correctness limited to the already human-grounded controls; treat other outputs as observations, not newly approved expected outcomes. No cue changes, production behavior changes, human grades, new capture, live retrieval, merge, deployment, or branch transfer are authorized.

