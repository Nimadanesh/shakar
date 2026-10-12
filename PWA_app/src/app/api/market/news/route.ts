import { NextResponse } from "next/server";
import { extractEconomicNews } from "@/lib/market";

const FEED_URL = "https://donya-e-eqtesad.com/feeds";
const SOURCE_NAME = "دنیای اقتصاد";

/**
 * GET /api/market/news — the most important economic headlines for a
 * professional Divar buyer: currency/gold/car/housing market movers
 * (buying hints), not politics.
 *
 * Source: Donya-e-Eqtesad RSS, keyword-filtered server-side, 30-min cache.
 * Titles link out to the original articles — we never republish bodies.
 */
export async function GET() {
  try {
    const res = await fetch(FEED_URL, {
      next: { revalidate: 1800 },
      headers: { "User-Agent": "Shekaar/1.0 (market-news)" },
    });
    if (!res.ok) throw new Error(`feed ${res.status}`);
    const items = extractEconomicNews(await res.text(), 10);
    return NextResponse.json({ ok: true, data: items, source: SOURCE_NAME });
  } catch {
    return NextResponse.json(
      { ok: false, error: "news-unavailable" },
      { status: 502 }
    );
  }
}
