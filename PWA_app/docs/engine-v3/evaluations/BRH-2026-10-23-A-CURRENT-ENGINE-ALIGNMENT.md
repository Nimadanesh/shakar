# BRH-2026-10-23-A — Current engine alignment audit

Date: 2026-10-23
Branch: `engine_v3`
Human grades: frozen from [BRH-2026-10-23-A-HUMAN-GRADES.md](./BRH-2026-10-23-A-HUMAN-GRADES.md); no re-evaluation performed.

## Scope and provenance

- Current branch HEAD: `ae766373faa595ed17f8d6d851ccd7b3de68b40c`.
- Latest code-bearing commit: `9de158e946e271d968f4dfaf0b673e451b1e5a3f`; subsequent commits through the current HEAD are documentation-only.
- Current-code baseline [run #147](https://github.com/Nimadanesh/shakar/actions/runs/39946256547) on `9de158e`: focused tests PASS, full portable suite PASS, TypeScript PASS, production build PASS; ESLint FAILS on the existing UI hook-rule errors (8 errors; 37 warnings). This is not a fully green baseline.
- Source-matched live evidence is bounded, not a fresh six-ad replay on the current code-bearing SHA. The initial packet mapping came from [run #84](https://github.com/Nimadanesh/shakar/actions/runs/39911832666), code SHA `70a077e`; the buyer-cue fix was then observed in [run #86](https://github.com/Nimadanesh/shakar/actions/runs/39915083572), source SHA `a65b7d3`. Do not describe those captures as a fresh current-head live replay or a representative precision estimate.

## Human-grade to engine-behavior alignment

| ID | Human grade | Observed engine behavior | Alignment assessment |
|---|---:|---|---|
| A01 | 2 | Original mapped candidate was `near`; “like new / clean / low use” does not prove repair/replacement history. The later live artifact's A01-like candidate was not the exact same source listing. | Semantically aligned, but the later capture is not exact per-ID corroboration. Current polarity regression tests preserve UNKNOWN for clean/low-use wording. |
| A02 | 0 | Buyer-seeking piano/organ ad rejected as `no-match`. | Aligned: transaction role is wrong for a product hunt. |
| A03 | 2 | Store/catalogue listing retained as `near`, without a verified history for a specific unit. | Aligned: relevant category, critical condition unproven. |
| A04 | 0 | Explicit repair service rejected as `service-offer-for-negative-repair-history-product-hunt`. | Aligned: service offer is not a qualifying product listing. |
| B01 | 1 | Consultation/catalogue listing retained as `near`. | Potential over-inclusion. One grade-1 example does not justify a broad consultation hard-reject. |
| B02 | 3 | Initially rejected as `no-match` in run #84; after the scoped buyer-cue fix, the same named Beethoven listing was recovered as `near` in run #86. Current regression tests still pin the full phrase as `unknown` for explicit replacement-history polarity. The listing remains `near`, not a full match, because `قطعات` and `اورجینال` are missing as explicit MUST evidence. | Important remaining human/engine contract gap: the evaluator judged “بدون تغییر و جابه‌جایی و دستکاری” sufficient evidence of an untouched state, while the engine conservatively does not equate that wording with explicit “parts original / not replaced.” Recovery from rejection is real; a quality uplift or full match is not established. |

## Decision

1. Keep the scoped buyer-cue fix: it recovered B02 from a false rejection without treating a mid-description `به دنبال` phrase as a buyer declaration.
2. Keep `UNKNOWN` distinct from explicit replacement-history absence/presence. Do not globally synonymize `بدون تغییر` or `بدون دستکاری` with `تعویض نشده`.
3. Do not hard-reject consultation listings from B01 alone.
4. Next useful evidence gate is a **paired, source-matched human-reviewed set** that contrasts (a) “بدون دستکاری/بدون تغییر” with no explicit parts history, (b) explicit original-parts/no-replacement claims, and (c) explicit replacement claims. Preserve the current behavior until those controls can show whether a narrow evidence state is justified.
5. No ranking/production change, no `main` merge, no deployment, and no edits to frozen blind grades or keys.

## Validation caveat

Current portable tests, typecheck, and build passed on the latest code-bearing commit. ESLint remains failed on known unrelated UI hook-rule errors. The live source observations cited above are earlier bounded captures, not a new live replay against current HEAD.
