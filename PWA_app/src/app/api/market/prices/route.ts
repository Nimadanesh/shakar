import { NextResponse } from "next/server";
import { extractPrices, extractSpark, type MarketPrice } from "@/lib/market";

const LATEST_URL =
  "https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/latest-toman.json";
const historyUrl = (symbol: string) =>
  `https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/history/${symbol}.json`;

/**
 * GET /api/market/prices — the five instruments navid asked for
 * (دلار، یورو، درهم، سکه امامی، نیم سکه) with day change and a
 * 30-day daily-close sparkline each.
 *
 * Source: iran-market.github.io (MIT, public JSON, no auth), snapshots
 * every 30 min → we revalidate every 10; history is daily → 6h.
 * A missing history file degrades to an empty sparkline, never a 500.
 */
export async function GET() {
  try {
    const latest = await fetch(LATEST_URL, { next: { revalidate: 600 } });
    if (!latest.ok) throw new Error(`latest-toman ${latest.status}`);
    const base = extractPrices(await latest.json());

    const items: MarketPrice[] = await Promise.all(
      base.map(async (p) => {
        try {
          const h = await fetch(historyUrl(p.symbol), {
            next: { revalidate: 21600 },
          });
          if (!h.ok) return { ...p, spark: [] as number[] };
          return { ...p, spark: extractSpark(await h.json(), 30) };
        } catch {
          return { ...p, spark: [] as number[] };
        }
      })
    );

    return NextResponse.json({ ok: true, data: items });
  } catch {
    return NextResponse.json(
      { ok: false, error: "market-unavailable" },
      { status: 502 }
    );
  }
}
