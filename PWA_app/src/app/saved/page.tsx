"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { SkeletonCard } from "@/components/ui/skeletons";
import { useHydratedStore } from "@/hooks/useHydratedStore";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { categoryLabel, cityLabel } from "@/data/taxonomy";
import { formatPriceCompact } from "@/lib/prices";
import {
  disarmKamin,
  kaminCtxToBase,
  kaminNewIds,
  listKamins,
  markKaminSeen,
  type KaminRecord,
} from "@/lib/kamin-store";
import {
  listKaminsServer,
  disarmKaminServer,
  type ServerKamin,
} from "@/lib/kamin-client";
import { recordHunt } from "@/lib/hunt-store";
import { runSearch } from "@/lib/search";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";
import type { SearchContext } from "@/types/search";

function priceRangeLabel(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null)
    return `از ${formatPriceCompact(min)} تا ${formatPriceCompact(max)}`;
  if (max !== null) return `تا ${formatPriceCompact(max)}`;
  return `از ${formatPriceCompact(min as number)}`;
}

/** Compact human summary of the non-default filters, or null when plain. */
function filterSummary(ctx: SearchContext): string | null {
  const parts: string[] = [];
  if (ctx.city !== "all") parts.push(cityLabel(ctx.city));
  if (ctx.category !== "all") parts.push(categoryLabel(ctx.category));
  const price = priceRangeLabel(ctx.priceMin, ctx.priceMax);
  if (price) parts.push(price);
  if (ctx.hasImage) parts.push("عکس‌دار");
  return parts.length > 0 ? parts.join(" • ") : null;
}

function MiniChip({ term, negated }: { term: string; negated?: boolean }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-[12px] leading-5 text-foreground">
      {negated ? <span className="text-muted-foreground line-through">{term}</span> : term}
    </span>
  );
}

/**
 * The hunt definition, readable days later: what was asked, which terms
 * were forced in/out, which filters applied. Read-only — recognition,
 * not editing.
 */
function KaminDefinition({ ctx }: { ctx: SearchContext }) {
  const summary = filterSummary(ctx);
  const hasChips = ctx.includeKeywords.length > 0 || ctx.excludeKeywords.length > 0;
  return (
    <div className="flex flex-col gap-2 rounded-md bg-secondary/50 p-2.5">
      {ctx.query.trim() !== "" && (
        <p className="line-clamp-2 text-[13px] leading-6 text-foreground">{ctx.query}</p>
      )}
      {hasChips && (
        <div className="flex flex-wrap gap-1.5">
          {ctx.includeKeywords.map((term) => (
            <MiniChip key={`i-${term}`} term={term} />
          ))}
          {ctx.excludeKeywords.map((term) => (
            <MiniChip key={`e-${term}`} term={term} negated />
          ))}
        </div>
      )}
      {summary && <p className="text-[12px] leading-5 text-muted-foreground">{summary}</p>}
    </div>
  );
}

function KaminCard({
  kamin,
  newCount,
  onViewResults,
  onDisarm,
}: {
  kamin: KaminRecord;
  newCount: number;
  onViewResults: () => void;
  onDisarm: () => void;
}) {
  const fresh = newCount > 0;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-5 text-foreground">
          «{kamin.name}»
        </p>
        {fresh && (
          <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold tabular-nums text-primary">
            {newCount.toLocaleString("fa-IR")} تازه
          </span>
        )}
      </div>

      <KaminDefinition ctx={kamin.ctx} />

      <button
        type="button"
        onClick={onViewResults}
        className={
          fresh
            ? "h-11 w-full rounded-lg bg-action-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
            : "h-11 w-full rounded-lg border border-border text-sm font-medium text-foreground transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
        }
      >
        دیدن نتایج
      </button>
      <ConfirmButton
        label="غیرفعال کردن"
        confirmLabel="مطمئنی؟ برای تأیید دوباره بزن"
        onConfirm={onDisarm}
      />
    </div>
  );
}

/**
 * Server kamin card (M5B). Simpler than the local KaminCard: the server
 * already computed new_match_count, and the definition is a HuntDefinition
 * (we show the query text, not the full SearchContext breakdown).
 */
function ServerKaminCard({
  kamin,
  onDisarm,
}: {
  kamin: ServerKamin;
  onDisarm: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold leading-5 text-foreground">
          «{kamin.name}»
        </p>
        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
          {kamin.status === "sleeping" ? "خوابیده" : "فعال"}
        </span>
      </div>
      <p className="text-[13px] text-muted-foreground">«{kamin.definition.query}»</p>
      {kamin.new_match_count > 0 && (
        <p className="text-[13px] font-medium text-primary">
          {kamin.new_match_count.toLocaleString("fa-IR")} آگهی تازه
        </p>
      )}
      <ConfirmButton
        label="غیرفعال کردن"
        confirmLabel="مطمئنی؟ برای تأیید دوباره بزن"
        onConfirm={onDisarm}
      />
    </div>
  );
}

type SavedTab = "fresh" | "kamins";

function readTabParam(): SavedTab {
  if (typeof window === "undefined") return "fresh";
  return new URLSearchParams(window.location.search).get("tab") === "kamins"
    ? "kamins"
    : "fresh";
}

/**
 * شکار من — the LIVE page. Only what the user is waiting for:
 * fresh matches first, quiet watchers behind the second tab.
 * Everything else (history, favorites, saved hunts) moved to /archive.
 */
export default function SavedPage() {
  const router = useRouter();
  // Session-cached: revisits render the known kamins immediately instead of
  // flashing skeletons → list on every navigation.
  const {
    value: kamins,
    ready,
    refresh,
  } = useHydratedStore<KaminRecord[]>("kamins", listKamins);
  // Server kamins (M5B): fetched on mount, null = not logged in / offline.
  const [serverKamins, setServerKamins] = useState<ServerKamin[] | null>(null);
  useEffect(() => {
    listKaminsServer().then(setServerKamins);
  }, []);
  const kaminList = kamins ?? [];
  const [tab, setTab] = useState<SavedTab>("fresh");

  useEffect(() => {
    // Tab param is cheap and URL-driven; keep it outside the cache.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe init
    setTab(readTabParam());
  }, []);

  const newCounts = new Map<string, number>();
  for (const kamin of kaminList) {
    newCounts.set(kamin.id, kaminNewIds(kamin, SEARCH_FIXTURES).length);
  }
  const freshKamins = kaminList.filter((k) => (newCounts.get(k.id) ?? 0) > 0);
  /** Quiet watchers — kamins already surfaced in تازه‌ها don't repeat here. */
  const quietKamins = kaminList.filter((k) => (newCounts.get(k.id) ?? 0) === 0);
  const totalFresh = freshKamins.reduce((sum, k) => sum + (newCounts.get(k.id) ?? 0), 0);

  function handleTabChange(next: string) {
    const nextTab: SavedTab = next === "kamins" ? "kamins" : "fresh";
    setTab(nextTab);
    const url = nextTab === "fresh" ? "/saved" : "/saved?tab=kamins";
    window.history.replaceState(null, "", url);
  }

  function handleDisarm(id: string) {
    disarmKamin(id);
    refresh();
  }

  /**
   * Inbox CTA: re-running is a new paid hunt — the cost label says so.
   * Backend contract order: search must succeed and the hunt must be
   * recorded BEFORE the kamin baseline moves. If the search fails (or no
   * hunt is recorded), the baseline is untouched — "new matches" are never
   * silently swallowed.
   */
  function handleViewResults(kamin: KaminRecord) {
    let ids: string[];
    try {
      ids = runSearch(kamin.ctx, SEARCH_FIXTURES).results.map((r) => r.adId);
    } catch {
      return;
    }
    const record = recordHunt(kamin.name, kaminCtxToBase(kamin.ctx), []);
    if (!record) return;
    markKaminSeen(kamin.id, ids);
    refresh();
    router.push(`/hunt/${record.id}`);
  }

  return (
    <main className="flex flex-1 flex-col gap-4 py-6">
      <SegmentedTabs
        ariaLabel="بخش‌های شکار من"
        active={tab}
        onChange={handleTabChange}
        tabs={[
          { id: "fresh", label: "تازه‌ها", count: totalFresh },
          { id: "kamins", label: "کمین‌ها", count: quietKamins.length },
        ]}
      />

      {!ready ? (
        <div
          className="flex flex-col gap-3"
          aria-busy="true"
          aria-label="در حال بارگذاری"
        >
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : tab === "fresh" ? (
        freshKamins.length === 0 ? (
          <EmptyState
            icon={<BellRing size={28} aria-hidden="true" className="text-muted-foreground" />}
            title={kaminList.length === 0 ? "کمین فعالی نداری" : "چیز تازه‌ای نیست"}
            description={
              kaminList.length === 0
                ? "برای شکاری که اجرا کردی کمین بذار؛ آگهی تازه که اومد اینجا می‌بینی."
                : "کمین‌های فعالت زیر نظرن؛ آگهی جدید که بیاد اینجا می‌بینی."
            }
            primaryAction={
              kaminList.length === 0
                ? { label: "شروع شکار", onClick: () => router.push("/") }
                : undefined
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {freshKamins.map((kamin) => (
              <li key={kamin.id}>
                <KaminCard
                  kamin={kamin}
                  newCount={newCounts.get(kamin.id) ?? 0}
                  onViewResults={() => handleViewResults(kamin)}
                  onDisarm={() => handleDisarm(kamin.id)}
                />
              </li>
            ))}
          </ul>
        )
      ) : quietKamins.length === 0 ? (
        <EmptyState
          icon={<BellRing size={28} aria-hidden="true" className="text-muted-foreground" />}
          title={kaminList.length === 0 ? "کمین فعالی نداری" : "همه‌ی کمین‌ها تازه دارن"}
          description={
            kaminList.length === 0
              ? "برای شکاری که اجرا کردی کمین بذار؛ آگهی تازه که اومد تو تب تازه‌ها می‌بینی."
              : "فعلاً کمین ساکتی نداری؛ نتیجه‌های تازه رو تو تب تازه‌ها ببین."
          }
          primaryAction={
            kaminList.length === 0
              ? { label: "شروع شکار", onClick: () => router.push("/") }
              : undefined
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {/* Server kamins (M5B) — shown first when logged in. */}
          {(serverKamins ?? []).map((kamin) => (
            <li key={`srv-${kamin.id}`}>
              <ServerKaminCard
                kamin={kamin}
                onDisarm={async () => {
                  const ok = await disarmKaminServer(kamin.id);
                  if (ok) setServerKamins((s) => (s ?? []).filter((k) => k.id !== kamin.id));
                }}
              />
            </li>
          ))}
          {quietKamins.map((kamin) => (
            <li key={kamin.id}>
              <KaminCard
                kamin={kamin}
                newCount={0}
                onViewResults={() => handleViewResults(kamin)}
                onDisarm={() => handleDisarm(kamin.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
