# Issue 16 — Retargeted Capture 03 Reconciliation

Date: 2026-10-24  
Branch: engine_v3  
Scope: human-vs-engine alignment for the locked Retargeted Capture 03 packet. This is diagnostic evidence only.

## Human-grade source

See [I16-RETARGETED-CAPTURE-03-HUMAN-GRADES.md](I16-RETARGETED-CAPTURE-03-HUMAN-GRADES.md), maintained separately from the internal diagnostic key.

- 12/12 scored; sum 32/36.
- Grade distribution: ten 3s and two 1s.
- Engine outputs are not human labels and must remain separate from this record.

## Reconciliation

| IDs | Human grade | Engine observation | Interpretation |
|---|---:|---|---|
| I16-R05 | 3 | Rejected as appliance-not-home-goods | Eligibility false rejection: a buyer-seeking used-refrigerator listing is relevant to the hunt. Highest-priority witness in this packet. |
| I16-R03, I16-R12 | 1 each | Retained as eligible for a whole-car hunt | Wrong-item-type false positives: both are catalyst listings. Two independent ads, one failure type. |
| I16-R01, I16-R06, I16-R08 | 3 each | Engine label near | Separate under-scoring signal; do not conflate with eligibility or wrong-item-type failures. |
| Other packet IDs | As recorded in the grade file | No additional per-ID engine details asserted here | Avoid reconstructing absent diagnostics from aggregate counts. |

## Hypotheses and next evidence gate

### H1 — Eligibility false rejection (appliance-not-home-goods)

I16-R05 is a direct witness. A broader family resemblance to other refrigerator/home-goods eligibility failures is plausible but unproven. Test separately with:
- Multiple unseen buyer-seeking used-refrigerator listings that should qualify.
- Positive controls for relevant appliance/home-goods ads.
- Negative controls for genuinely wrong categories and irrelevant buyer-seeking ads.
- Explicit capture of the rejection reason and candidate eligibility result.

### H2 — Wrong item type retained for whole-car hunts

I16-R03 and I16-R12 are independent catalyst examples of the same error type. Test separately with:
- Unseen catalyst/vehicle-part negatives.
- Whole-car positive controls, including cars whose descriptions merely mention parts.
- Nearby part-only controls to ensure the result is about subject type, not a broad token ban.

### Separate signal — under-scoring

I16-R01, I16-R06, and I16-R08 have human grade 3 but engine near. Track this separately; it is not evidence for either H1 or H2 and does not by itself justify ranking changes.

## Blinding and change gate

- Use only IDs unseen in all earlier Issue 16 packets.
- Freeze the candidate packet, positive/negative control composition, and ID-to-condition key before requesting grades.
- Keep the human packet free of engine labels and diagnostic condition names; store the key separately.
- Do not modify ranking or hard eligibility rules unless each primary failure repeats across independent listings while its preregistered controls remain healthy.
- No PR merge, no main change, and no deployment are authorized by this reconciliation.
