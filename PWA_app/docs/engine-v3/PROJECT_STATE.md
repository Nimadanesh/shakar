# Project State — Engine V3

Last verified: 2026-10-21
Work branch: `engine_v3`
Branch base: `10f3c40d70748ff27d6928eaed0875e10dab1c56`
Base source: `main`, commit message: `Merge branch 'feat/engine-v2' (dead-code cleanup)`

## Mission

Maximize the probability that a professional Divar user reaches the best genuinely relevant ads quickly. Optimize real-user result quality, not model sophistication, code volume, or passing synthetic tests alone.

The human owner acts primarily as a blinded/consistent end-user evaluator:
- run the requested hunt scenarios in the product;
- grade whether the top results are genuinely relevant and whether critical constraints are respected;
- report observed output and unexpected behavior.
The technical agent owns code investigation, architecture, test design, implementation choices, measurement, and go/no-go recommendations. User feedback is evidence, not an instruction to adopt a particular technical solution.

## Verified repository state

- `engine_v3` was created from current `main` SHA above.
- The branch is isolated: the current comparison against `main` showed six initial commits containing only new V3 control documents. No source files were modified during setup.
- Existing engine code lives under `PWA_app/src/lib/server/hunt/` and `PWA_app/src/lib/server/divar/`.
- A deterministic synthetic benchmark exists at `PWA_app/src/lib/server/hunt/search-quality-benchmark.ts`, version `2026-10-09-v1`, with 16 cases. Its documentation says it is a seed benchmark, not a representative live-market benchmark.
- A golden benchmark and a harness integrity gate exist under `PWA_app/scripts/`; they have not been run by this audit.
- Human-evaluation packets and replay artifacts exist in the separate repository `Nimadanesh/shakar-eval-tmp-20261012`. See `BASELINE_AUDIT.md`; protect all frozen captures, pinned versions, grades, and mappings.
- The current engine architecture document points to an older main commit (`4fe671e`) than the audited current main SHA. The 2026-10-09 search-quality roadmap is also historical. Reconcile docs against code rather than assuming either is current.
- No tests, builds, live Divar hunts, or deployments were run in V3 setup/audit.
- A local clone attempt failed because the execution container could not resolve GitHub; the container Node version is 22.16.0, below the package's declared Node >=24. No execution result may be inferred from this.

## Important quality risks to verify

These remain audit hypotheses, not proven current defects:
1. Relevant ads may be missed because of retrieval coverage, query construction, pagination, deduplication, or detail-budget allocation.
2. Explicit constraints may be mishandled when evidence is missing, stale, or ambiguous.
3. Entity/kind confusion (e.g. a part/accessory vs the whole item) may produce irrelevant results.
4. Service intent and transaction direction may be confused.
5. Global synonym expansion may collapse related-but-distinct concepts.
6. Mizan's effective role may differ by runtime configuration; inspect code/config before assuming it affects ranking.
7. Code correctness and synthetic tests do not establish human top-result quality.

## Current phase

**Phase 0 — Establish a trustworthy baseline (in progress).**

Completed:
- branch created from current main;
- durable control documents added;
- source tree, docs, benchmark and human-evaluation artifacts inspected remotely;
- initial baseline audit written in `BASELINE_AUDIT.md`.

Not complete:
- execute tests/build/typecheck/lint in a compatible Node >=24 environment;
- run the golden harness gate with the correct frozen inputs where available;
- verify current R1/R2 status and exact candidate pins without modifying them;
- reconcile the architecture/quality docs with the current code;
- produce a code-level prioritized failure register with testable hypotheses.

## Next action

Get an authorized execution environment with Node >=24 and the branch checked out; run focused search tests, full tests, typecheck, lint, build, and the golden harness gate only with correct inputs. Record exact command output and failures. Do not implement engine features until Phase 0's exit gate is met. No deployment or external service mutation.
