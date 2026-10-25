# Issue 16 Capture 06C — Paired Blind Follow-up Protocol

Status: preregistered capture design; results pending. This protocol is written before collecting or grading the next sample.

## Question

Does the current engine admit listings for the specific-part hunt `کاتالیزور خودرو` when the catalytic converter is only incidental body context, while preserving listings that actually offer a catalytic converter?

## Arms

- **Direct-title control arm:** retrieve with `کاتالیزور خودرو` and `کاتالیزور پژو`; candidate title must contain the target term. This is only a candidate control: a title mention does not itself prove a direct offer, so the human grade decides relevance.
- **Other-part-title context arm:** retrieve with `کاتالیزور سنسور اکسیژن` and `کاتالیزور منیفولد`; candidate title must be led by another vehicle part, and the target term is expected to be body-only when confirmed by detail.
- Existing source IDs opened by Captures 06A, 06B, and earlier Issue 16 captures are excluded. All four detail IDs opened in Capture 06B run #1 are explicitly excluded.

## Fixed budget and integrity

- Maximum 2 listing pages per retrieval query.
- Maximum 8 detail reads total.
- Mizan Shadow disabled.
- Read-only retrieval; no service mutation.
- Freeze the resulting artifact. Do not rerun or mutate a completed capture.
- Keep blind packet, human grades, and source/engine mapping in separate files. Do not reveal IDs or engine labels until the human grade is locked.
- UNKNOWN stays out of the numeric denominator.

## Interpretation rule

This is a small, targeted E4 sample. It can reveal a repeatable candidate failure and check whether direct-offer controls are harmed, but it is not a population precision estimate or E5 quality comparison. No production parser, marker, ranking, eligibility, or `HEAD_KIND` change is authorized by this capture alone. Any proposed change must be narrow and supported by source-matched human grades across both arms.

## Current evidence motivating the capture

Capture 06B B01 was human grade 1 while the engine returned eligible/near (score 1). This is one observed false acceptance, not a general rate. Capture 06C seeks independent examples and a direct-title control arm without reusing any inspected IDs.
