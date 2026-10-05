"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, User, Wallet } from "lucide-react";
import { PlanSheet } from "@/components/plan/PlanSheet";
import { listKamins, kaminNewIds } from "@/lib/kamin-store";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";

function AvatarButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="پروفایل"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.96]"
    >
      <User size={18} aria-hidden="true" />
    </button>
  );
}

function NotificationButton({ onClick }: { onClick: () => void }) {
  const unread = useMemo(() => {
    try {
      return listKamins().reduce(
        (sum, k) => sum + kaminNewIds(k, SEARCH_FIXTURES).length,
        0
      );
    } catch {
      return 0;
    }
  }, []);

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
 * App header: three elements — Telegram-style user avatar (→ profile),
 * plan (→ the financial surface), notifications (→ the «شکار من» inbox).
 * No wordmark, no hunt CTA: the hunt form owns all of that now.
 */
export function Header() {
  const router = useRouter();
  const [planOpen, setPlanOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-screen-sm items-center justify-between px-4">
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
