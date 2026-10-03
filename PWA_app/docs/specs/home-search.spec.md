# Home Search Page Specification

## Overview
- **Target file:** `src/app/page.tsx` (thin composition only; no business logic)
- **Page / section:** `/` (Ads / Search) — P0 main screen per `docs/brief.md` routes table
- **Interaction model:** click-driven (search submit, filter open, card tap) + scroll-driven (list scroll)

## Structure
- `main` (flex col, `py-4`)
  - `SearchFilters` (client island; see `SearchFilters.spec.md`) — the single search entry; header pill shortcuts to it via focus event
  - Result meta row: match count + sort note (server-rendered text, Persian) — appears once backend is wired
  - `AdList` region: vertical stack of `AdCard` (see `AdCard.spec.md`), `gap-3`
  - Sentinel div for infinite scroll (IntersectionObserver; progressive enhancement — pagination fallback link «صفحه بعد» when JS off)
- Page stays thin: composes sections, holds no fetch logic. No intro title/subtitle — first-run explanation lives in onboarding (deferred). Data arrives via server (Route Handler / Server Action per `docs/integrations.md`); list interactivity lives in islands.

## Design tokens & layout
- Page bg `bg-background` (`#0B0B0D`), text `text-foreground` (`#F4F4F5`); horizontal padding 16px (already in layout shell `px-4`, max-width `max-w-screen-sm`).
- Type: page title 18–20px bold Vazirmatn; body 13–14px/1.6–1.7; meta/labels 11–12px `text-muted-foreground` (`#A1A1AA`).
- Cards surface `bg-card` (`#161618`), border `border-border` (`#27272A`), rounded-2xl (16px), padding 12–16px.
- Primary CTA red `#FF4D3A`; Shekar Score accent amber `#F5A623`. No hard-coded hex in components — semantic tokens only.
- Breakpoints: mobile 390 single column (primary); tablet 768 same column, slightly wider gutters; desktop 1440 centered `max-w-screen-sm`, no multi-column grid for MVP.
- RTL: `dir="rtl"` inherited; price/numbers use Persian glyphs with English fallback; icons mirror-safe (no directional icon without `rtl:rotate-180` check).

## States & behaviors
- default: filters collapsed to query bar + «فیلترها» trigger; list shows ranked `ShekarAd[]`.
- loading: skeleton cards (image block + 2 text lines shimmer) ×3, `aria-busy="true"`; skeletons use `bg-muted` (`#27272A`), no layout shift (fixed image aspect).
- empty: «نتیجه‌ای پیدا نشد. فیلترها را کمتر کنید.» + «حذف فیلترها» ghost button.
- error: rate-limit/timeout/offline mapped to Persian copy per `integrations.md` («محدودیت موقت دیوار — چند ثانیه بعد تلاش کنید» + «تلاش مجدد»); cached results labeled stale when shown («آخرین به‌روزرسانی: …»).
- Transitions 150–250ms `ease-out`; list enter stagger 30–80ms max; `prefers-reduced-motion` → opacity cross-fade only, no slide/spring.
- Scroll: infinite append via sentinel; preserves scroll position on back-navigation; virtualize or cap DOM when list grows (per `pwa.md` budgets).

## Content
- Result meta: «۱۲۴ نتیجه — مرتب‌سازی: امتیاز شکار» (count from server, never invented).
- All UI strings Persian; code/comments/aria-labels English where technical (`aria-label="Search results"` allowed alongside Persian visible text).
- Images: real Divar URLs via `next/image` with explicit sizes; graceful fallback block when missing (no broken-img icon).

## Acceptance
- [ ] Matches `designSystem.md` tokens, spacing scale, radius, dark-only
- [ ] RTL correct; Persian copy; no English UI strings
- [ ] Responsive: 390 primary, 768 sane, 1440 centered — no horizontal scroll
- [ ] Loading / empty / error / stale states all render with Persian copy
- [ ] No client import of MCP helpers; data via server boundary only
- [ ] `npx tsc --noEmit` clean; `npm run check` green
