# Project State — Engine V3

Last verified: 2026-10-22
Work branch: `engine_v3`
Branch base: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Latest source fix: `49656d583c43bc8bd7fe3478e0ee4ad5ab5c225e` (single-token lint cleanup in `contract.ts`)
Latest completed baseline run: [Run #6](https://github.com/Nimadanesh/shakar/actions/runs/39676945092), tested commit `49656d583c43bc8bd7fe3478e0ee4ad5ab5c225e`.

## Mission

Maximize the probability that a professional Divar user reaches the best genuinely relevant ads quickly. Optimize real-user result quality, not model sophistication, code volume, or passing synthetic tests alone.

The human owner acts primarily as a blinded/consistent end-user evaluator:
- run the requested hunt scenarios in the product;
- grade whether the top results are genuinely relevant and whether critical constraints are respected;
- report observed output and unexpected behavior.

The technical agent owns code investigation, architecture, test design, implementation choices, measurement, and go/no-go recommendations. User feedback is evidence, not an instruction to adopt a particular technical solution.

## Verified repository state

- `engine_v3` was created from current `main` SHA `10f3c40d70748ff27d6928eaed0875e10dab1c56`.
- No engine/product feature changes have been made in V3. One minimal static cleanup changed `let j = i - 1` to `const j = i - 1` in `src/lib/server/hunt/contract.ts`; this is behavior-preserving and removed one lint error.
- Hosted runner used Node `v24.21.0` with npm `11.19.0`; `npm ci` succeeded.
- First three runs failed because three historical research harnesses hard-code files outside the repository. Run #4 and #6 exclude only these three files from portable CI and explicitly report their inputs as NOT RUN:
  - `src/lib/server/hunt/contractDeleteAudit.test.ts` needs `/home/hatch/workspace/ge2-ads.json`
  - `src/lib/server/hunt/contractGate.test.ts` needs `/home/hatch/workspace/your_files/experiment-b-probe-v1.json`
  - `src/lib/server/hunt/expAFeatures.test.ts` needs intended contracts plus historical round captures/grades and snapshot data under `/home/hatch/workspace`
- Run #6 outcomes:
  - focused portable hunt/search suite: PASS
  - full portable test suite: PASS
  - TypeScript typecheck: PASS
  - production build: PASS
  - ESLint: FAIL (8 errors, 38 warnings)
  - overall job: FAIL because ESLint failed
- The remaining eight lint errors are `react-hooks/set-state-in-effect` in UI files: `KaminDetailSheet.tsx:77`, `BottomTabBar.tsx:23`, `MarketSheet.tsx:45`, `HomeCityUpdateNudge.tsx:87`, `HuntProgress.tsx:110`, `SearchSheet.tsx:47`, `HomeCityRow.tsx:26`, and `useProfile.ts:114`. The engine-file `prefer-const` error is fixed. Do not broaden V3 into unrelated UI cleanup.
- The build compiled successfully and generated 38 static pages in run #4; run #6 also passed build. This verifies buildability at those SHAs, not live Divar retrieval or relevance quality.
- `npm ci` reported 30 dependency vulnerabilities (2 low, 6 moderate, 20 high, 2 critical). No automated dependency upgrade/audit fix was applied.
- Workflow triggers are scoped to workflow, package/lockfile, source, scripts, and build/lint/typecheck config changes, avoiding repeated runs for control-doc-only updates.
- Synthetic benchmark remains 16 cases (`2026-10-09-v1`), documented as a seed benchmark rather than representative live-market evidence.
- The evaluation artifact repo `Nimadanesh/shakar-eval-tmp-20261012` currently exposes only Phase 1 review/packet artifacts on its main branch (latest commit recorded there is 2026-10-12); it does not contain current R1/R2 handoff artifacts. Last known status from prior project work: R1 capture complete, R1a metrics joined 138/138 grades with A mean nDCG@5 0.5007 and B 0.5539; R1b not started/reported. A later R2 review discussed 12 questions focused on service intent (S3), transaction direction (S4), and variant detection (S1). Treat this as last-known context, not proof of present artifact status. Do not rerun or mutate frozen captures.
- Existing architecture/roadmap docs contain stale baseline pointers and need reconciliation against current code.

## Important quality risks to verify

These remain hypotheses, not proven current defects:
1. Relevant ads may be missed due to query construction, pagination, deduplication, or detail-budget allocation.
2. Explicit constraints may be mishandled when evidence is missing, stale, or ambiguous.
3. Entity/kind confusion (e.g. part/accessory vs whole item) may produce irrelevant results.
4. Service intent and transaction direction may be confused.
5. Global synonym expansion may collapse related-but-distinct concepts.
6. Mizan's effective role may differ by runtime configuration.
7. Passing unit tests/typecheck/build does not establish human top-result quality.

## Current phase

**Phase 0 — baseline trustworthiness: portable execution evidence is now available; formal exit is pending documentation reconciliation and an explicit go/no-go.**

Completed:
- branch isolation and control documents;
- hosted Node 24 workflow;
- portable focused tests, full portable test suite, typecheck and build pass;
- lint failures classified; the one engine-file style issue fixed narrowly;
- three data-dependent research harnesses explicitly distinguished from passing tests.

Still required before Phase 0 exit:
- reconcile stale architecture/quality docs against current source;
- verify evaluation artifact status without rerunning or mutating frozen work;
- run the golden harness only after its exact frozen inputs and expected mappings are identified;
- produce a code-level prioritized failure register and select the first measurable search-quality experiment.

## Next action

Reconcile current architecture docs against source, verify the latest available R1/R2 handoff without touching frozen artifacts, and define one narrow quality experiment with a measurable acceptance gate. Do not change `main`, deploy, or claim live quality gains without paired human-judged evidence.
