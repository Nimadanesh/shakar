"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronLeft, Heart, History } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { FavoriteRow } from "@/components/ads/FavoriteRow";
import { useFavorites } from "@/hooks/useFavorites";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";
import { readHunts, type HuntRecord } from "@/lib/hunt-store";

type ArchiveTab = "history" | "favorites" | "saved";

function readTabParam(): ArchiveTab {
  if (typeof window === "undefined") return "history";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "favorites" || tab === "saved" ? tab : "history";
}

/**
 * آرشیو — the DEAD tabs. Needed on demand, never followed: past hunts,
 * favorites, saved hunts (honest empty until backend identity lands).
 * The live monitoring life stays in /saved.
 */
export default function ArchivePage() {
  const router = useRouter();
  const { isFavorite } = useFavorites();
  const favoriteAds = SEARCH_FIXTURES.filter((ad) => isFavorite(ad.id));

  const [hunts, setHunts] = useState<HuntRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<ArchiveTab>("history");

  useEffect(() => {
    // Hydration-safe init: first render must match SSR (empty), then hydrate
    // from localStorage. Deliberate, not a cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHunts(readHunts());
    setTab(readTabParam());
    setReady(true);
  }, []);

  function handleTabChange(next: string) {
    const nextTab: ArchiveTab =
      next === "favorites" || next === "saved" ? next : "history";
    setTab(nextTab);
    const url = nextTab === "history" ? "/archive" : `/archive?tab=${nextTab}`;
    window.history.replaceState(null, "", url);
  }

  return (
    <main className="flex flex-1 flex-col gap-4 py-6">
      <SegmentedTabs
        ariaLabel="بخش‌های آرشیو"
        active={tab}
        onChange={handleTabChange}
        tabs={[
          { id: "history", label: "تاریخچه", count: hunts.length },
          { id: "favorites", label: "علاقه‌مندی‌ها", count: favoriteAds.length },
          { id: "saved", label: "ذخیره‌شده‌ها" },
        ]}
      />

      {!ready ? null : tab === "history" ? (
        hunts.length === 0 ? (
          <EmptyState
            icon={<History size={28} aria-hidden="true" className="text-muted-foreground" />}
            title="هنوز شکاری اجرا نکرده‌ای"
            description="شکارهایی که اجرا می‌کنی اینجا می‌مونن تا بعداً برگردی سراغشون."
            primaryAction={{ label: "شروع شکار", onClick: () => router.push("/") }}
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {hunts.map((hunt) => (
              <li key={hunt.id}>
                <Link
                  href={`/hunt/${hunt.id}`}
                  className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 text-start transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <History size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                    {hunt.query}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {new Date(hunt.ts).toLocaleDateString("fa-IR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <ChevronLeft size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : tab === "favorites" ? (
        favoriteAds.length === 0 ? (
          <EmptyState
            icon={<Heart size={28} aria-hidden="true" className="text-muted-foreground" />}
            title="هنوز آگهی‌ای به علاقه‌مندی‌ها اضافه نکرده‌ای"
            description="روی آگهی‌های خوب بزن تا اینجا نگه‌شون داری."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {favoriteAds.map((ad) => (
              <li key={ad.id}>
                <FavoriteRow ad={ad} from="archive" />
              </li>
            ))}
          </ul>
        )
      ) : (
        <EmptyState
          icon={<Bookmark size={28} aria-hidden="true" className="text-muted-foreground" />}
          title="هنوز شکاری ذخیره نکرده‌ای"
          description="شکار کامل که اجرا کردی، می‌تونی ذخیره‌ش کنی تا بعداً با یک لمس اجراش کنی."
          primaryAction={{ label: "شروع شکار", onClick: () => router.push("/") }}
        />
      )}
    </main>
  );
}
