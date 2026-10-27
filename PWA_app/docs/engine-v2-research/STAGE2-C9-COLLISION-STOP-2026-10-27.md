# Stage 2 C9 collision gate — stop for architect review

Date: 2026-10-27
Input commit: a9d48951843873426d58ccfee10f1ae1db582068
Audit corpus: `frozen-70-hunts.json` (70 definitions) + `frozen-pool-titles.json` (1,399 titles; H20 has 19).
Method: split frozen definitions and titles into observed surface tokens; apply C1-C8; build the independent observed-token set; evaluate candidate C9 (`ها`, `های`, `تر`, `ترین`) with the current minimum-length/protected-word guards. Compare pre-C9 forms to identify merges introduced only by candidate C9.

## Result

**C9 gate FAIL: 13 distinct-form collision groups.** Per the frozen rule, C9 is disabled for matching and the work stops for architect review. The active canonicalizer now uses C1-C8 only; candidate C9 remains solely in the audit function so the finding can be reproduced.

| Candidate canonical form | Distinct pre-C9 forms |
| --- | --- |
| بزرگ | بزرگ | بزرگترین |
| بالا | بالا | بالاتر | بالاترین |
| کتاب | کتاب | کتابهای |
| ارزان | ارزان | ارزانتر |
| ماهی | ماهی | ماهیهای |
| تشک | تشک | تشکهای |
| مدل | مدل | مدلهای |
| بروز | بروز | بروزترین |
| خانم | خانم | خانمها |
| واحد | واحد | واحدهای |
| روز | روز | روزهای |
| ساز | ساز | سازهای |
| چایساز | چایساز | چایسازهای |

These are candidate-canonical collisions in the frozen definitions + titles, not proof that all are semantically equivalent. The policy says even one such merge requires rollback; therefore no exception was inferred and no stopword/guard changes were made.

## Scope and verification boundaries

- C2 rule text corrected: Arabic `ى` is not converted.
- C6 punctuation-to-token-boundary behavior remains as approved.
- The frozen source explicitly does not include full ad bodies; this audit is limited to the 70 definitions and 1,399 titles.
- No 70-contract generation, Layer 1/Layer 2 gate, restricted TypeScript check, or architect read-through is claimed complete; work stopped at the explicit C9 stop condition.
- No changes to `main` or `engine_v3`; no PR or merge.
- CI run for input commit `a9d4895` was not discoverable through the Actions API query available in this session; no run ID or green status is claimed.
