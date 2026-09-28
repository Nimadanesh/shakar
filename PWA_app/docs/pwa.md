# PWA

Installability, offline behavior, and performance budgets for the Shekar PWA.
Decisions here are locked; changing them requires updating this doc first.

## Identity (manifest)

- `name`: Shekar — شکار | `short_name`: شکار
- `lang`: `fa`, `dir`: `rtl` (entire app is Persian, RTL)
- `display`: `standalone`
- `theme_color`: `#0B0B0D` (page background token)
- `background_color`: `#0B0B0D`
- `start_url`: `/` (with UTM-free clean URL)
- Manifest lives at `public/manifest.webmanifest`, linked from `src/app/layout.tsx`.

## Icons (`public/icons/`)

| File | Size | Purpose |
| ---- | ---- | ------- |
| `icon-192.png` | 192×192 | Manifest minimum |
| `icon-512.png` | 512×512 | Manifest + splash |
| `maskable-512.png` | 512×512, safe-zone padding | Android adaptive |
| `apple-touch-icon.png` | 180×180 | iOS |

- Source artwork: "شکار" wordmark in `#FF4D3A` on `#0B0B0D`. No photographic detail (must stay legible at 48px).
- Favicon + OG image live in `public/seo/` per project structure.

## Offline strategy

Full search is impossible offline (Divar data comes from the network via our API).
The PWA degrades gracefully instead of breaking:

- **App shell** (layout, tab bar, headers): cached, instant on repeat visits.
- **Saved searches + favorites** (`/my`, `/saved`): served from the last synced
  server snapshot; clearly badged in Persian when stale (e.g. «آخرین به‌روزرسانی: ۲ ساعت پیش»).
- **Search + ad detail** (`/`, `/ads/[id]`): network-first. On failure show the
  Persian offline state with retry — never fake results.
- **Mutations** (favorite/unfavorite while offline): queued locally, synced on
  reconnect, conflicts resolved server-wins with user notice.

## Service worker

- Implementation: `next-pwa` (per `techStack.md`) with runtime caching:
  - Static assets (`/_next/static/*`, fonts, icons): stale-while-revalidate.
  - App shell routes: stale-while-revalidate with network fallback timeout ~3s.
  - API routes (`/api/*`): network-first, cache GET responses only as
    offline fallback (short TTL, see `integrations.md`); never serve search
    results older than the offline badge threshold without labeling them stale.
- The service worker must never cache authenticated responses across users
  (key caches by session or keep user data out of the SW cache entirely).
- On new deployment: prompt-less auto-update with a Persian toast
  («نسخه جدید آماده است — برای اعمال، صفحه را تازه‌سازی کنید»).

## Installability acceptance

- [ ] Lighthouse PWA audit passes (installable, splash, themed omnibox, maskable icon).
- [ ] `manifest.webmanifest` serves with correct content-type.
- [ ] iOS: `apple-touch-icon` + `apple-mobile-web-app-capable` meta set.
- [ ] Install prompt copy is Persian, concise, no marketing fluff (per brief tone).
- [ ] Offline walkthrough verified: airplane mode on `/`, `/ads/[id]`, `/saved`.

## Performance budgets (scale gate)

Shekar must stay fast under many concurrent users. The hard bottleneck is the
divar-mcp quota (~60 req/min/IP), not Vercel — so budgets protect both the
client and our server quota:

- **Client:** LCP ≤ 2.5s on 4G (Moto G4-class), INP ≤ 200ms, CLS ≤ 0.1.
- **JS:** initial load < 250 KB gzip per route; ad lists virtualized
  (no unbounded DOM growth on infinite scroll).
- **Images:** `next/image` only, modern formats, explicit sizes; no layout shift.
- **Server:** every Divar-facing call goes through the queued, cached helper
  (`integrations.md`). No route may fan out unbounded MCP calls per request
  (cap + paginate; cache lists ~2–5 min, details longer).
- **DB:** pooled connections (Supabase pooler); no per-request migrations.
- Budgets are checked before release per `release-readiness`; regressions are
  P0 bugs, not polish.
