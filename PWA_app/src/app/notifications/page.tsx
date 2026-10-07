"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeletons";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
  seen: boolean;
  related_kamin_id: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "الان";
  if (min < 60) return `${min.toLocaleString("fa-IR")} دقیقه پیش`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h.toLocaleString("fa-IR")} ساعت پیش`;
  const d = Math.floor(h / 24);
  return `${d.toLocaleString("fa-IR")} روز پیش`;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[] | null>(null);

  useEffect(() => {
    fetch("/api/notifications?limit=30")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) {
          setItems(d.data.notifications);
          // Mark all as seen after viewing (fire-and-forget).
          const unseen = (d.data.notifications as Notification[])
            .filter((n) => !n.seen)
            .map((n) => n.id);
          if (unseen.length > 0) {
            fetch("/api/notifications/read", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: unseen }),
            }).catch(() => {});
          }
        } else {
          setItems([]);
        }
      })
      .catch(() => setItems([]));
  }, []);

  return (
    <main className="flex flex-1 flex-col gap-4 py-6">
      <h1 className="text-lg font-semibold">اعلان‌ها</h1>
      {items === null ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellRing size={28} aria-hidden="true" className="text-muted-foreground" />}
          title="اعلانی نداری"
          description="وقتی کمینت آگهی تازه پیدا کنه یا سهمیه‌ت کم بشه، اینجا می‌بینی."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`rounded-2xl border p-4 ${
                n.seen ? "border-border bg-card" : "border-primary/30 bg-primary/5"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{n.title}</p>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {timeAgo(n.created_at)}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
