"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, User, Wallet } from "lucide-react";
import { PlanSheet } from "@/components/plan/PlanSheet";
import { profileInitials, useProfile } from "@/hooks/useProfile";
import { listKamins, kaminNewIds } from "@/lib/kamin-store";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";

function AvatarButton({ onClick }: { onClick: () => void }) {
  const { name } = useProfile();
  // Hydration-safe: the server can't see localStorage, so the first render
  // (server and client) shows the guest icon; initials land after mount.
  // Computing initials during render would mismatch (span vs svg).
  const [initials, setInitials] = useState("");
  useEffect(() => {
    setInitials(profileInitials(name));
  }, [name]);
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
  const pathname = usePathname();
  // Recompute on navigation: matches may arrive while the app is open.
  const unread = useMemo(() => {
    try {
      return listKamins().reduce(
        (sum, k) => sum + kaminNewIds(k, SEARCH_FIXTURES).length,
        0
      );
    } catch {
      return 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
