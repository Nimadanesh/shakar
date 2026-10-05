"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, User, Wallet } from "lucide-react";
import { PlanSheet } from "@/components/plan/PlanSheet";
import { profileInitials, useProfile } from "@/hooks/useProfile";
import { useHydratedStore } from "@/hooks/useHydratedStore";
import { listKamins, kaminNewIds } from "@/lib/kamin-store";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";

function AvatarButton({ onClick }: { onClick: () => void }) {
  const { name } = useProfile();
  // Safe to compute during render: useProfile hydrates to "" on first render
  // (matching the server), so initials start empty everywhere.
  const initials = profileInitials(name);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="پروفایل"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.96]"
    >
      {initials !== "" ? (
        <span className="text-[15px] font-semibold leading-5">{initials}</span>
      ) : (
        <User size={18} aria-hidden="true" />
      )}
    </button>
  );
}

function NotificationButton({ onClick }: { onClick: () => void }) {
  // Session-cached: the known kamins render on the first paint of every
  // navigation — no badge pop-in. Freshness comes from the cache
  // invalidation events (markKaminSeen / armKamin / disarmKamin), so the
  // old pathname-triggered recompute is unnecessary.
  const { value: kamins } = useHydratedStore("kamins", listKamins);
  let unread = 0;
  try {
    unread = (kamins ?? []).reduce(
      (sum, k) => sum + kaminNewIds(k, SEARCH_FIXTURES).length,
      0
    );
  } catch {
    unread = 0;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={unread > 0 ? `اعلان‌ها — ${unread.toLocaleString("fa-IR")} تازه` : "اعلان‌ها"}
      className="relative flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.96]"
    >
      <Bell size={20} aria-hidden="true" />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute left-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold tabular-nums text-white"
        >
          {unread > 9 ? "۹+" : unread.toLocaleString("fa-IR")}
        </span>
      )}
    </button>
  );
}

/**
 * App header: a floating capsule mirroring the bottom tab bar — three
 * elements only: Telegram-style user avatar (→ profile), plan (→ the
 * financial surface), notifications (→ the «شکار من» inbox).
 * No wordmark, no hunt CTA: the hunt form owns all of that now.
 */
export function Header() {
  const router = useRouter();
  const [planOpen, setPlanOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 px-4 pt-3">
        <div className="mx-auto flex h-14 w-full max-w-screen-sm items-center justify-between rounded-[28px] border border-border bg-secondary/70 px-2 shadow-[0_8px_32px_rgb(0_0_0/0.35)] backdrop-blur-xl">
          <AvatarButton onClick={() => router.push("/profile")} />
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setPlanOpen(true)}
              aria-label="پلن و هزینه‌ها"
              className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.96]"
            >
              <Wallet size={20} aria-hidden="true" />
            </button>
            <NotificationButton onClick={() => router.push("/saved")} />
          </div>
        </div>
      </header>
      <PlanSheet open={planOpen} onClose={() => setPlanOpen(false)} />
    </>
  );
}
