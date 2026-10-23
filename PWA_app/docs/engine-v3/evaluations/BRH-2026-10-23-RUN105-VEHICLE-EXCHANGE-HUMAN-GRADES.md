# Run 105 — Vehicle Exchange Human Grades

Date: 2026-10-23  
Branch: engine_v3  
Source run: [GitHub Actions #105](https://github.com/Nimadanesh/shakar/actions/runs/39933521146)  
Blind packet: [BRH-2026-10-23-RUN105-VEHICLE-EXCHANGE-BLIND.md](./BRH-2026-10-23-RUN105-VEHICLE-EXCHANGE-BLIND.md)

## Locked grades

| Case | Grade | Human rationale |
|---|---:|---|
| S01 | 2 | The exchange offer is relevant to the target, but «بدون رنگ و ضربه» describes the offered Pride, not the requested Samand/Tiba2. The requested target's paint status is unknown. The engine's exact label shows a side-ownership error: it found the attribute phrase but failed to bind it to the correct item. |
| S02 | 2 | The Samand is on the offered side in an exchange for a Quick. The text gives specifications and insurance details but no paint-condition evidence for the Samand. This is absence of evidence, not contradiction. Offering the target item is not inherently the wrong transaction direction; interpret direction from the full exchange frame, not the phrase «معاوضه با سمند» alone. |

Scoring convention: 3 exact, 2 relevant, 1 weak, 0 irrelevant; INSUFFICIENT is excluded from the denominator. No case was marked insufficient.

## Paired diagnostic lesson

Both cases grade 2, but for different evidence failures:

- **S01 — misplaced evidence:** explicit positive-looking attribute phrase belongs to the opposite-side vehicle. For the requested target, this must remain unknown, not supported.
- **S02 — absent evidence:** no paint-condition statement is present for the target vehicle; this is also unknown, but not because evidence was attached to the wrong side.

Therefore, a target-side attribute checker must preserve ownership and distinguish positive evidence, explicit scoped contradiction, and unknown. A phrase match alone must not justify exact.

## Scope and decision

This is a two-example human-reviewed diagnostic pair, not a performance estimate. Keep the evidence logic isolated from ranking. Before considering integration, continue collecting unique blind-graded cases, including a clear grade-3 target-side positive control and additional explicit contradiction/unknown controls. No ranking change, main merge, or deployment is authorized by this record.


## Additional locked grades — Runs 106/109

Blind review returned by the human reviewer on 2026-10-23:

| Case | Grade | Human rationale |
|---|---:|---|
| S03 | 2 | The Samand and exchange relation are relevant, but the only appearance-related phrase is «بدون نقطه», which refers to spots/dents rather than paint condition. Paint remains unknown; missing paint evidence is not contradiction. |
| S04 | 3 | The target is the Samand, the title explicitly says «معاوضه دارم», and the description says «بدونه رنگ» about the same car. The colloquial spelling «بدونه» is a surface form of «بدون» and must be recognized as positive target-side paint evidence. |

The S03/S04 pair adds the first grade-3 target-side positive control in this sequence while preserving the grade-2 unknown case. It also exposes a normalization requirement: recognize colloquial orthographic variants such as «بدونه رنگ» without broadening generic «بدون» matching across unrelated attributes.

These remain diagnostic observations, not a ranking-quality estimate. Keep the implementation gate closed while collecting more blind cases, especially explicit target-side paint contradiction, wrong-side positive evidence, and colloquial/orthographic positive variants. No ranking change, main merge, or deployment is authorized.
