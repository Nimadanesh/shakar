# AdCard (+ ShekarScoreBadge) Specification

## Overview
- **Target files:** `src/components/ads/AdCard.tsx`, `src/components/ads/ShekarScoreBadge.tsx` (badge tiny, co-specified here)
- **Page / section:** `/` list item; reused in `/saved` favorites (same card style per `requirements.md` §1.6)
- **Interaction model:** click-driven (open detail, favorite toggle, share) — card is a link with nested action buttons

## Structure
- `article` card: `bg-card` (`#161618`), border, rounded-2xl (16px), padding 12–16px, col gap 8px
  - Top: image (`next/image`, 16/10 aspect, rounded 8px) + favorite icon-button (top-start overlay, 40px target)
  - Title (1-line clamp, 14px medium) → link to `/ads/[id]`
  - Price row (bold, Persian digits + «تومان»; «توافقی» when null)
  - Description snippet (2-line clamp, 13px `text-muted-foreground`)
  - Score row: `ShekarScoreBadge` + up to 2 smart-tag chips
  - Meta row: city/neighborhood • time-ago (11–12px muted)
- Badge: pill, `bg-accent` (`#F5A623`) + `text-accent-foreground` (`#0B0B0D`), mono-ish numerals, `★ ۸۷` format; `aria-label="Shekar score 87 of 100"`.
- Props: `AdCard({ ad }: { ad: ShekarAd })` where `ShekarAd` extends `DivarAd` with `shekarScore: 0–100`, `smartTags`, `matchReasons?` (per `dataModels.md`). Favorite state via `isFavorite` + `onToggleFavorite` (auth handled by caller).

## Design tokens & layout
- Semantic tokens only; image fallback block `bg-muted` (`#27272A`) with Lucide `ImageOff` when URL missing.
- Tags: neutral chips `bg-muted text-muted-foreground`, except «تطابق بالا» tinted primary-soft; max 2 + overflow hidden (no wrap explosion on 390).
- Compact density but readable: card gap 8–12px; list gap 12px; min card height stable to avoid CLS (image aspect fixed).
- Breakpoints: 390 full-width stack; 768 same (optionally 2-col deferred — NOT in MVP); 1440 centered column.
- RTL: score badge at row-start (right); price numerals LTR-isolated via `dir="ltr"` span inside RTL text when mixing.

## States & behaviors
- default / hover (desktop only, `@media (hover:hover)`: border brightens, image subtle scale 1.02, 200ms `ease-out`) / focus-visible (ring on card link) / active press (`scale(0.97)` on favorite button, 100–160ms).
- Favorite: optimistic toggle + `aria-pressed`; unauthenticated → auth modal trigger (caller), no silent drop; offline → queued notice «به‌زودی همگام می‌شود».
- Loading handled by parent skeletons; card itself has no spinner. Expired/sold ad (if flagged): dimmed + «ناموجود» badge, still openable.
- Motion: transform/opacity only; reduced-motion → no image zoom, instant chip changes.

## Content (Persian)
- Tags map: `high-match`→«تطابق بالا», `good-price`→«قیمت خوب», `new`→«جدید».
- Time-ago: «۲ ساعت پیش», «دیروز»; location: «تهران، سعادت‌آباد».
- Favorite labels: «افزودن به علاقه‌مندی‌ها» / «حذف از علاقه‌مندی‌ها»; share: «اشتراک‌گذاری»; image alt: ad title (meaningful) or empty for decorative fallback.
- Never render mock/seed ads as live results (truthfulness rule); snippet is truncated real description.

## Acceptance
- [ ] Same card renders in `/` and `/saved` without forks
- [ ] Score 0–100 always visible; tags ≤2; Persian digits/price correct
- [ ] Keyboard: card link + favorite both reachable, no nested-link violation (favorite is `button`, stops propagation)
- [ ] RTL, 390/768/1440, no CLS (fixed media aspect), reduced-motion safe
- [ ] No MCP/client-fetch inside; pure presentational from props
- [ ] `npx tsc --noEmit` clean
