/**
 * Market data (NEWS tab): Iranian FX + coin prices and economic headlines.
 *
 * Price source: iran-market/iran-market.github.io (MIT) — public JSON,
 * no auth, snapshots every 30 min, daily OHLC history per symbol.
 *   latest:  https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/latest-toman.json
 *   history: https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/history/<SYMBOL>.json
 * News source: Donya-e-Eqtesad RSS (https://donya-e-eqtesad.com/feeds),
 * keyword-filtered to market-moving items (currency, gold, cars, housing).
 */

export interface MarketSymbol {
  symbol: string;
  /** Short Persian label shown in the UI. */
  name: string;
}

/** The five instruments navid asked for, in display order. */
export const MARKET_SYMBOLS: MarketSymbol[] = [
  { symbol: "USD_IRR_FREE", name: "دلار آمریکا" },
  { symbol: "EUR_IRR_FREE", name: "یورو" },
  { symbol: "AED_IRR_FREE", name: "درهم امارات" },
  { symbol: "COIN_EMAMI_IRR", name: "سکه امامی" },
  { symbol: "COIN_HALF_IRR", name: "نیم سکه" },
];

export interface MarketPrice {
  symbol: string;
  name: string;
  /** Toman. */
  price: number;
  /** Day change in percent, null when the source omits it. */
  changePct: number | null;
  /** Last N daily closes, oldest → newest. Empty when history is missing. */
  spark: number[];
  /** Jalali timestamp from the source, e.g. «1405/07/20 18:13:30». */
  updatedJalali: string | null;
}

export interface MarketNewsItem {
  title: string;
  link: string;
}

interface RawPriceRecord {
  symbol?: unknown;
  price?: unknown;
  change_pct?: unknown;
  timestamp_jalali?: unknown;
}

/** Pull the five wanted symbols out of a latest-toman.json payload. */
export function extractPrices(payload: unknown): Omit<MarketPrice, "spark">[] {
  const categories: unknown =
    typeof payload === "object" && payload !== null
      ? (payload as { data?: { categories?: unknown } }).data?.categories
      : undefined;
  if (typeof categories !== "object" || categories === null) return [];
  const wanted = new Map(MARKET_SYMBOLS.map((s) => [s.symbol, s.name]));
  const out: Omit<MarketPrice, "spark">[] = [];
  for (const items of Object.values(categories)) {
    if (!Array.isArray(items)) continue;
    for (const raw of items as RawPriceRecord[]) {
      if (typeof raw !== "object" || raw === null) continue;
      const symbol = typeof raw.symbol === "string" ? raw.symbol : "";
      const name = wanted.get(symbol);
      if (!name) continue;
      if (typeof raw.price !== "number" || !Number.isFinite(raw.price)) continue;
      out.push({
        symbol,
        name,
        price: raw.price,
        changePct:
          typeof raw.change_pct === "number" && Number.isFinite(raw.change_pct)
            ? raw.change_pct
            : null,
        updatedJalali:
          typeof raw.timestamp_jalali === "string" ? raw.timestamp_jalali : null,
      });
    }
  }
  // Keep navid's display order, not the source's category order.
  const order = new Map(MARKET_SYMBOLS.map((s, i) => [s.symbol, i]));
  out.sort((a, b) => (order.get(a.symbol) ?? 99) - (order.get(b.symbol) ?? 99));
  return out;
}

interface RawHistoryRecord {
  close?: unknown;
}

/** Last `n` daily closes from a history/<SYMBOL>.json payload. */
export function extractSpark(payload: unknown, n = 30): number[] {
  const data: unknown =
    typeof payload === "object" && payload !== null
      ? (payload as { data?: unknown }).data
      : undefined;
  if (!Array.isArray(data)) return [];
  const closes: number[] = [];
  for (const raw of data as RawHistoryRecord[]) {
    if (
      typeof raw === "object" &&
      raw !== null &&
      typeof raw.close === "number" &&
      Number.isFinite(raw.close)
    ) {
      closes.push(raw.close);
    }
  }
  return closes.slice(-n);
}

const ECONOMIC_KEYWORDS = [
  "ارز",
  "دلار",
  "یورو",
  "درهم",
  "طلا",
  "سکه",
  "خودرو",
  "ماشین",
  "مسکن",
  "آپارتمان",
  "بورس",
  "تورم",
  "وام",
  "سود",
  "بازار",
  "اقتصاد",
  "نفت",
  "بنزین",
  "اجاره",
  "رهن",
  "بانک",
  "بیت‌کوین",
  "بیتکوین",
  "رمزارز",
];

/** Headlines that ARE the buying hint: daily price roundups. Ranked first. */
const CORE_MARKET_KEYWORDS = [
  "قیمت",
  "نرخ",
  "دلار",
  "طلا",
  "سکه",
  "ارز",
  "درهم",
  "یورو",
];

/**
 * Parse a Donya-e-Eqtesad RSS 2.0 feed and keep market-moving headlines.
 * Pure regex over a known shape (title in CDATA, plain <link>).
 * Price roundups («قیمت دلار امروز…») rank first — they are the buying
 * hints; everything else keeps feed order (sort is stable).
 */
export function extractEconomicNews(xml: string, limit = 10): MarketNewsItem[] {
  const matched: { item: MarketNewsItem; core: boolean }[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null && matched.length < 40) {
    const body = m[1];
    const titleM =
      /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(body) ??
      /<title>([\s\S]*?)<\/title>/.exec(body);
    const linkM = /<link>([\s\S]*?)<\/link>/.exec(body);
    const title = (titleM?.[1] ?? "").trim();
    const link = (linkM?.[1] ?? "").trim();
    if (!title || !link) continue;
    if (ECONOMIC_KEYWORDS.some((k) => title.includes(k))) {
      matched.push({
        item: { title, link },
        core: CORE_MARKET_KEYWORDS.some((k) => title.includes(k)),
      });
    }
  }
  matched.sort((a, b) => Number(b.core) - Number(a.core));
  return matched.slice(0, limit).map((e) => e.item);
}
