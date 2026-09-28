# Testing

What gets tested, how, and which gates block a release. Testing is part of
"done" — see `release-readiness` skill and `workflows.md`.

## Levels (MVP)

| Level | Tool | Status | Scope |
| ----- | ---- | ------ | ----- |
| Unit | Vitest | **required now** | Pure logic: text normalization, keyword include/exclude, Shekar Score, tag rules, formatting helpers |
| Component | Vitest (+ Testing Library, on demand) | as needed | Only for state-heavy interactive pieces (filters panel, auth-gated actions) |
| E2E | Playwright | **deferred post-MVP** | P0 flows (`/` search → `/ads/[id]` → save/favorite); add when UI stabilizes |

## Rules

1. **Pure logic lives in `src/lib/` and is always unit-tested.** Scoring,
   filtering, and matching must never depend on network, DOM, or framework
   state — if a function needs the network, it does not belong in `lib/`.
2. **No network in unit tests.** The divar-mcp boundary is mocked at the
   helper layer; tests use small Persian fixtures (real ad shapes, tiny).
3. **Colocate tests:** `foo.ts` → `foo.test.ts` next to it. No distant
   `__tests__` folders.
4. **Persian fixtures are mandatory** for anything touching ad text
   (normalization, keywords, snippets). ASCII-only tests do not prove the
   matching works.
5. **Every test asserts behavior, not implementation.** One behavior per test,
   named in English (`rejects ads containing excluded keywords`).
6. Regressions get a failing test first (see `systematic-debugging` /
   `test-driven-development` skills).

## Commands

```bash
npm run test        # vitest run (CI-safe, single pass)
npx vitest          # watch mode during development
npm run check       # lint + typecheck + test + build (full gate)
```

## Coverage expectations (MVP)

- `src/lib/` pure functions: high coverage, including Persian edge cases
  (half-spaces/ZWNJ, Arabic vs Persian Yeh/Kaf, diacritics, mixed fa/en,
  empty input).
- Route handlers: test the validation + error-mapping layer, not the MCP.
- UI: smoke via `npm run build` + visual QA (`workflows.md`); component
  tests only where interaction logic is non-trivial.

## What is NOT tested in MVP

- Live divar-mcp responses (quota + flakiness; covered by mocked boundaries).
- Pixel-perfect visuals (covered by breakpoint QA in `workflows.md`).
- OTP/SMS providers and payment gateways (deferred post-MVP per `brief.md`;
  structure covered by validation tests only).
