"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronLeft, History } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { useHydratedStore } from "@/hooks/useHydratedStore";
import { SkeletonCard, SkeletonRow } from "@/components/ui/skeletons";
import { IconConfirmButton } from "@/components/ui/IconConfirmButton";
import { FavoriteAdsList } from "@/components/ads/FavoriteAdsList";
import { useFavorites, readFavoriteRecords } from "@/hooks/useFavorites";
import { readHunts, deleteHunt, recordHunt, type HuntRecord } from "@/lib/hunt-store";
import { fireRealHunt } from "@/lib/hunt-fire";
import {
  readSavedHunts,
  deleteSavedHunt,
  type SavedHunt,
} from "@/lib/saved-hunts";
import { huntSpecSummary } from "@/lib/hunt-summary";

type ArchiveTab = "history" | "favorites" | "saved";

function readTabParam(): ArchiveTab {
  if (typeof window === "undefined") return "history";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "favorites" || tab === "saved" ? tab : "history";
}

/**
 * آرشیو — the on-demand page: past hunts (returnable /hunt/[id] rows with
 * spec summary + delete), favorites (with row-level unfavorite), and saved
 * hunt definitions (one-tap re-run + delete). The live monitoring life
 * stays in /saved.
 */
export default function ArchivePage() {
  const router = useRouter();
  const { toggle } = useFavorites();
  // Favorites count comes from the records (real Divar ids), not fixtures.
  // The list itself is resolved by <FavoriteAdsList/>.
  const [favoriteCount, setFavoriteCount] = useState(0);
  useEffect(() => {
    setFavoriteCount(readFavoriteRecords().length);
  }, []);

  // Session-cached: revisits render the known lists immediately instead of
  // flashing skeletons → content on every navigation.
  const {
    value: hunts,
    ready: huntsReady,
    refresh: refreshHunts,
  } = useHydratedStore<HuntRecord[]>("hunts", readHunts);
  const {
    value: saved,
    ready: savedReady,
    refresh: refreshSaved,
  } = useHydratedStore<SavedHunt[]>("saved-hunts", readSavedHunts);
  const huntList = hunts ?? [];
  const savedList = saved ?? [];
  const ready = huntsReady && savedReady;
  const [tab, setTab] = useState<ArchiveTab>("history");

  useEffect(() => {
    // Tab param is cheap and URL-driven; keep it outside the cache.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe init
    setTab(readTabParam());
  }, []);

  function handleTabChange(next: string) {
    const nextTab: ArchiveTab =
      next === "favorites" || next === "saved" ? next : "history";
    setTab(nextTab);
    const url = nextTab === "history" ? "/archive" : `/archive?tab=${nextTab}`;
    window.history.replaceState(null, "", url);
  }

  function handleDeleteHunt(id: string) {
    deleteHunt(id);
    refreshHunts();
  }

  function handleDeleteSaved(id: string) {
    deleteSavedHunt(id);
    refreshSaved();
  }

  async function handleRerun(s: SavedHunt) {
    // Re-running is a new paid hunt — fire it for real, then land on the
    // run's results. The quota cost is explicit in the hunt contract.
    const result = await fireRealHunt({ query: s.query, base: s.base, dismissed: [] });
    if (!result.ok) return;
    recordHunt(s.query, s.base, [], result.runId);
    router.push(`/hunt/${encodeURIComponent(result.runId)}?q=${encodeURIComponent(s.query)}`);
  }

  return (
    <main className="flex flex-1 flex-col gap-4 py-6">
      <SegmentedTabs
        ariaLabel="بخش‌های آرشیو"
        active={tab}
        onChange={handleTabChange}
        tabs={[
          { id: "history", label: "تاریخچه", count: huntList.length },
          { id: "favorites", label: "علاقه‌مندی‌ها", count: favoriteCount },
          { id: "saved", label: "ذخیره‌شده‌ها", count: savedList.length },
        ]}
      />

      {!ready ? (
        tab === "saved" ? (
          <div
            className="flex flex-col gap-3"
            aria-busy="true"
            aria-label="در حال بارگذاری"
          >
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div
            className="flex flex-col gap-1.5"
            aria-busy="true"
            aria-label="در حال بارگذاری"
          >
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        )
      ) : tab === "history" ? (
        huntList.length === 0 ? (
          <EmptyState
            icon={<History size={28} aria-hidden="true" className="text-muted-foreground" />}
            title="هنوز شکاری اجرا نکرده‌ای"
            description="شکارهایی که اجرا می‌کنی اینجا می‌مونن تا بعداً برگردی سراغشون."
            primaryAction={{ label: "شروع شکار", onClick: () => router.push("/") }}
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {huntList.map((hunt) => (
              <li
                key={hunt.id}
                className="flex items-center gap-1 rounded-lg border border-border bg-card transition-colors hover:border-ring focus-within:border-ring"
              >
                <Link
                  href={`/hunt/${hunt.runId ?? hunt.id}`}
                  className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-start focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <History size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {hunt.query}
                    </span>
                    <span className="block truncate text-[11px] leading-5 text-muted-foreground">
                      {huntSpecSummary(hunt)}
                    </span>
                  </span>
                  <ChevronLeft size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                </Link>
                <IconConfirmButton
                  label="حذف شکار از تاریخچه"
                  onConfirm={() => handleDeleteHunt(hunt.id)}
                />
              </li>
            ))}
          </ul>
        )
      ) : tab === "favorites" ? (
        <FavoriteAdsList
          onUnfavorite={(adId) => {
            toggle(adId);
            setFavoriteCount(readFavoriteRecords().length);
          }}
        />
      ) : savedList.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={28} aria-hidden="true" className="text-muted-foreground" />}
          title="هنوز شکاری ذخیره نکرده‌ای"
          description="توی صفحه‌ی نتایج هر شکار، «ذخیره‌ی این شکار» را بزن تا قالبت اینجا بمونه و بعداً با یک لمس اجراش کنی."
          primaryAction={{ label: "شروع شکار", onClick: () => router.push("/") }}
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {savedList.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-1 rounded-lg border border-border bg-card transition-colors hover:border-ring focus-within:border-ring"
            >
              <button
                type="button"
                onClick={() => handleRerun(s)}
                className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-start focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Bookmark size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground">
                    {s.query}
                  </span>
                  <span className="block truncate text-[11px] leading-5 text-muted-foreground">
                    {huntSpecSummary(s)}
                  </span>
                </span>
                <ChevronLeft size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
              </button>
              <IconConfirmButton
                label="حذف شکار ذخیره‌شده"
                onConfirm={() => handleDeleteSaved(s.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
