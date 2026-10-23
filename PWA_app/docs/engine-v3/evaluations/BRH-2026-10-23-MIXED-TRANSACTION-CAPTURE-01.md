# BRH mixed-transaction capture — first bounded result (2026-10-23)

## Provenance

- Workflow: [Engine V3 Mixed Transaction Packet Capture, run 39970882822](https://github.com/Nimadanesh/shakar/actions/runs/39970882822)
- Capture commit: `e4aba4d8d30213ba44f47fcd893bc05889e4942d`
- Artifact: `engine-v3-mixed-transaction-packet-capture`
- Read-only Divar capture; Node 24.21.0; `MIZAN_SHADOW=0`.
- Limits: six scenarios, at most four pages per query, at most 12 detail reads total. All 12 detail reads were used.

## Capture outcome

- 12 unique source listing IDs across the `home` and `music` categories.
- Six intent scenarios: seek seller, generic product search, and seek buyer for refrigerators and pianos.
- All 12 selected listings have a full description snapshot marked available.
- The report's `sampleRank` is a position in the sampled candidate pool, **not production rank**; every `productionRank` is null.
- All suggested case mappings require human review. No human grades were created by the workflow.

## Coverage audit

This meets the protocol's minimum raw count (8–12 unique listings across two categories), but it does **not** cover the entire frozen matrix:
- Two spaced mixed-title examples were captured; no compact `خریدوفروش` title was captured.
- Direct-offer listings with body-level shop copy and explicit buyer-side listings were captured.
- No clean barter/exchange-condition example was captured.
- Some task cells have weak controls: the seller-piano scenario's sampled direct-seller-pattern candidate is actually rejected by the engine as a training/service offer; the seek-buyer refrigerator scenario did not capture a clean explicit buyer-seeking refrigerator listing among its two detail reads.
- The four-page retrieval cap was reached in every scenario and a cursor remained, so these are bounded samples, not exhaustive category evidence.

## Blinded review status

A randomized, source-snapshot-based relevance packet was prepared separately from the raw report. It contains only the task intent, exact title, full captured description, city/price, and blind ID; it omits source ad IDs, title-pattern labels, suggested cases, engine score, match kind, eligibility, and sampled rank. Keep the internal key withheld until the human grades are locked.

Use the established 0–3 rubric and keep `INSUFFICIENT` outside the numeric denominator. Do not interpret engine scores or `matchKind` as human labels.

## Decision

**No ranking change is justified by this capture.** Preserve the current title-scoped mixed-transaction behavior and candidate eligibility. After blind grades are locked, join the key and assess per-task relevance, role-direction errors, and whether the current cue generalizes. If missing cells remain decision-relevant, collect a narrowly targeted supplement rather than widening all queries or relaxing caps. No `main` merge or deployment.
