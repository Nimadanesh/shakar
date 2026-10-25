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

The full frozen title/description snapshots for `gaI0HKIy` and `ga4uraIe` were not found in the repository tree or the inspected evaluation documents during this audit. Their recorded grades and titles are available, but their full source text cannot be reconstructed safely from the partial records. Consequently, they cannot yet be replayed as exact source-matched fixtures.

## Decision

- **Do not add, remove, or broaden cues in this audit.** The two grade-2 cases are relevant false-rejection risk witnesses, but without their exact frozen descriptions it is unverified whether any current cue actually fires on either listing.
- Do not interpret the absence of a demonstrated false rejection as proof of safety.
- Do not use synthetic paraphrases as replacements for missing source snapshots.
- Preserve the existing positive controls and the explicit `کفی تریلی` counter-intent.
- The next evidence action, if the exact snapshots become available from the original artifact, is a test-only replay through the real `floorMatFlatbedConflict`/pipeline path, recording the matched cue (or no match) for each source record. Until then, the cue-list false-rejection risk remains **OPEN / UNVERIFIED**.
- No production change, merge, deployment, or `main` change was made or authorized by this audit.
