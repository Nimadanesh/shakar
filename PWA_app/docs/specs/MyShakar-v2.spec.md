# MyShakar v2 — tabs, live/dead split, rich kamin cards, two-step confirm (2026-10-05)

Navid's polish round: (1) sections become top tabs, (2) kamin cards carry the
full hunt definition, (3) destructive actions need two-step confirm,
(4) one button geometry everywhere, (5–6) live tabs stay in «شکار من»,
dead tabs move to a new «آرشیو» page.

## Information architecture (new)

~~~text
Bottom nav: شکار | شکار من | آرشیو | پروفایل

شکار من (/saved) — LIVE: the user is waiting for answers
├── Tabs (top, segmented): تازه‌ها (N) | کمین‌ها (N)
├── تازه‌ها: fresh kamins (new-match badges) or honest empty state
└── کمین‌ها: quiet watchers or honest empty state

آرشیو (/archive) — DEAD: needed, not followed
├── Tabs (top, segmented): تاریخچه (N) | علاقه‌مندی‌ها (N) | ذخیره‌شده‌ها
├── تاریخچه: returnable /hunt/[id] rows
├── علاقه‌مندی‌ها: favorite rows → ad detail
└── ذخیره‌شده‌ها: honest empty state (needs identity + backend)
~~~

Rationale (Navid): after weeks of use, five stacked sections don't scan.
Live tabs (user awaits an outcome) stay where the bell points; dead tabs
(user opens on demand) move out of the way. No tab is more than 2 taps
from its job.

## KaminCard — rich definition (the 2-days-later user)
A returning user must recognize the hunt without opening it:
- Row 1: name + «N تازه» badge (when fresh)
- Definition block (read-only, `bg-secondary/50`, 6px radius):
  - the «چی؟» query (2-line clamp)
  - mini chips: include (solid) + exclude (struck-through term)
  - filter line, only when non-default: city • category • price range •
    «عکس‌دار» (labels via `data/taxonomy`, compact prices)
- «دیدن نتایج»: solid when fresh, outline when quiet (full-width, h-11)
- «غیرفعال کردن»: secondary button with **two-step confirm**
  (tap → «برای تأیید دوباره بزن» destructive tint, 3s timeout → tap again)

## ConfirmButton (shared, `components/ui/ConfirmButton.tsx`)
Two-step inline confirm for destructive actions: idle → armed → action.
No modal, no navigation loss. `aria-live` announces the armed state.
Timeout reverts. Used wherever a stray tap must not fire.

## SegmentedTabs (shared, `components/ui/SegmentedTabs.tsx`)
In-page tab bar: `role=tablist`, container 8px, buttons h-10, active =
tinted surface + foreground text (never solid per designSystem §4),
counts in labels. Tab state also reflected in `?tab=` for deep-linking.

## Button uniformity (Navid #4)
One geometry: h-11, 8px radius, full-width for primary page actions.
Fix: `EmptyState` rendered its lone primary action at half width
(2-col grid with an empty placeholder) — now full width when solo.
`ConfirmButton` matches the same h-11/rounded-lg metrics.

## Move budget (unchanged, still 1–2)
Fresh → triage 1 tap · quiet → results 1 tap · disarm 2 taps (confirm) ·
history resume 1 tap · favorite → detail 1 tap · archive tab switch 1 tap.

## Honesty (unchanged)
Kamin = local diffing; re-run = new paid hunt (explicit CTA);
saved-hunts = honest empty until backend identity; no invented counts —
tab counts come from real lists.

## Acceptance
- [ ] /saved shows only تازه‌ها/کمین‌ها tabs; /archive the other three.
- [ ] Kamin card shows query + chips + filters; recognizable after days.
- [ ] Disarm needs two taps; stray tap does nothing.
- [ ] All buttons h-11/rounded-lg; EmptyState solo action full-width.
- [ ] Bell → /saved still lands on the live inbox.
- [ ] `npx tsc --noEmit` + `npm run build` green; 390px QA (seeded) shots.
