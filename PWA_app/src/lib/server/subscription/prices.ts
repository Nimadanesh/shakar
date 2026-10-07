import "server-only";

/**
 * M6 dollar-indexed tier pricing (lock-list §1, blueprint §1.3).
 *
 * Prices are PEGGED TO USD. The Toman price the user sees is derived:
 *   toman = round(usd * dollar_rate / 10000) * 10000
 * (nearest 10k — keeps prices clean: 199,989 → 200,000).
 *
 * - Monthly tiers re-index every month when navid updates the rate
 *   (POST /api/internal/subscription/reindex, manual — his call).
 * - Existing ANNUAL subscriptions stay locked at their purchase Toman
 *   price (annual_locked_toman); only NEW annuals use the current rate.
 * - If the dollar crosses 350,000 the new annual price is indexed at
 *   the new rate — automatic, since new annuals always use it.
 *
 * USD bases come from the lock-list Toman prices ÷ 270,000 (the peg).
 */

export const DOLLAR_PEG_TOMAN = 270_000;
export const DOLLAR_CLAUSE_TOMAN = 350_000;

export type TierKey = "paye" | "herfei" | "vizhe" | "namayandegi" | "almas";
export type Billing = "monthly" | "annual";

export const TIERS: TierKey[] = [
  "paye",
  "herfei",
  "vizhe",
  "namayandegi",
  "almas",
];

/** USD peg basis per tier — lock-list Toman ÷ 270,000. */
export const TIER_USD: Record<TierKey, { monthly: number; annual: number }> = {
  paye: { monthly: 0.7407, annual: 7.4074 },
  herfei: { monthly: 4.4444, annual: 44.4444 },
  vizhe: { monthly: 11.1111, annual: 111.1111 },
  namayandegi: { monthly: 29.6296, annual: 296.2963 },
  almas: { monthly: 111.1111, annual: 1111.1111 },
};

/** Almas is invite-only with 20 seats (lock-list). */
export const ALMAS_SEATS = 20;

interface Sb {
  rest<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T>;
}

export function isTierKey(v: unknown): v is TierKey {
  return typeof v === "string" && (TIERS as string[]).includes(v);
}

export function isBilling(v: unknown): v is Billing {
  return v === "monthly" || v === "annual";
}

/** Nearest-10k rounding keeps re-indexed prices clean and on-brand. */
export function tomanFromUsd(usd: number, dollarRate: number): number {
  return Math.round((usd * dollarRate) / 10_000) * 10_000;
}

/** Current manual dollar rate (Toman per USD); falls back to the peg. */
export async function getDollarRate(sb: Sb): Promise<number> {
  try {
    const rows = await sb.rest<Array<{ value: string }>>(
      "GET",
      `app_settings?key=eq.dollar_rate_toman&select=value&limit=1`
    );
    const n = Number(rows[0]?.value);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : DOLLAR_PEG_TOMAN;
  } catch {
    return DOLLAR_PEG_TOMAN;
  }
}

export interface TierPrice {
  tier: TierKey;
  billing: Billing;
  usd: number;
  toman: number;
  dollarRate: number;
}

/**
 * Current prices for every tier/billing: USD basis is locked, Toman is
 * derived from the live dollar rate. Reads the latest tier_prices row
 * per tier/billing when present (so a re-index is exactly what was
 * recorded), otherwise derives from USD × rate.
 */
export async function currentPrices(sb: Sb): Promise<TierPrice[]> {
  const rate = await getDollarRate(sb);
  let recorded: Array<{
    tier: string;
    billing: string;
    usd_price: number;
    toman_price: number;
    dollar_rate: number;
  }> = [];
  try {
    recorded = await sb.rest(
      "GET",
      `tier_prices?select=tier,billing,usd_price,toman_price,dollar_rate` +
        `&order=effective_from.desc&limit=20`
    );
  } catch {
    recorded = [];
  }
  const seen = new Map<string, (typeof recorded)[number]>();
  for (const r of recorded) {
    const k = `${r.tier}:${r.billing}`;
    if (!seen.has(k)) seen.set(k, r);
  }
  const out: TierPrice[] = [];
  for (const tier of TIERS) {
    for (const billing of ["monthly", "annual"] as Billing[]) {
      const r = seen.get(`${tier}:${billing}`);
      const usd = r ? Number(r.usd_price) : TIER_USD[tier][billing];
      const toman = r
        ? Number(r.toman_price)
        : tomanFromUsd(TIER_USD[tier][billing], rate);
      out.push({
        tier,
        billing,
        usd,
        toman,
        dollarRate: r ? Number(r.dollar_rate) : rate,
      });
    }
  }
  return out;
}

/** Price for one tier/billing at the current rate (for new intents). */
export async function priceFor(
  sb: Sb,
  tier: TierKey,
  billing: Billing
): Promise<{ usd: number; toman: number; dollarRate: number }> {
  const prices = await currentPrices(sb);
  const p = prices.find((x) => x.tier === tier && x.billing === billing);
  if (!p) throw new Error(`price missing for ${tier}/${billing}`);
  return { usd: p.usd, toman: p.toman, dollarRate: p.dollarRate };
}
