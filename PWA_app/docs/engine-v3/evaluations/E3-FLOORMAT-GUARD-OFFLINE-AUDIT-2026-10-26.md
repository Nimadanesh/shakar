# E3 Floor-Mat/Flatbed Guard — Offline Audit

Date: 2026-10-26
Audited branch/head: `engine_v3` / `01daf0f695de261da75f1db2c26be57ab80a2bf3`
Scope: source and regression-test audit only; no runtime behavior changed.

## Verified implementation

- `floorMatFlatbedConflict(query, title, description)` is in `PWA_app/src/lib/server/hunt/semantics.ts`.
- The guard activates only when the query contains both `کفی` and `ماشین`, and excludes explicit `تریلی`/`تریلر` queries.
- It requires `کفی` in the listing text and returns a conflict only when one of the closed cue phrases matches.
- `PWA_app/src/lib/server/hunt/pipeline.ts` invokes the guard at line 719 of the audited source, before the ordinary MUST-completeness decision, so a partial lexical match can be excluded.
- The current pipeline regression block has two controls: one trailer listing rejected for `کفی ماشین`, and the same kind of listing retained for explicit `کفی تریلی`. These establish the query-boundary behavior, not false-rejection safety across the full cue list.

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
- Workflow [40305241230](https://github.com/Nimadanesh/shakar/actions/runs/40305241230) was queued when this note was written; validation outcome must be checked before treating the test as green.
- No cue-list change, production behavior change, new capture/grade, Issue 16 restart, merge, deployment, or transfer to `engine_v3`. Full-listing false-rejection risk remains **OPEN / UNVERIFIED**.
