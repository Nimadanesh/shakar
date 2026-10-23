# Run 117 — bounded Samand exchange observation review

Date: 2026-10-23  
Run: https://github.com/Nimadanesh/shakar/actions/runs/39945846455  
Artifact: `engine-v3-live-observation-117`  
Observed commit: `6e1582966462431556af3219b957ff8357a91b51`  
Branch: `engine_v3`

## Scope and limits

This is an unjudged, read-only live observation, not a relevance score or paired quality comparison. The workflow completed successfully. The Samand exchange scenario requested/completed 8 pages, saw 186 ads, and used its allotted 2 detail checks. The overall 8-detail budget was respected. No production code, ranker, or human grade was changed by this run.

## What the new inventory establishes

The observation-only title inventory is now present in the artifact: 30 titles containing both `سمند` and an exchange cue. The selector's counters report 3 paint-hint candidates and 30 Samand+exchange candidates, but zero titles containing all three title cues (Samand + paint + exchange).

The 30-item inventory contains only one obvious paint-related title:
- `ga4iPfzH` — «معاوضه با خودرو رنگ سفید(سمند یا sd یا پرشیا )»

This describes the requested vehicle as white; it does not establish that the requested Samand has or has not been repainted. The full description says the offered car has one painted rear fender and a replaced hood, and says it is being exchanged for white Samand/206 SD/Pars. Those paint claims belong to the offered car. This is wrong-side evidence, not target-side contradiction.

The other detail candidate:
- `galu34HS` — «زانتیا ۲۰۰۰ معاوضه با سمند و پژو»

Its detail describes smoke from the offered Xantia's engine and chassis damage; it supplies no paint evidence about the requested Samand. This is missing target-side evidence, not contradiction.

The remaining title inventory (all unjudged) is visible in the run artifact. None of the recorded titles combines a Samand target with an explicit paint-state cue. Do not infer from these titles alone that the underlying full descriptions cannot contain relevant evidence.

## Decision

- Run 117 confirms the inventory instrumentation works and exposes the title-pool limitation.
- It does **not** produce a clean, direction-matched contradiction example.
- Do not add a general paint-token contradiction rule or integrate the helper into ranking.
- Do not widen the page/detail budgets merely to force a counterexample.

## Next bounded experiment

Change only the observation query to a more explicit target-side condition, e.g. `معاوضه با سمند بدون رنگ`, retaining the same 8-page scenario limit and 2-detail budget. Treat this as a new observation, not a comparison to Run 117: query wording changes retrieval distribution. Before any blind packet is created, inspect both the title and full description and confirm (1) the exchange direction, (2) which vehicle the paint claim describes, and (3) whether the claim explicitly contradicts the requested condition. If no candidate satisfies all three, record the negative result and stop. Keep `UNKNOWN` distinct from both support and contradiction.
