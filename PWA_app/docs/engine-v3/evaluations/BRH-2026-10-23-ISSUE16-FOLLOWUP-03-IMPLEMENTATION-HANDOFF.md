# Issue 16 — Implementation Handoff for Independent Follow-up Capture

Date: 2026-10-23  
Status: implementation specification only; no new capture claimed.

## Why this implementation is needed

The current workflow `.github/workflows/engine-v3-issue16-cross-category-capture.yml` runs only when selected source/workflow paths change or by manual dispatch. Its current test `PWA_app/src/lib/server/hunt/live-issue16-cross-category-capture.test.ts` has four fixed scenarios and a six-detail budget. Re-running it can select a different candidate per scenario, but it is not an independently designed capture for Follow-up Plan 03. The completed run 40013991054 reused the same six unique listing IDs as the prior packet and is not independent evidence.

## Coding-agent task

Implement a **separate** bounded capture for Follow-up Plan 03 on this PR branch only. Do not edit the existing frozen capture test, prior reports, blind packets, grades, keys, or production search behavior.

### Required new artifacts

1. New test file, for example:
   `PWA_app/src/lib/server/hunt/live-issue16-followup-03-capture.test.ts`
2. New workflow, for example:
   `.github/workflows/engine-v3-issue16-followup-03-capture.yml`
3. Raw report artifact with a unique name, for example:
   `engine-v3-issue16-followup-03-capture.json`
4. After a successful capture, a separate internal source/diagnostic key and a blind packet may be prepared as documentation commits. Never include source IDs or engine labels in the blind packet.

### Capture cells (prioritize, don't fabricate)

**A — transaction direction for `فروشنده یخچال`**
- direct seller: text clearly offers a refrigerator for sale;
- buyer-only: text clearly seeks to buy refrigerators;
- mixed title, buyer-only body (I13 pattern);
- mixed title with body that genuinely offers a refrigerator;
- ordinary `یخچال` control, if retrievable within budget.

**B — whole vehicle vs voucher/service for `خریدوفروش خودرو`**
- direct whole-vehicle sale;
- voucher office;
- brokerage/consultancy without a vehicle offer;
- direct whole-vehicle exchange offer;
- clean whole-vehicle control.

**C — broad vehicle query match-kind**
- direct cash sale;
- direct installment sale;
- direct sale with exchange willingness;
- adjacent vehicle office/service control;
- ambiguous title whose body does not establish a direct vehicle offer.

Do not try to fill all cells by repeatedly querying until a preferred ad appears. Use a predeclared query list and deterministic candidate selection. Mark unfilled cells missing. Max 2 list pages per query, max 8 detail reads total, and max 8 distinct listing IDs. Do not revisit detail pages for the same ID. Prefer IDs not used in the earlier Issue 16 packets; explicitly flag overlap if unavoidable.

### Safety and integrity requirements

- Read-only Divar retrieval; set `LIVE_DIVAR_OBSERVATION=1`, `MIZAN_SHADOW=0`; no service writes.
- Every query, page count, detail read, unique ID, and overlap must be recorded in the raw report.
- Capture title and available description verbatim as returned; do not paraphrase in the evidence artifact.
- Keep query, listing source ID, role mode, eligibility, match kind, score, sample rank, and rejection diagnostics only in the internal report/key.
- Blind packet includes randomized case IDs, exact query, title, and adequate description excerpt only. No source IDs, ranks, scores, match kinds, hypothesis labels, or prior grades.
- Preserve `UNKNOWN` as distinct from satisfied/violated.
- The human evaluator grades exact-query relevance (0/1/2/3/INSUFFICIENT). Lock grades before opening the internal key.
- Do not report precision@5, nDCG, representative quality, or human-quality uplift from this selected bounded sample.

### Validation and stopping gate

- Run focused test, portable suite, typecheck, and build; report ESLint separately if it fails on known unrelated UI debt.
- Verify `MIZAN_SHADOW=0`, the page/detail caps, artifact creation, and that `productionRank` is null.
- Workflow should be triggered by changes to the new test/workflow and allow manual dispatch if the repository's supported path permits it. Do not claim a run until its actual Actions result and artifact are inspected.
- If the capture produces no independent source ads for a hypothesis, document that cell as missing and stop. Do not broaden caps or infer evidence from engine labels.
- No ranking, eligibility, hard-rejection, or query-semantics change is part of this task. Keep PR #41 Draft. No merge to `engine_v3` or `main`, and no deployment without explicit owner authorization.

## Existing source of truth

- [Follow-up Plan 03](BRH-2026-10-23-ISSUE16-FOLLOWUP-PLAN-03.md)
- [Blind packet 02](BRH-2026-10-23-ISSUE16-CROSS-CATEGORY-BLIND-02.md)
- [Human grades 02](BRH-2026-10-23-ISSUE16-CROSS-CATEGORY-HUMAN-GRADES-02.md)
- [Internal key 02](BRH-2026-10-23-ISSUE16-CROSS-CATEGORY-INTERNAL-KEY-02.md)
- Existing bounded capture run [40011900064](https://github.com/Nimadanesh/shakar/actions/runs/40011900064)
- Duplicate execution [40013991054](https://github.com/Nimadanesh/shakar/actions/runs/40013991054)
