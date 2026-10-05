import type { HuntRecord } from "@/lib/hunt-store";
import { cityLabel, categoryLabel } from "@/data/taxonomy";
import { formatPriceCompact } from "@/lib/prices";

function faNum(n: number): string {
  return n.toLocaleString("fa-IR");
}

export function relativeTime(ts: number): string {
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return "لحظاتی پیش";
  if (minutes < 60) return `${faNum(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${faNum(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${faNum(days)} روز پیش`;
  return new Date(ts).toLocaleDateString("fa-IR", {
    day: "numeric",
    month: "short",
  });
}

/**
 * One-line scan summary for a hunt row: city • category • price • age.
 * Skips unset specs. Shared by home's RecentHunts and archive history —
 * the same hunt must read the same everywhere.
 */
export function huntSpecSummary(hunt: Pick<HuntRecord, "base" | "ts">): string {
  const parts: string[] = [];
  if (hunt.base.city !== "all") parts.push(cityLabel(hunt.base.city));
  if (hunt.base.category !== "all")
    parts.push(categoryLabel(hunt.base.category));
  const min = hunt.base.priceMin.trim();
  const max = hunt.base.priceMax.trim();
  if (min !== "" || max !== "") {
    const fmt = (v: string) => formatPriceCompact(Number(v));
    parts.push(
      min !== "" && max !== ""
        ? `از ${fmt(min)} تا ${fmt(max)}`
        : min !== ""
          ? `از ${fmt(min)}`
          : `تا ${fmt(max)}`
    );
  }
  parts.push(relativeTime(hunt.ts));
  return parts.join(" • ");
}
