"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Bell, Wallet } from "lucide-react";
import { getSession } from "@/lib/auth";
// Closed-by-default sheet: split into its own chunk so it never blocks
// the initial page paint.
const PlanSheet = dynamic(
  () => import("@/components/plan/PlanSheet").then((m) => m.PlanSheet),
  { ssr: false }
);
import { LogoMark } from "@/components/brand/LogoMark";
import { useProfile } from "@/hooks/useProfile";

function BrandButton({ onClick }: { onClick: () => void }) {
  const { loggedIn } = useProfile();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={loggedIn === false ? "ورود / پروفایل" : "پروفایل"}
      className="relative flex shrink-0 items-center gap-2 py-1 pl-1 transition-transform focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.97]"
    >
      <span className="relative flex text-foreground">
        <LogoMark className="size-7" />
        {/* Guest nudge: a quiet dot — this is the proactive login entry.
            Shown only once we KNOW the user is a guest (no flash for
            logged-in users). */}
        {loggedIn === false && (
          <span
            aria-hidden="true"
            className="absolute -left-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-primary"
          />
        )}
      </span>
      <span className="text-[18px] font-extrabold leading-7 tracking-tight text-foreground">
        شکار
      </span>
    </button>
  );
}

function NotificationButton({ onClick }: { onClick: () => void }) {
  // Server notifications unread count (M5B) — the ONLY badge source.
  // Local kamin "fresh" counts were fixture-derived fiction; they are
  // gone. No invented numbers on the badge, ever.
  const [serverUnread, setServerUnread] = useState(0);
  useEffect(() => {
    // Guests have no notifications — skip the request entirely.
    if (!getSession()) return;
    fetch("/api/notifications?unread=true&limit=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setServerUnread(d.data.unreadCount ?? 0);
      })
      .catch(() => {});
  }, []);
  const unread = serverUnread;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={unread > 0 ? `اعلان‌ها — ${unread.toLocaleString("fa-IR")} تازه` : "اعلان‌ها"}
      className="relative flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.96]"
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
 * App header: the Shekaar brand block (mark + wordmark, → profile) on the
 * start side, plan + notifications as quiet backgrounded icon buttons on
 * the end side. No capsule, no container — one shared component, so this
 * is the header on every page of the app.
 */
export function Header() {
  const router = useRouter();
  const [planOpen, setPlanOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 px-4 pt-3">
        <div className="mx-auto flex h-14 w-full max-w-screen-sm items-center justify-between">
          <BrandButton onClick={() => router.push("/profile")} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPlanOpen(true)}
              aria-label="پلن و هزینه‌ها"
              className="flex size-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.96]"
            >
              <Wallet size={20} aria-hidden="true" />
            </button>
            <NotificationButton onClick={() => router.push("/notifications")} />
          </div>
        </div>
      </header>
      <PlanSheet open={planOpen} onClose={() => setPlanOpen(false)} />
    </>
  );
}
