# Integrations

Boundaries for every external dependency. Agents must read this before touching
any data-fetching code. Violations are correctness bugs, not style issues.

## divar-mcp (Divar ads data)

> PROVIDER ABSTRACTION (frozen 2026-10-06, pre-backend stage): Shakar
> depends on a `ListingProvider` interface, never on a concrete source.
> v1 implementation is our own FIRST-PARTY server-side Divar client —
> do NOT take a runtime dependency on the community divar-mcp repo
> (single-maintainer, fragile for launch); its only value is endpoint
> discovery during development. The abstraction leaves room for later
> providers (official Divar API, scraper, cached inventory, other
> marketplaces) without touching hunt/kamin logic:
>
> ```text
> Shakar Search Engine → ListingProvider → FirstPartyDivarProvider (v1)
> ```
>
> Hunt API → MCP directly is forbidden.

- **Read-only, public, free.** Search with filters, full ad details (including
  description text), category helpers. No advanced description-text search —
  keyword matching is implemented by us (`requirements.md` §1.1).
- **Server-side only, always.** MCP helpers live in server code (Route
  Handlers / Server Actions) and are never imported by client components.
  No MCP response object is passed to the client unfiltered — strip to the
  fields the UI needs.
- **Rate limit ≈ 60 requests / minute / IP.** All traffic goes through one
  queued helper that throttles and serializes calls. Direct MCP calls from
  routes are forbidden.
- **Resilience:** timeout ~8s per call, one retry on transient failures only,
  Persian error copy mapped by failure class (rate-limited / timeout /
  upstream-down / offline). Never spin-retry against the quota.
- **Caching (freshness-aware):** search lists ~2–5 min (new ads matter);
  ad details longer (content is stable). Cache keys include the full filter
  set + normalized keywords. User-scoped data is never shared across sessions.
- **Cache scoping contract (frozen 2026-10-06):** two separate caches, never
  mixed. (1) PUBLIC listing cache: provider + canonical query key →
  listing fields (id, title, description, price, images…). Shareable across
  users when privacy policy allows. (2) USER state: hunts, kamins, seen
  baselines, favorites, quota counters — strictly per-user, never leaks
  into the public cache or another session. A raw provider response is
  never served to a user unfiltered, and never stored as user state.
- **No seller phone numbers** beyond what the MCP publicly returns
  (`requirements.md`). Contact actions render only if the data exists.
- **Truthfulness:** real Divar data in production flows. Placeholder, seed, or
  mock ads are never rendered as live results (see product `truthfulness`
  rule in `product-clarity` skill).

## Database (Supabase / PostgreSQL)

- Owns: users, saved searches, favorites, subscription status
  (schema per `dataModels.md`).
- Accessed only from server code. Pooled connections; migrations never run
  per-request. For MVP scale, Supabase pooler settings are sufficient —
  revisit only with measured connection pressure.

## Auth — Mobile + OTP (M2 implemented)

- Provider: **Kavenegar** (`verify/lookup` API) in production. A provider
  interface (`src/lib/otp/provider.ts`) keeps Ghasedak/SMS.ir a one-class
  swap; changing providers never rewrites the routes.
- Sessions are **custom JWT (jose, HS256) in an httpOnly cookie**
  (`shakar_session`, 30d, SameSite=Lax, Secure in prod). The cookie is the
  real session; the client's localStorage mirror (`lib/auth.ts`) is a
  display hint only. `profiles.id` is a plain uuid PK — the old FK to
  `auth.users(id)` was dropped in migration 002 (no Supabase Auth rows
  exist for OTP users).
- Codes: 5 digits, SHA-256 hashed at rest (`otp_verifications`), 5-min
  expiry, 5 attempts, cooldown 60s, 5 sends/mobile/hour, 20 sends/IP/hour.
  Send failure deletes the record so the retry isn't punished.
- Fail-closed: production without `OTP_PROVIDER=kavenegar`,
  `KAVENEGAR_API_KEY`, `KAVENEGAR_TEMPLATE`, `SESSION_SECRET`,
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` returns `NOT_CONFIGURED` —
  never a fake send or login.
- Dev: mock provider (logs the code server-side) + any well-formed
  5-digit code verifies (documented backdoor, dev only). Env:
  `KAVENEGAR_TEMPLATE` must be a panel-approved template name.
- Routes: `POST /api/auth/request-otp`, `POST /api/auth/verify-otp`,
  `POST /api/auth/logout`, `GET /api/auth/session`.

## Payments (post-MVP)

- Gateway deferred (Zarinpal / IDPay). For MVP: subscription status fields +
  feature gating only. No real charge paths exist — do not scaffold any.

## Adding a new integration

1. Document it here first (source, quota, failure modes, cache policy).
2. Server-side helper + mocked boundary tests (`testing.md` rule 2).
3. Secrets via environment variables only; never log or return them.
4. Update the release checklist if it changes user-visible behavior.
