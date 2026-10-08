"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Bell, User, Wallet } from "lucide-react";
import { getSession } from "@/lib/auth";
// Closed-by-default sheet: split into its own chunk so it never blocks
// the initial page paint.
const PlanSheet = dynamic(
  () => import("@/components/plan/PlanSheet").then((m) => m.PlanSheet),
  { ssr: false }
);
import { profileInitials, useProfile } from "@/hooks/useProfile";

function AvatarButton({ onClick }: { onClick: () => void }) {
  const { name, loggedIn } = useProfile();
  // Safe to compute during render: useProfile hydrates to "" on first render
  // (matching the server), so initials start empty everywhere.
  const initials = profileInitials(name);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={loggedIn === false ? "ورود / پروفایل" : "پروفایل"}
      className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.96]"
    >
      {initials !== "" ? (
        <span className="text-[15px] font-semibold leading-5">{initials}</span>
      ) : (
        <User size={18} aria-hidden="true" />
      )}
      {/* Guest nudge: a quiet dot — this is the proactive login entry.
          Shown only once we KNOW the user is a guest (no flash for
          logged-in users). */}
      {loggedIn === false && (
        <span
          aria-hidden="true"
          className="absolute -left-0.5 -top-0.5 size-3 rounded-full border-2 border-secondary bg-primary"
        />
      )}
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
            <NotificationButton onClick={() => router.push("/notifications")} />
          </div>
        </div>
      </header>
      <PlanSheet open={planOpen} onClose={() => setPlanOpen(false)} />
    </>
  );
}
