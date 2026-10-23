# Internal Mapping — BRH-2026-10-23-D

**Keep this file private until blinded judgments have been returned. Do not amend the blind packet after grading starts.**

Source workflow: bounded read-only Divar observation, [run 39946256433](https://github.com/Nimadanesh/shakar/actions/runs/39946256433)  
Source/config SHA: `9de158e946e271d968f4dfaf0b673e451b1e5a3f`  
Query: `معاوضه با سمند بدون رنگ`  
Observation: 8/8 list pages completed, 193 ads seen, 1 duplicate collapsed, 192 candidates after filters. 84 Samand+exchange title candidates, 11 paint-hint candidates, 5 joint Samand+paint+exchange title candidates. Only 2 details were checked due to the fixed per-scenario budget.

| Blind ID | Source ad ID | Exact title | Evidence / unresolved question |
|---|---|---|---|
| D01 | `gaXvBpp8` | `تیبا ۹۵ بیرنگ دوگانه معاوضه با سمند دوگانه سفید` | Offered vehicle is Tiba 1395. The description explicitly says the Tiba is `بدون رنگ`. Requested counterpart is a clean white Samand dual-fuel model 1398–1401. `سفید` establishes color, not paint history. The captured text does not establish the requested Samand's paint history; this is a wrong-side condition cue, not a target-side contradiction. |
| D02 | `ga_KqrRw` | `سمند معاوضه‌با فیدلیتی پرایم بدون رنگ` | Title indicates Samand and Fidelity Prime in an exchange but is not perfectly explicit about which side the trailing `بدون رنگ` modifies. Description says only `ماشین در حد صفر ۵نفره بدون رنگ...` and does not name the referent. Do not assign this condition to Samand without reviewer-supported referent resolution. This is intentionally ambiguous, not a clean contradiction. |

## Integrity / decision gate

- The artifact is a read-only snapshot and explicitly warns that engine verdicts are not relevance labels or a paired comparison.
- The two detailed candidates were chosen by title cues; this is a diagnostic sample with selection bias.
- Neither record currently provides a clean, direction-matched contradiction proving that the requested Samand violates `بدون رنگ`.
- Do not add a ranking rule, integrate `exchangeTargetEvidence` into ranking, or change production semantics based on these two records. Keep `UNKNOWN` distinct from satisfied and contradicted. A human answer may clarify attribution but cannot alone authorize behavior changes without suitable paired evidence and counterexamples.
