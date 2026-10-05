# Profile Specification (2026-10-05)

## Overview
- **Target files:** `src/app/profile/page.tsx` (rewrite), `src/hooks/useProfile.ts`
  (new), `src/components/layout/Header.tsx` (avatar initials).
- **Page / section:** `/profile` — account and settings only (userFlow.md §7).
  No page title (bottom nav already labels it — same rule as شکار من/آرشیو).
- **Navid's laws:** simplicity (2–3 moves), one button geometry (h-11/8px),
  no invented data, docs in sync.

## Sections (in order)
1. **هویت** — Telegram-style avatar circle (64px) + name. No name yet →
   «مهمان» + «ثبت نام» button. Edit flow: display → «ویرایش» → input +
   «ذخیره»/«انصراف». Name persists locally (`shakar:profile:v1`) and feeds
   the header avatar initials. Auth-gated server identity is future;
   nothing here pretends to be an account.
2. **اشتراک** — 3 honest rows (اشتراک فعلی / شکارهای این ماه / سهمیه
   باقی‌مانده — same real computation as PlanSheet, «—» where undecided)
   + full-width outline button «جزئیات پلن و هزینه‌ها» opening the existing
   `PlanSheet` (reused, not duplicated).
3. **تنظیمات** — theme switch (existing `ThemeSwitch`). Nothing invented.
4. **داده‌های من** — real counts (کمین‌های فعال • علاقه‌مندی‌ها • شکارها) +
   two-step `ConfirmButton` «پاک کردن داده‌های محلی» (destructive).
   Clears hunts/kamins/favorites only — theme and onboarding flags survive.

## Header avatar
`AvatarButton` reads the profile name via `useProfile()`: name set →
initials (first letters of first two words, e.g. «نوید دانش» → «ند»);
no name → the generic `User` icon as today. Same-tab updates via a
`shakar:profile` window event (+ `storage` for other tabs).

## States
- Guest (no name): «مهمان» label, CTA to set name.
- Editing: input focused, save disabled on empty/unchanged.
- After data wipe: transient «داده‌ها پاک شد» confirmation.
- RTL, both themes, 44px targets.

## Acceptance
- [ ] Set name → header avatar shows initials immediately (no reload).
- [ ] Plan rows match PlanSheet numbers; undecided shows «—».
- [ ] Wipe requires two taps; theme/onboarding survive.
- [ ] `npx tsc --noEmit` + `npm run build` green; 390px QA screenshots.
