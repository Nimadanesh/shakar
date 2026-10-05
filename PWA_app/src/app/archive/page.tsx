"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronLeft, Heart, History } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { SkeletonCard, SkeletonRow } from "@/components/ui/skeletons";
import { IconConfirmButton } from "@/components/ui/IconConfirmButton";
import { FavoriteRow } from "@/components/ads/FavoriteRow";
import { useFavorites } from "@/hooks/useFavorites";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";
import { readHunts, deleteHunt, recordHunt, type HuntRecord } from "@/lib/hunt-store";
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

/** Single-tap toggle off — re-adding is one tap in detail, so no confirm. */
function UnfavoriteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label="حذف از علاقه‌مندی‌ها"
      className="me-1 flex size-9 shrink-0 items-center justify-center rounded-full text-danger transition-colors hover:bg-danger/10 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Heart size={16} fill="currentColor" aria-hidden="true" />
    </button>
  );
}

/**
 * آرشیو — the on-demand page: past hunts (returnable /hunt/[id] rows with
 * spec summary + delete), favorites (with row-level unfavorite), and saved
 * hunt definitions (one-tap re-run + delete). The live monitoring life
 * stays in /saved.
 */
export default function ArchivePage() {
  const router = useRouter();
  const { isFavorite, toggle } = useFavorites();
  const favoriteAds = SEARCH_FIXTURES.filter((ad) => isFavorite(ad.id));

  const [hunts, setHunts] = useState<HuntRecord[]>([]);
  const [saved, setSaved] = useState<SavedHunt[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<ArchiveTab>("history");

  useEffect(() => {
    // Hydration-safe init: first render must match SSR (empty), then hydrate
    // from localStorage. Deliberate, not a cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHunts(readHunts());
    setSaved(readSavedHunts());
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

  function handleDeleteHunt(id: string) {
    deleteHunt(id);
    setHunts(readHunts());
  }

  function handleDeleteSaved(id: string) {
    deleteSavedHunt(id);
    setSaved(readSavedHunts());
  }

  function handleRerun(s: SavedHunt) {
    const rec = recordHunt(s.query, s.base);
    if (rec) router.push(`/hunt/${rec.id}`);
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
          { id: "saved", label: "ذخیره‌شده‌ها", count: saved.length },
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
              <li
                key={hunt.id}
                className="flex items-center gap-1 rounded-lg border border-border bg-card transition-colors hover:border-ring focus-within:border-ring"
              >
                <Link
                  href={`/hunt/${hunt.id}`}
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
                <FavoriteRow
                  ad={ad}
                  from="archive"
                  action={<UnfavoriteButton onClick={() => toggle(ad.id)} />}
                />
              </li>
            ))}
          </ul>
        )
      ) : saved.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={28} aria-hidden="true" className="text-muted-foreground" />}
          title="هنوز شکاری ذخیره نکرده‌ای"
          description="توی صفحه‌ی نتایج هر شکار، «ذخیره‌ی این شکار» را بزن تا قالبت اینجا بمونه و بعداً با یک لمس اجراش کنی."
          primaryAction={{ label: "شروع شکار", onClick: () => router.push("/") }}
        />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {saved.map((s) => (
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
