# E3 — Exchange evidence phrase specificity audit

Date: 2026-10-26  
Status: **focused and portable tests PASS; typecheck PASS; targeted lint pending on latest workflow run**

## Observed limitation

`assessExchangeTargetEvidence` used `phrases.find(...)`, so when more than one caller-supplied exact phrase matched the same side, the evidence selected depended on array order. For overlapping candidates such as `کفی` and `کفی سه محور`, this could record the less-specific phrase despite the longer exact phrase also matching. The same issue applies to overlapping required-attribute phrases.

## Bounded change

- `findPhrase` now collects exact whole-phrase matches and selects the longest match.
- Equal-length matches are selected deterministically by code-point ordering. This is a deterministic reporting choice, not semantic disambiguation.
- No stemming, synonym expansion, fuzzy matching, entity parsing, rank adjustment, eligibility change, or production pipeline integration was added.
- Two regression tests cover overlapping target-item phrases and overlapping required-attribute phrases, asserting that the longer phrase wins regardless of candidate-array order.

## Evidence and boundaries

- Existing frozen BRH controls remain P06 (grade 3, `تریلی بیات معاوضه با کفی سه محور`) and P07 (grade 2, `کفی اطلس ۱۲۶۰ معاوضه با تانکر سه محور تمیز`). Human grades were not changed.
- Tests use existing helper/test infrastructure and synthetic or frozen title-level examples. They are not new live capture or human evaluation.
- The helper remains phrase-level diagnostics. A longest phrase match does not prove that the phrase list is complete or that an attribute semantically belongs to a particular real-world entity.

## Validation on experiment commit `63e15a9975fda88a2df7c75962460153d2edb729`

Workflow: [run 40301340872](https://github.com/Nimadanesh/shakar/actions/runs/40301340872).

- Locked dependency install: PASS.
- Focused `exchangeTargetEvidence-brh-run101.test.ts`: PASS.
- Portable hunt/search tests: PASS.
- TypeScript typecheck: PASS.
- Whole-project `npm run lint`: FAIL with 8 errors and 42 warnings. All eight errors are `react-hooks/set-state-in-effect` in unrelated UI components/hooks (`KaminDetailSheet.tsx`, `BottomTabBar.tsx`, `MarketSheet.tsx`, `HomeCityUpdateNudge.tsx`, `HuntProgress.tsx`, `SearchSheet.tsx`, `HomeCityRow.tsx`, `useProfile.ts`). These do not touch the two changed exchange-helper files. The workflow is being narrowed to lint those changed files, while preserving the whole-project lint failure as a known repository-wide validation limitation; this is not represented as a clean full-project lint.
- Targeted ESLint on `exchangeTargetEvidence.ts` and `exchangeTargetEvidence-brh-run101.test.ts`: PASS in follow-up workflow [run 40301702642](https://github.com/Nimadanesh/shakar/actions/runs/40301702642), on commit `4ff8bc81783477ce6c17c049fb00239db8284d74`.

## Scope guard

No changes to `engine_v3` or `main`; no PR, merge, deployment, new Divar capture, or new human grades. Do not move the patch to `engine_v3` without explicit user approval. Floor-mat cue risk remains OPEN / UNVERIFIED.


## Final validation status — 2026-10-26

The follow-up experiment workflow completed successfully: locked install, focused exchange tests, portable hunt/search tests, TypeScript typecheck, and targeted ESLint all PASS. The earlier whole-project ESLint failure remains a separate repository-wide debt (8 unrelated hook-rule errors / 42 warnings); this patch does not claim the whole-project lint gate is clean. Validation ran on source/test commit `63e15a9975fda88a2df7c75962460153d2edb729`; the later workflow-only adjustment is commit `4ff8bc81783477ce6c17c049fb00239db8284d74`. Current branch has documentation-only follow-ups after that run. No production integration or transfer to `engine_v3` is approved.
