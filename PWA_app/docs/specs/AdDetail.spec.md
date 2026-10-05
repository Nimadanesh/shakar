# AdDetail Specification — verification-focused redesign (2026-10-05)

## Overview
- **Target files:** `src/app/ads/[id]/page.tsx`, `src/components/ads/AdDetailGallery.tsx`,
  `src/components/ads/WhyMatched.tsx`, `src/components/ads/DescriptionEvidence.tsx`,
  `src/components/ads/ShareButton.tsx`; context threading via
  `HuntTriagePage` → `ResultsView` → `AdCard`/`AdCardCompact` (`detailQuery` prop);
  `src/app/saved/page.tsx` (adds `from=saved`).
- **Page / section:** `/ads/[id]` — the VERIFY step of define → fire → triage → verify → act.
- **User job:** «آیا این آگهی واقعاً همان چیزی است که دنبالش بودم؟»
  (userFlow.md §10, PAGE-EXPERIENCE-SPECS-V1.md §5). Evidence first; relevance
  before the full description.

## The product-critical fix
The «چرا این آگهی؟» section was dead in the main flow: triage cards linked to
`/ads/[id]` with no search params, so the detail page had no evidence context.
Now triage links carry the hunt's exact context statelessly:

~~~text
/ads/<id>?hunt=<huntId>&q=<query>&inc=<t>&exc=<t>&cat=&city=&min=&max=
~~~

- Built in `HuntTriagePage` from the already-computed `ctx` (the same intent the
  user paid for — never re-interpreted).
- Detail page parses params into `SearchContext` (same parser as before).
- Back target: `hunt` → `/hunt/[huntId]` (restores triage context);
  `from=saved` → `/saved`; otherwise `/`.
- Without include/exclude terms (direct link, favorites), the «چرا این آگهی؟»
  section is HIDDEN — evidence is never invented.

## Structure (in order)
1. **Back** — «بازگشت به نتایج» text link + ArrowRight icon (RTL-correct).
2. **Gallery** (`AdDetailGallery`) — aspect 16:10, `rounded-lg`, `next/image`
   with `object-cover`; `images.length > 1` → horizontal snap carousel;
   thumbnail-only → single image; none → honest empty state
   (`ImageOff` + «تصویری ثبت نشده»). No decorative manipulation.
3. **Header** — title (`heading-xl` 24px/600), price as typographic hero
   (22px bold, tabular-nums, tracking-tight; «توافقی» when null),
   meta line: city، neighborhood • createdAt (13px `text-secondary`).
4. **Actions** (above fold, spec §5.2) — `FavoriteButton` (outline, auth-gated as
   before) + `ShareButton` (Web Share API, clipboard fallback); `OpenOriginal`
   rendered **disabled with an honest caption**
   («آدرس اصلی در داده‌ی نمایشی موجود نیست») — no fake functionality,
   layout stays real for the backend phase.
5. **«چرا این آگهی؟»** (`WhyMatched`, only when ctx has terms) — checklist per
   PAGE spec §5.5:
   - `✓ «یاماها» — در متن آگهی دیده شد` (signal; certainty «شناسایی‌شده»)
   - `✓ «دیجیتال» — در متن دیده نشد` (excluded term verified absent, signal)
   - `؟ …` unknown rows would use warning (no prefs channel in MVP — reserved)
   - **Negative evidence** (warning): an excluded term that IS found in text →
     `««دیجیتال» در توضیحات دیده شد»` + note «این با فیلتر حذف شما مغایرت دارد»
     (factual per §5.8/§10 — detection, never a conclusion about the item).
   - Match status: «تطابق بالا» (signal) only when every include term is
     detected AND every excluded term is verified absent; otherwise no badge —
     never a strong treatment with unresolved requirements.
6. **«توضیحات فروشنده»** (`DescriptionEvidence`) — FULL seller text, intact;
   include-term hits highlighted (same `text-signal` treatment as cards).
   Never rewritten as verified truth.
7. **«اطلاعات آگهی»** — definition rows (دسته‌بندی، شهر، محله، قدمت آگهی) with
   hairline dividers in an 8px card. No seller facts — fixtures expose none,
   and nothing is inferred.

## Design tokens & layout
- Semantic tokens only; monochrome base; signal = detected evidence,
  warning = ambiguity/negative evidence. No new colors.
- Radius: cards/sections/buttons 8px (`rounded-lg`); back link is a text link
  (no pill — button geometry stays one consistent 8px).
- Mobile: single column, 16px gutter, section gap 24–32px; description
  `leading-7`; touch targets ≥44px; safe-area respected.
- RTL throughout; price `dir="auto"`; long Persian strings must not break layout.

## States & behaviors
- Unknown id → `notFound()` (existing).
- `ShareButton`: `navigator.share` → fallback `navigator.clipboard.writeText`
  → transient «پیوند کپی شد» label; SSR-safe (client component).
- Empty description → section omitted (never backfilled).
- Focus-visible rings on all interactive elements; `prefers-reduced-motion`
  respected (no entrance animation on this page).
- Dark/light parity in visual QA.

## Content (Persian)
- «بازگشت به نتایج»، «چرا این آگهی نمایش داده شده؟»، «توضیحات فروشنده»،
  «اطلاعات آگهی»، «علاقه‌مندی»، «اشتراک‌گذاری»، «باز کردن آگهی اصلی»،
  «آدرس اصلی در داده‌ی نمایشی موجود نیست»، «تصویری ثبت نشده»،
  «در متن آگهی دیده شد»، «در متن دیده نشد»، «شناسایی‌شده»، «تطابق بالا».

## Acceptance
- [ ] Opening a card from `/hunt/[id]` shows the «چرا این آگهی؟» checklist
      reflecting that hunt's exact terms; back returns to that hunt.
- [ ] Direct/favorite entry shows no why-section; back goes to `/saved` or `/`.
- [ ] `npx tsc --noEmit` + `npm run build` green; 390px + 1440px QA screenshots
      in `~/workspace/previews/`; docs updated if behavior changed.
