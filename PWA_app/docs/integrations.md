# Integrations

Boundaries for every external dependency. Agents must read this before touching
any data-fetching code. Violations are correctness bugs, not style issues.

## divar-mcp (Divar ads data)

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

## Auth — Mobile + OTP (P1, structure-ready)

- Provider deferred (Kavenegar / Ghasedak / SMS.ir or mock for early MVP).
- A mock OTP service is allowed **in development only**, clearly labeled in
  code and UI copy, and must fail closed (never authenticates in production
  builds). Real OTP is a pre-launch blocker, not polish.
- Sessions via Next.js cookies/JWT or Supabase Auth; guests can search and
  view, mutations require auth (`brief.md` flows).

## Payments (post-MVP)

- Gateway deferred (Zarinpal / IDPay). For MVP: subscription status fields +
  feature gating only. No real charge paths exist — do not scaffold any.

## Adding a new integration

1. Document it here first (source, quota, failure modes, cache policy).
2. Server-side helper + mocked boundary tests (`testing.md` rule 2).
3. Secrets via environment variables only; never log or return them.
4. Update the release checklist if it changes user-visible behavior.
