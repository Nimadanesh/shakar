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

## Verified starting facts

- `engine_v3` was created from the then-current `main` SHA above.
- Existing engine implementation lives under `PWA_app/src/lib/server/hunt/` and `PWA_app/src/lib/server/divar/`.
- The current main-branch architecture docs describe a deterministic retrieval/confirmation/ranking pipeline; Mizan is a shadow/log-only judge in the documented production path, not an active result re-ranker.
- The current repository contains engine architecture and output-quality documentation. These are historical/project documents and must be reconciled with code before treating every statement as current truth.
- The most recent main commit merged `feat/engine-v2`; therefore V3 must begin with an audit of the actual merged state rather than assumptions based on older chats.
- No tests, builds, or live Divar hunts were run during V3 branch creation.
- Initial V3 changes are documentation only. No source code was modified.

## Important known contest risks to re-verify

These are audit hypotheses, not yet re-proven against this branch:
1. Relevant ads may be missed due to retrieval coverage or candidate-budget allocation.
2. Explicit constraints can be mishandled when evidence is missing, stale, or ambiguous.
3. Entity/kind confusion (e.g. a part/accessory vs the whole item) can produce high-confidence irrelevant results.
4. Service intent and transaction direction can be confused.
5. A local Mizan endpoint may not exist in production; its current effect must be confirmed from code and runtime configuration.
6. Card-level data and detail-level evidence may disagree or be incomplete.
7. Ranking quality cannot be inferred from code review or unit tests alone.

## Current phase

**Phase 0 — Establish a trustworthy baseline.**

No feature implementation until:
- the branch and source tree are audited;
- test/build/lint/typecheck results are recorded accurately;
- the existing human-evaluation benchmark and pinned versions are identified without changing them;
- a small, fixed, repeatable query set and scoring rubric are defined or linked to existing artifacts;
- high-severity quality risks are ranked by expected impact and evidence.

## Next action

Perform a read-only audit of the current `engine_v3` source tree and the existing evaluation artifacts. Produce a baseline report with exact file/commit references, commands and outcomes where available, plus explicit unknowns. Do not deploy or modify any external service. Do not alter existing evaluation captures.
