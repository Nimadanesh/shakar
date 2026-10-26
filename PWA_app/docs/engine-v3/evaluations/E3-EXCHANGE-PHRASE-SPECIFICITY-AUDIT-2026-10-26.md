# E3 — Exchange evidence phrase specificity audit

Date: 2026-10-26
Status: **narrow implementation change committed on experiment branch; tests added; execution not yet verified**

## Observed limitation

`assessExchangeTargetEvidence` used `phrases.find(...)`, so when more than one caller-supplied exact phrase matched the same side, the evidence selected depended on array order. For overlapping candidates such as `کفی` and `کفی سه محور`, this could record the less-specific phrase despite the longer exact phrase also matching. The same issue applies to overlapping required-attribute phrases.

## Bounded change

- `findPhrase` now collects exact whole-phrase matches and selects the longest match.
- Equal-length matches are selected deterministically by code-point ordering, avoiding array-order dependence. This tie-break is only a deterministic reporting choice; it is not semantic disambiguation.
- No stemming, synonym expansion, fuzzy matching, entity parsing, rank adjustment, eligibility change, or production pipeline integration was added.
- Two regression tests were added: overlapping target-item phrases and overlapping required-attribute phrases. Both assert that the longer phrase is selected even when the shorter candidate appears first.

## Evidence and boundaries

- Existing frozen BRH controls remain P06 (grade 3, `تریلی بیات معاوضه با کفی سه محور`) and P07 (grade 2, `کفی اطلس ۱۲۶۰ معاوضه با تانکر سه محور تمیز`). This change does not alter their human grades.
- The new tests use the same already-present helper/test harness and synthetic or frozen title-level examples; they do not constitute new live capture or human evaluation.
- The helper remains phrase-level diagnostics. A longest phrase match does not prove that the phrase list is complete or that an attribute semantically belongs to a particular real-world entity.

## Validation status

- Source and test edits are committed to `experiment/e3-floormat-guard-audit-20261026` only.
- Tests have **not** been executed in this session. The repository baseline workflow's push trigger is restricted to `engine_v3`; no experiment-branch workflow run is claimed. Historical CI results do not validate this new commit.
- Next safe validation is to run the focused `exchangeTargetEvidence-brh-run101.test.ts` test and then the portable hunt suite on this exact head, using an approved experiment-branch validation path. Do not move the change to `engine_v3` without explicit user approval.

## Scope guard

No changes to `engine_v3` or `main`; no PR, merge, deployment, new Divar capture, or new human grades.