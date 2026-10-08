import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { AdBackButton } from "@/components/ads/AdBackButton";
import { FavoriteButton } from "@/components/ads/FavoriteButton";
import { ShareButton } from "@/components/ads/ShareButton";
import { AdDetailGallery } from "@/components/ads/AdDetailGallery";
import { MarkSeen } from "@/components/ads/MarkSeen";
import { WhyMatched } from "@/components/ads/WhyMatched";
import { DescriptionEvidence } from "@/components/ads/DescriptionEvidence";
import { divarProvider } from "@/lib/server/divar/divarClient";
import { formatPriceToman } from "@/lib/prices";
import { cityScopeFor } from "@/lib/search-context";
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
 * results link's query params; without it, the why-section stays hidden —
 * evidence is never invented.
 *
 * Data is REAL: fetched live from Divar via the server provider (60-min
 * cache). When the fetch fails, an honest "unavailable" view is shown —
 * never fixture data, never invented content.
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

  // Back restores the context the hunter came from: the hunt's results,
  // the live inbox, the archive, or home as a last resort.
  const huntId = first(query.hunt);
  const backHref =
    huntId !== null
      ? `/results/${huntId}`
      : query.from === "saved"
        ? "/saved"
        : query.from === "archive"
          ? "/archive?tab=favorites"
          : "/";

  const divarUrl = `https://divar.ir/v/${encodeURIComponent(id)}`;

  let detail: Awaited<ReturnType<typeof divarProvider.getDetail>> | null = null;
  // Classify the failure so the UI can be honest: a deleted ad (404) is
  // permanent; throttling/timeouts are transient and deserve a retry.
  // (navid 2026-10-08: "جزئیات در دسترس نیست" for EVERY ad needs a root fix.)
  let failureKind: "deleted" | "transient" | "unknown" = "unknown";
  try {
    detail = await divarProvider.getDetail(id);
  } catch (e) {
    detail = null;
    const msg = e instanceof Error ? e.message : "";
    const status =
      typeof (e as { status?: unknown }).status === "number"
        ? (e as { status: number }).status
        : null;
    if (status === 404 || /404/.test(msg)) {
      failureKind = "deleted";
    } else if (
      status === 429 ||
      status === 403 ||
      (status !== null && status >= 500) ||
      /timed out|timeout|rate-limited|upstream-down/i.test(msg)
    ) {
      failureKind = "transient";
    }
    console.warn(`[ads/detail] ${id} failed (${failureKind}):`, msg.slice(0, 120));
  }

  if (!detail) {
    const isDeleted = failureKind === "deleted";
    // Degraded view: the results list knew this ad's title/price/city.
    // Show THAT instead of a dead page — the user tapped a real card.
    const fallbackTitle = first(query.t);
    const fallbackPrice = num(query.p);
    const fallbackPriceText = first(query.pt);
    const fallbackCity = first(query.c);
    const hasFallback = fallbackTitle !== null;
    return (
      <main className="flex flex-1 flex-col gap-4 py-16 text-center">
        {hasFallback ? (
          <div className="mx-auto w-full max-w-xs rounded-lg border border-border bg-card p-4 text-start">
            <p className="break-words text-sm font-medium leading-6 text-foreground">
              {fallbackTitle}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {[fallbackPrice !== null ? formatPriceToman(fallbackPrice) : fallbackPriceText, fallbackCity]
                .filter(Boolean)
                .join(" • ")}
            </p>
            <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
              {isDeleted
                ? "این آگهی از دیوار حذف شده؛ جزئیات کامل در دسترس نیست."
                : "جزئیات کامل فعلاً در دسترس نیست — چند لحظه دیگر دوباره تلاش کن."}
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">
              {isDeleted ? "این آگهی حذف شده است." : "جزئیات این آگهی در دسترس نیست."}
            </p>
            <p className="mx-auto max-w-xs text-[13px] leading-6 text-muted-foreground">
              {isDeleted
                ? "به نظر می‌رسد آگهی از دیوار حذف شده — چیزی حدس نمی‌زنیم."
                : "ممکن است دیوار موقتاً محدودمان کرده باشد یا ارتباط برقرار نشد — چند لحظه دیگر دوباره تلاش کن."}
            </p>
          </>
        )}
        <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
          {!isDeleted && (
            <a
              href={`/ads/${encodeURIComponent(id)}${huntId !== null ? `?hunt=${encodeURIComponent(huntId)}` : ""}`}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-action-primary px-5 text-sm font-medium text-primary-foreground"
            >
              تلاش دوباره
            </a>
          )}
          <Link
            href={divarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border px-5 text-sm font-medium text-foreground"
          >
            <ExternalLink size={18} aria-hidden="true" />
            باز کردن آگهی اصلی در دیوار
          </Link>
          <AdBackButton
            fallbackHref={backHref}
            label="بازگشت به نتایج"
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-border px-5 text-sm font-medium text-foreground"
          />
        </div>
      </main>
    );
  }

  const ad = detail;
  const city = first(query.city) ?? "all";
  const cond = first(query.cond);
  const ctx: SearchContext = {
    query: first(query.q) ?? "",
    includeKeywords: asArray(query.inc),
    excludeKeywords: asArray(query.exc),
    category: first(query.cat) ?? "all",
    city,
    cityScope: cityScopeFor(city, first(query.cat) ?? "all", first(query.q) ?? ""),
    priceMin: num(query.min),
    priceMax: num(query.max),
    hasImage: query.img === "1",
    transaction: "",
    condition: cond === "new" || cond === "used" || cond === "any" ? cond : "",
  };

  const infoRows: Array<[string, string | null]> = [
    ["شهر", ad.city !== "" ? ad.city : null],
    ["تاریخ ثبت", ad.postedAt ?? null],
  ];

  return (
    <main className="flex flex-1 flex-col gap-6 py-4">
      <MarkSeen adId={id} />
      <AdBackButton fallbackHref={backHref} label="بازگشت به نتایج" />

      {ad.stale === true && (
        <p className="rounded-lg border border-border bg-secondary px-3 py-2 text-[12px] leading-5 text-muted-foreground">
          این جزئیات از حافظه‌ی موقت اومده و ممکن است قدیمی باشد — قیمت یا وضعیت آگهی را در صفحه‌ی اصلی دیوار چک کن.
        </p>
      )}

      <AdDetailGallery images={ad.images} thumbnail={ad.thumbnail} title={ad.title} />

      <div className="flex flex-col gap-1.5">
        <h1 className="max-w-[92%] text-lg font-medium leading-7 text-foreground text-balance">{ad.title}</h1>
        <p
          className="text-[17px] font-semibold leading-7 tabular-nums tracking-tight text-foreground"
          dir="auto"
        >
          {ad.price !== null ? formatPriceToman(ad.price) : (ad.priceText ?? "توافقی")}
        </p>
        {ad.city !== "" && (
          <p className="text-[13px] leading-6 text-muted-foreground">{ad.city}</p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <FavoriteButton adId={id} className="flex-1" />
          <ShareButton />
        </div>
        <Link
          href={divarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border px-5 text-sm font-medium text-foreground transition-colors hover:border-border-strong"
        >
          <ExternalLink size={18} aria-hidden="true" />
          باز کردن آگهی اصلی در دیوار
        </Link>
      </div>

      <WhyMatched ad={{ title: ad.title, description: ad.description }} ctx={ctx} />

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
