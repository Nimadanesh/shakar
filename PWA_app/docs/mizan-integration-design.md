# Mizan Integration Design v2 — Decision Model as the Engine's Judge
**Date:** 2026-10-19 | **Status:** Revised after DeepSeek red-team (NO-GO → redesign)
**Red-team:** DeepSeek V4.1 Flash, 2026-10-19 — 12 flaws found, all adjudicated

## What changed from v1
- **Hook point:** B (inside `confirmCandidates`, after `evaluateDescription`), NOT title-phase 3c.
  v1's "Phase 3c" does not exist in code; `near` is only produced post-detail.
  Title-phase rejection would reintroduce flaw #12 (pipeline law: title never hard-filters).
- **Choice is advisory ONLY.** It may influence ranking, never membership.
  v1 allowed Choice to reject; F6 proved Choice answers item-kind, not hunt-fit
  («ماشین تیبا» 0.90 correct kind, still wrong for hunt).
- **Noul is the SOLE rejection channel,** and only with corroboration:
  deterministic conflicting signal + Mizan conf ≥ 0.80.
- **Latency:** overlap with detail phase, cap 12 calls/hunt, 55s budget, content-hash cache.
- **Shadow mode first:** judge, log, apply nothing — for ≥2 battery runs.

## The idea in one line
The deterministic engine decides fast on clear cases; Mizan judges the uncertain ones.
«near» is no longer a dumping ground — it's a question mark that gets answered.

## Where Mizan sits (pipeline integration)

```
[Retrieval] → [Phase 2: title score] → [Phase 3: dedupe] → [Phase 3b: price]
    → [Phase 4: confirmCandidates]
        → getDetail → evaluateDescription → ev.verdict?
            ├── "exact" → shown (Mizan NOT called)
            ├── "rejected" → dropped (Mizan NOT called)
            └── "near" + !detailUnknown + rank ≤ 20 → [MIZAN]
                    ├── Choice (title only) → ADVISORY (ranking signal, never rejects)
                    ├── Noul (title+description) → REJECTION CHANNEL (with corroboration)
                    └── Confidence:
                            ├── ≥0.80 + deterministic conflict → REJECTED
                            ├── ≥0.80 (no conflict) → stays near + logged
                            ├── 0.60–0.80 → no action, logged for calibration
                            └── <0.60 → ignored (deterministic stands)
```

**Why B, not title-phase:**
1. `ev.verdict` only exists post-detail (pipeline.ts:367, 576, 1044, 1066).
2. Title-phase rejection = flaw #12 (pipeline.ts:56-58).
3. Both questions need description for Noul; title-only Choice is advisory.
4. Latency is solved by overlap (§Latency), not by moving earlier.

## The questions (Persian, per hunt kind)

### Choice (advisory — ranking only, NEVER rejects)
"What kind of item is this ad selling?"
- whole: complete item (پراید ۱۳۱ مدل ۹۸)
- part: component of the item (کفی ماشین، دینام)
- accessory: add-on (روکش صندلی)
- derived: made from the item (کره بادوم زمینی، خلال بادوم)
- service: someone offering a service (نصاب کولر)
- other: none of the above

### Noul (rejection channel — with corroboration)
"Does this ad violate the hunt's constraint?"
Constraint is hunt-specific, e.g.:
- «بدون رنگ» → "آیا این آگهی خودروی رنگ‌شده یا تصادفی می‌فروشد؟"
- «بدون لکه» → "آیا این آگهی مبل کثیف یا لکه‌دار می‌فروشد؟"
- Intent-framed for tricky cases (e.g., اسقاطی: "خودروی اسقاطی و فرسوده هم قابل قبول نیست")

## Rejection rule (corroboration-gated)
An ad is REJECTED by Mizan iff ALL of:
1. `ev.verdict === "near"` (deterministic is uncertain)
2. `!detailUnknown` (never judge failed fetches — locked invariant)
3. Noul says "violates" with conf ≥ 0.80
4. Deterministic conflicting signal exists (kindGateRejects fires, or violation cue in text)
5. (Ideal) K=2 unanimous Mizan samples — v1 ships with K=1, logs for K=2 calibration

If any condition fails → ad stays `near`. **Doubt = keep.**

## Confidence bands (defined, no gaps)
- `≥0.80` → act (if corroborated) or log (if not)
- `0.60–0.80` → no action, logged for calibration
- `<0.60` → ignored entirely
- All as named constants with unit tests on boundaries.

## Latency architecture
- **Overlap:** Dispatch Mizan while next details are in flight (4-wide pool, await per batch).
- **Cap:** ≤12 calls/hunt (rank-gated top-20, near-only, never detailUnknown).
- **Budget:** 55s wall + circuit breaker (stop dispatching; deterministic stands).
- **Cache:** `mizan_judgements(content_hash, model_version, prompt_version, question, label, conf)` — 7-17s → ~10ms.
- **Off-path warming:** Kamin tick pre-judges; interactive hunts hit warm cache.
- **Modes:** Eval-mode (unbounded, offline) vs Request-mode (capped, in-path).

## Rollout
1. **Shadow mode** (≥2 battery runs): judge, log, apply nothing. Measure agreement + latency.
2. **Noul-only**: enable rejection channel, Choice stays advisory.
3. **Full**: both questions live, with calibration report (n≥300).

## What v1 got wrong (for the record)
- F1: Prototype wasn't committed (fixed: a883ebd).
- F4: "Phase 3c" doesn't exist; hook is B.
- F6: Choice can't reject (label-space mismatch).
- F3: No cache, no cap, no overlap in v1.
- F5: N=20 insufficient for 0% claim; need baseline + n≥300.
- F7: 0.6–0.8 band was undefined (now: log only).
