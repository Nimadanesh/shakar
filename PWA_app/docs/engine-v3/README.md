# Shekaar Engine V3 — Control Center

This directory is the durable source of truth for the autonomous Engine V3 workstream. Chat history is not the project database.

## Read order at the start of every session

1. [PROJECT_STATE.md](./PROJECT_STATE.md) — current verified state and immediate next action.
2. [DECISIONS.md](./DECISIONS.md) — binding technical decisions and rationale.
3. [ROADMAP.md](./ROADMAP.md) — staged plan and exit gates.
4. [EVALUATION.md](./EVALUATION.md) — benchmark protocol, measurements, and human-judge feedback.
5. [HANDOFF.md](./HANDOFF.md) — compact continuation packet for a new chat.

## Authority and scope

- Work branch: `engine_v3`.
- Baseline at branch creation: `main` commit `10f3c40d70748ff27d6928eaed0875e10dab1c56` (2026-10-21; merge of `feat/engine-v2`).
- `main` is not a work target. Do not merge, deploy, mutate services, or modify evaluation captures as part of this work unless separately and explicitly authorized.
- Existing contest/evaluation artifacts are evidence. Preserve them; never rewrite history to make a result look better.
- This branch initially contains documentation only. No engine code was changed in the setup commit.

## Session protocol

At session start, read the five control files and inspect the actual GitHub branch head. Resolve discrepancies in favor of verifiable repository state, then update these files as needed.

At session end, record:
- changed files and commit(s);
- checks actually executed and their results;
- experiments actually run and their evidence;
- unresolved risks;
- one next action with an objective acceptance gate.

Never claim tests, live Divar behavior, or quality improvement unless actually observed. A green unit-test suite is necessary evidence, not proof of contest-winning quality.
