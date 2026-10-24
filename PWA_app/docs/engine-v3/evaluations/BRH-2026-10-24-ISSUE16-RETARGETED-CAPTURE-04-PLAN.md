# Issue 16 — Retargeted Capture 04 Controlled Test Plan

Status: protocol only; no capture has been run and no new blind packet has been frozen.
Date: 2026-10-24
Branch: experiment/issue16-cross-category-capture-20261023

## Non-negotiable hygiene

- Every source listing ID used in any prior Issue 16 blind packet or inspected diagnostic artifact is excluded. Do not treat duplicate retrievals as independent evidence.
- Capture each hypothesis independently; do not combine eligibility and item-kind into one aggregate.
- Before opening a key, freeze the exact source-matched titles/details, query context, blind IDs, grade rubric, positive/negative control labels, and acceptance criteria.
- Do not copy engine labels, score, eligibility, rejection reason, or internal condition names into the blind packet.
- Keep a separate internal key with source IDs and engine diagnostics. Human grades are written first; reconciliation is a later artifact.
- Missing control cells stay missing. Never substitute a convenient unrelated listing. Keep Mizan shadow disabled, productionRank null, and retrieval/detail budgets bounded.

## Test A — appliance/home-goods eligibility false rejection

**Primary witness:** I16-R05 (human 3, engine rejected as appliance-not-home-goods). This is one witness, not yet a proven family.

Target a broad refrigerator buy/sell hunt with separately targeted capture queries. Freeze up to eight unique, previously unseen listings:

- Positive controls (at least 3 if retrievable): direct refrigerator sale; buyer seeking used/working refrigerators; mixed buy/sell refrigerator listing whose body clearly seeks to buy refrigerators.
- Negative controls (at least 3 if retrievable): a genuinely unrelated non-appliance listing; a refrigerator repair/service-only listing when the hunt asks for goods; a part-only listing (motor/compressor) when the listing does not offer the refrigerator itself.
- Reserve remaining slots for independent variants of the buyer-seeking used-refrigerator positive or a second ordinary appliance positive.

Record the actual engine eligibility result and rejection reason only in the separate key. A positive control is not valid merely because its title contains «یخچال»; verify the body and transaction role.

Acceptance gate: the false-rejection pattern must recur on at least two independent relevant buyer-seeking used-refrigerator ads, while direct-sale positives remain eligible and unrelated/service/part-only negatives do not become false positives. If the bounded pool cannot supply the required controls, report the gap and do not infer a fix.

## Test B — catalyst/part retained for a whole-car hunt

**Primary witnesses:** I16-R03 and I16-R12 (both human 1, both catalyst listings retained as eligible for whole-car hunt). They are independent examples of one wrong-item-type hypothesis.

Target a whole-car hunt with separately targeted whole-vehicle and catalyst/vehicle-part queries. Freeze up to eight unique, previously unseen listings:

- Positive controls (at least 3 if retrievable): direct whole-car sale; whole-car dealer inventory; a genuine whole-car listing whose body merely mentions a catalyst/vehicle part but does not offer the part as the subject.
- Negative controls (at least 3 if retrievable): catalyst-only buying/selling; catalyst/exhaust repair service; another part-only listing such as motor, wheel, bumper, or battery when no whole vehicle is offered.
- Reserve remaining slots for independent whole-car and catalyst-only variants.

Acceptance gate: catalyst-only listings must recur as eligible for the whole-car hunt across at least two independent ads, while whole-car positives—including a car that merely mentions a part—remain eligible and part-only controls are not mistakenly treated as whole vehicles. Do not implement a broad ban on the word «کاتالیزور»; subject/type, not incidental mention, is the distinction.

## Order and stop conditions

1. Run Test A and Test B as separate bounded read-only captures, with explicit exclusion-set validation before creating either packet.
2. Inspect raw capture integrity and exact source text. If any selected ID intersects prior packets, inspected artifacts, or the sibling capture, discard the affected capture as evidence and fix exclusions before retrying.
3. Freeze two separate blind packets and two separate keys; ask for human grades only after packet integrity passes.
4. Lock grades in separate files before opening keys; then produce per-ID human/engine reconciliation.
5. No code behavior, ranking, hard rejection, main merge, or deployment change until the recurrence and control gates above pass.

## Current limitation

The existing bounded captures repeatedly missed several transaction cells, and the latest human-graded packet identifies only one appliance eligibility false rejection and two catalyst wrong-item-type examples. This plan defines the next experiment; it is not evidence that either failure family is confirmed. Do not reuse Capture 03 or any later inspected IDs.
