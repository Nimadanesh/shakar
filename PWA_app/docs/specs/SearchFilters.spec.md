# SearchFilters Specification

## Overview
- **Target file:** `src/components/search/SearchFilters.tsx` (+ co-located `SearchFilters.test.ts` for pure helpers if split out)
- **Page / section:** `/` top section; also reused as source of SavedSearch payload (`dataModels.md` §SavedSearch)
- **Interaction model:** click-driven (submit, expand advanced, chip remove, save-search trigger)

## Structure
- `form role="search"` (`onSubmit` → server action; works without JS)
  - Hero query pill (standalone, NOT inside a card): search icon + input + submit arrow-button that appears only while typing. Enter submits.
  - Quick row: category select + city select (native `select`, pill-shaped, custom chevron with 16px edge offset + text clearance)
  - «فیلتر دقیق‌تر» disclosure: ONE flat container (`rounded-[20px]`, `p-4`) holding price min/max + two `KeywordChips` + has-image checkbox. Max 2 nesting levels everywhere.
  - «ذخیره جستجو» secondary button (auth-gated → triggers OTP flow per `userFlow.md` §4; guest sees login prompt, no silent fail)

## Design tokens & layout
- Flattened hierarchy: query pill and selects sit directly on page background; only the advanced group is a container. No box-in-box-in-box.
- Query pill: `h-12`, `rounded-full`, `bg-card`, border, soft shadow; input 14px; submit arrow `size-9 rounded-full bg-primary`.
- Selects: `h-11 rounded-full`, chevron 16px muted at `end-4`, text cleared with `pe-10`.
- Advanced container: `rounded-[20px]` outer → inner fields `rounded-xl` (12px, one step down per nesting rule), `p-4`, inner gaps 16px (`gap-4`).
- Labels 13px medium `text-foreground`; label→field gap 8px (`gap-2`); inputs `h-11`, radius 12px, dark surface, focus ring `ring`.
- Icons monochrome `currentColor` throughout (Plus/Minus muted 14px in chip labels; no color-coded icons).
- Type/body per design system; full-width on 390; 768+ keeps single column (price min/max 2-col grid).
- RTL: min/max order mirrored correctly; numeric inputs `inputMode="numeric"`, Persian digits accepted (normalize via `normalizePersian`).

## States & behaviors
- default / focus-visible (ring) / disabled (submitting) / loading (submit shows spinner + «در حال جستجو…», form inert).
- Validation: priceMin ≤ priceMax else «کف قیمت از سقف بیشتر است»; mobile-format not here; keyword length cap (e.g. 20 terms) with «حداکثر ۲۰ کلمه».
- Chips: each removable via button; removal re-submits (progressive: full submit; JS enhancement debounced 300ms for chip-only changes).
- Motion: disclosure expand 200ms `ease-out` (height via grid-rows trick, transform/opacity only); reduced-motion → instant.
- Submit serializes to `SavedSearch`-compatible params: `{ query, category, city, priceMin, priceMax, includeKeywords, excludeKeywords, extraFilters }`; keywords split on whitespace/comma, normalized with `normalizePersian`, empty dropped.

## Content (Persian)
- Query: placeholder «چی شکار می‌کنی؟»
- Include: label «این کلمات در توضیحات باشد» placeholder «بنویس و Enter بزن…»
- Exclude: label «این کلمات در توضیحات نباشد» placeholder «بنویس و Enter بزن…»
- Category: «همه دسته‌ها»; city: «همه شهرها»; price: «از (تومان)» / «تا (تومان)»
- Advanced trigger: «فیلتر دقیق‌تر»; save: «ذخیره جستجو»
- Keywords are chips (`KeywordChips.tsx`): Enter/comma commits, X removes, Backspace clears last. No helper copy about half-spaces — the interaction teaches itself.

## Acceptance
- [ ] Works without JS (native submit) and enhanced with JS
- [ ] No MCP/network code inside; emits params only
- [ ] Persian validation + placeholders; include/exclude visually distinct
- [ ] Keyboard reachable; focus rings; chips announced (`aria-live="polite"` count)
- [ ] RTL + 390/768/1440 sane; touch targets ≥40px
- [ ] `npx tsc --noEmit` clean; pure helpers unit-tested with Persian fixtures
