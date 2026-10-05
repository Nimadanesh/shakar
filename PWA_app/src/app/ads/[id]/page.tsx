import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ImageOff } from "lucide-react";
import { FavoriteButton } from "@/components/ads/FavoriteButton";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";
import { excerptSegments, explainWhy } from "@/lib/search";
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
    query: typeof query.q === "string" ? query.q : "",
    includeKeywords: asArray(query.inc),
    excludeKeywords: asArray(query.exc),
    category: typeof query.cat === "string" ? query.cat : "all",
    city: typeof query.city === "string" ? query.city : "all",
    priceMin: num(query.min),
    priceMax: num(query.max),
    hasImage: query.img === "1",
  };

  const segments = excerptSegments(`${ad.title}. ${ad.description}`, ctx.includeKeywords);
  const explanation = explainWhy(ad, ctx.includeKeywords, ctx.excludeKeywords);

  const backParams = new URLSearchParams();
  if (ctx.query !== "") backParams.set("q", ctx.query);
  for (const term of ctx.includeKeywords) backParams.append("inc", term);
  for (const term of ctx.excludeKeywords) backParams.append("exc", term);
  if (ctx.category !== "all") backParams.set("cat", ctx.category);
  if (ctx.city !== "all") backParams.set("city", ctx.city);
  if (ctx.priceMin !== null) backParams.set("min", String(ctx.priceMin));
  if (ctx.priceMax !== null) backParams.set("max", String(ctx.priceMax));
  const backHref = backParams.toString() === "" ? "/" : `/?${backParams.toString()}`;

  return (
    <main className="flex flex-1 flex-col gap-4 py-4">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowRight size={16} aria-hidden="true" />
        بازگشت به نتایج
      </Link>

      <div className="flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg bg-secondary text-muted-foreground">
        <ImageOff size={32} aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold leading-8 text-foreground">{ad.title}</h1>
        <p className="text-[22px] font-bold leading-8 tabular-nums tracking-tight text-foreground" dir="auto">
          {formatPriceToman(ad.price)}
        </p>
        <p className="text-[13px] leading-6 text-muted-foreground">
          {ad.city}
          {ad.neighborhood ? `، ${ad.neighborhood}` : ""} • {ad.createdAt}
        </p>
      </div>

      {explanation && (
        <section aria-label="چرا این آگهی نمایش داده شده" className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
          <h2 className="text-[15px] font-semibold leading-6">چرا این آگهی نمایش داده شده؟</h2>
          <p className="text-sm leading-6 text-muted-foreground">{explanation.sentence}</p>
        </section>
      )}

      <section aria-label="توضیحات آگهی" className="flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold leading-6">توضیحات فروشنده</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          {segments.map((segment, index) =>
            segment.hit ? (
              <span key={index} className="font-medium text-signal">
                {segment.text}
              </span>
            ) : (
              <span key={index}>{segment.text}</span>
            )
          )}
        </p>
      </section>

      <div className="flex gap-3 pb-2">
        <FavoriteButton adId={ad.id} />
      </div>
    </main>
  );
}
