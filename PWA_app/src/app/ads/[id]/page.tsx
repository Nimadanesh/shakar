import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink } from "lucide-react";
import { FavoriteButton } from "@/components/ads/FavoriteButton";
import { ShareButton } from "@/components/ads/ShareButton";
import { AdDetailGallery } from "@/components/ads/AdDetailGallery";
import { WhyMatched } from "@/components/ads/WhyMatched";
import { DescriptionEvidence } from "@/components/ads/DescriptionEvidence";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";
import { formatPriceToman } from "@/lib/prices";
import type { SearchContext } from "@/types/search";

function asArray(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function num(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = raw !== undefined && raw !== "" ? Number(raw) : NaN;
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw !== "" ? raw : null;
}

/**
 * Ad detail = the VERIFY step. Evidence-first layout: the hunter understands
 * relevance (gallery → facts → why it matched) before reading the full
 * seller description. The evidence context (hunt terms) arrives via the
 * triage link's query params; without it, the why-section stays hidden —
 * evidence is never invented.
 */
export default async function AdDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ad = SEARCH_FIXTURES.find((item) => item.id === id);
  if (!ad) notFound();

  const ctx: SearchContext = {
    query: first(query.q) ?? "",
    includeKeywords: asArray(query.inc),
    excludeKeywords: asArray(query.exc),
    category: first(query.cat) ?? "all",
    city: first(query.city) ?? "all",
    priceMin: num(query.min),
    priceMax: num(query.max),
    hasImage: query.img === "1",
  };

  // Back restores the context the hunter came from: the hunt's triage,
  // the saved list, or home as a last resort.
  const huntId = first(query.hunt);
  const backHref =
    huntId !== null ? `/hunt/${huntId}` : query.from === "saved" ? "/saved" : "/";

  const infoRows: Array<[string, string | null]> = [
    ["دسته‌بندی", ad.category],
    ["شهر", ad.city],
    ["محله", ad.neighborhood ?? null],
    ["قدمت آگهی", ad.createdAt],
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 py-4">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1.5 rounded text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowRight size={16} aria-hidden="true" />
        بازگشت به نتایج
      </Link>

      <AdDetailGallery images={ad.images} thumbnail={ad.thumbnail} title={ad.title} />

      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold leading-9 text-foreground">{ad.title}</h1>
        <p
          className="text-[22px] font-bold leading-8 tabular-nums tracking-tight text-foreground"
          dir="auto"
        >
          {ad.price !== null ? formatPriceToman(ad.price) : "توافقی"}
        </p>
        <p className="text-[13px] leading-6 text-muted-foreground">
          {ad.city}
          {ad.neighborhood ? `، ${ad.neighborhood}` : ""} • {ad.createdAt}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <FavoriteButton adId={ad.id} className="flex-1" />
          <ShareButton />
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="آدرس اصلی در داده‌ی نمایشی موجود نیست"
            className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-border px-5 text-sm font-medium text-disabled"
          >
            <ExternalLink size={18} aria-hidden="true" />
            باز کردن آگهی اصلی
          </button>
          <p className="text-[12px] leading-5 text-muted-foreground">
            آدرس اصلی در داده‌ی نمایشی موجود نیست.
          </p>
        </div>
      </div>

      <WhyMatched ad={ad} ctx={ctx} />

      <DescriptionEvidence description={ad.description} includeTerms={ctx.includeKeywords} />

      <section
        aria-label="اطلاعات آگهی"
        className="flex flex-col rounded-lg border border-border bg-card"
      >
        <h2 className="px-4 pt-4 text-[15px] font-semibold leading-6 text-foreground">
          اطلاعات آگهی
        </h2>
        <dl className="flex flex-col px-4 pb-2">
          {infoRows.map(([label, value]) =>
            value === null ? null : (
              <div
                key={label}
                className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0"
              >
                <dt className="text-[13px] leading-5 text-muted-foreground">{label}</dt>
                <dd className="text-[13px] font-medium leading-5 text-foreground">{value}</dd>
              </div>
            )
          )}
        </dl>
      </section>
    </main>
  );
}
