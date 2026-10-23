# Human Judgment Record — BRH-2026-10-23-D

Date: 2026-10-23. Branch: `engine_v3`.
Source observation: [run 39946256433](https://github.com/Nimadanesh/shakar/actions/runs/39946256433). Blind packet: [BRH-2026-10-23-D-BLIND.md](BRH-2026-10-23-D-BLIND.md).

## D01 — `gaXvBpp8`
- Offered: Tiba model 1395, dual-fuel.
- Requested: white, clean, dual-fuel Samand, model 1398–1401.
- Samand paint: no evidence that the Samand is `بدون رنگ/بیرنگ`.
- Claim owner: offered vehicle (Tiba).
- Compatibility: not confirmed for `معاوضه با سمند بدون رنگ`; the Samand's paint history is unspecified.
- Rationale: `بدون رنگ` describes the offered Tiba. `سفید` describes Samand color, not paint history.

## D02 — `ga_KqrRw`
- Offered: Samand, inferred from title-order convention.
- Requested: Fidelity Prime, inferred from title-order convention.
- Samand paint: ambiguous.
- Claim owner: ambiguous.
- Compatibility: cannot be established from the captured text.
- Rationale: the description's `ماشین ... بدون رنگ` names neither vehicle. Samand paint status remains unproven regardless of inferred direction.

## Comparison and decision
Both judgments align with the internal mapping. D01 is wrong-side evidence, not target-side support or contradiction. D02 remains unresolved due to ambiguous attribute reference. The evaluator distinguishes `سفید` (color) from `بدون رنگ/بیرنگ` (paint history).

Packet D adds two human-confirmed attribution judgments but does not provide a clean, direction-matched contradiction case for a requested Samand under an explicit no-paint requirement. Keep `UNKNOWN` distinct from supported and contradicted. Do not change `exchangeTargetEvidence`, ranking, query semantics, production behavior, detail budgets, or selectors based on these records. The blind packet remains unchanged. No `main` changes, merge, or deployment.

Next: stop this title-cue chase instead of adding more selector heuristics. Wait for a source-matched example with explicit transaction direction and target-side contradiction. Synthetic fixtures can test unit behavior but are not live human evidence.
