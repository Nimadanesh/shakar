# MyShakar («شکار من») Specification — visual foundation + simplicity pass (2026-10-05)

## Overview
- **Target file:** `src/app/saved/page.tsx` (+ small shared bits only if needed)
- **Route:** `/saved` — the retention engine. Day-10 sessions start here
  (habit loop: notification → diff → triage → act), never at setup.
- **Navid's law for this pass:** سادگی — everything reachable and visible in
  2–3 moves. No nested menus, no multi-step flows, no hidden actions.

## Move budget (audit)
| Job | Moves |
|---|---|
| Fresh kamin → triage new matches | 1 tap («دیدن نتایج») |
| Quiet kamin → check current results | 1 tap («دیدن نتایج», outline) |
| Disarm a kamin | 1 tap (demoted text button; re-armable from any hunt) |
| Resume a past hunt | 1 tap (history row) |
| Open a favorite → detail | 1 tap |
| Unfavorite | 2 taps (favorite → detail → toggle) |

## Structure (unchanged order — it matches the habit loop)
1. **تازه‌ها** — fresh kamins only (dedup rule: quiet watchers never repeat here).
2. **کمین‌ها** — quiet watchers (only when they exist).
3. **تاریخچه‌ی شکارها** — returnable `/hunt/[id]` links (only when non-empty).
4. **شکارهای ذخیره‌شده** — honest empty state (needs identity + backend; not faked).
5. **علاقه‌مندی‌ها** — favorite rows → ad detail.

## KaminCard — one unified layout (the core fix)
The old card had two different layouts (fresh: 2-button grid; quiet: inline
row). Now one card for both states:
- Row 1: name («…») + «N فیلتر فعال» caption; «N تازه» badge when fresh.
- Row 2: «دیدن نتایج» full-width — **solid** when fresh (the money action of
  the retention engine), **outline** when quiet.
- Row 3: «غیرفعال کردن» demoted to a quiet text button (start-aligned).
- Re-running is a new paid hunt — explicit CTA, never a card tap.

## Visual foundation
- Section gap 24px → 32px (`gap-8`); card radius 8px; buttons 8px; one button
  geometry everywhere.
- Section headers carry honest real counts: «کمین‌ها (۲)»، «علاقه‌مندی‌ها (۳)».
- «تازه» badge: primary tint (established pattern); never invent counts.
- Hunt history rows unchanged (44px targets, date in Persian).
- Favorite rows unchanged (1 tap → detail).
- Empty states unchanged (honest, with «شروع شکار» CTA where actionable).
- RTL, both themes, `prefers-reduced-motion` respected.

## Honesty rules (unchanged)
- Kamin = local diffing only; UI copy says so («زیر نظر»).
- «دیدن نتایج» re-fires as a new paid hunt (cost label lives on the hunt side).
- Saved hunts section stays an honest empty state until backend identity lands.

## Acceptance
- [ ] Fresh kamin → 1 tap → `/hunt/[id]` with new matches; badge counts are real.
- [ ] Quiet kamin → 1 tap → current results; disarm → 1 tap.
- [ ] No section renders empty (conditional sections stay hidden when empty).
- [ ] `npx tsc --noEmit` + `npm run build` green; 390px QA screenshots
      (with seeded kamins/favorites) in `~/workspace/previews/`.
