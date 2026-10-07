import "server-only";

import { tierByKey } from "@/lib/tiers";
import { sleepKaminsForUser, wakeKaminsForUser } from "../kamin/engine";
import {
  ALMAS_SEATS,
  isBilling,
  isTierKey,
  priceFor,
  tomanFromUsd,
  TIER_USD,
  TIERS,
  type Billing,
  type TierKey,
} from "./prices";

/**
 * M6 subscription lifecycle (blueprint §1.3, lock-list §1).
 *
 * States: none → pending → active → expired → active (renew);
 * canceled is terminal. On expiry kamins SLEEP (definitions kept);
 * renewal wakes them (slot-capped). No quota rollover, ever.
 *
 * MVP note: there is no payment gateway yet, so activation is a manual /
 * test step — the OWNER may activate their own pending intent. Real
 * charging (Zarinpal/IDPay) plugs into the same intent later.
 */

interface Sb {
  rest<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T>;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  tier: TierKey;
  status: "pending" | "active" | "expired" | "canceled";
  billing: Billing;
  price_usd: number;
  price_toman: number;
  annual_locked_toman: number | null;
  seats_total: number;
  seats_used: number;
  cycle_started_at: string | null;
  cycle_ends_at: string | null;
  last_renewal_key: string | null;
  created_at: string;
  updated_at: string;
}

export class SubscriptionError extends Error {
  constructor(
    public code:
      | "invalid-tier"
      | "invalid-billing"
      | "invalid-rate"
      | "not-found"
      | "wrong-state"
      | "forbidden"
      | "seats-full",
    message: string
  ) {
    super(message);
  }
}

const enc = encodeURIComponent;

function addInterval(from: Date, billing: Billing): Date {
  const d = new Date(from.getTime());
  d.setUTCMonth(d.getUTCMonth() + (billing === "annual" ? 12 : 1));
  return d;
}

/** The user's live subscription (pending or active), or null. */
export async function getSubscription(
  sb: Sb,
  userId: string
): Promise<SubscriptionRow | null> {
  try {
    const rows = await sb.rest<SubscriptionRow[]>(
      "GET",
      `subscriptions?user_id=eq.${enc(userId)}` +
        `&status=in.(pending,active)` +
        `&order=created_at.desc&limit=1`
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * POST /api/subscription/intent — idempotent per user (blueprint §1.3).
 * Records the tier choice as `pending`; returns the existing live row
 * when one is already there.
 */
export async function createIntent(
  sb: Sb,
  userId: string,
  tier: unknown,
  billing: unknown
): Promise<{ subscription: SubscriptionRow; created: boolean }> {
  if (!isTierKey(tier)) {
    throw new SubscriptionError("invalid-tier", "tier نامعتبر است.");
  }
  const b: Billing = isBilling(billing) ? billing : "monthly";

  const existing = await getSubscription(sb, userId);
  if (existing) return { subscription: existing, created: false };

  const price = await priceFor(sb, tier, b);
  const rows = await sb.rest<SubscriptionRow[]>("POST", "subscriptions", {
    user_id: userId,
    tier,
    status: "pending",
    billing: b,
    price_usd: price.usd,
    price_toman: price.toman,
    annual_locked_toman: b === "annual" ? price.toman : null,
  });
  const sub = rows[0];
  if (!sub) throw new SubscriptionError("not-found", "ثبت درخواست ناموفق بود.");
  return { subscription: sub, created: true };
}

async function resetQuotaCycle(sb: Sb, userId: string): Promise<void> {
  const q = enc(userId);
  const now = new Date().toISOString();
  const existing = await sb.rest<Array<{ user_id: string }>>(
    "GET",
    `quota_counters?user_id=eq.${q}&select=user_id&limit=1`
  );
  if (existing.length === 0) {
    await sb.rest("POST", "quota_counters", {
      user_id: userId,
      cycle_start: now,
      hunts_used: 0,
      gifts_used: 0,
      notified_85: false,
    });
  } else {
    await sb.rest("PATCH", `quota_counters?user_id=eq.${q}`, {
      cycle_start: now,
      hunts_used: 0,
      gifts_used: 0,
      notified_85: false,
    });
  }
}

async function checkAlmasSeats(sb: Sb): Promise<void> {
  const rows = await sb.rest<Array<{ id: string }>>(
    "GET",
    `subscriptions?tier=eq.almas&status=eq.active&select=id`
  );
  if (rows.length >= ALMAS_SEATS) {
    throw new SubscriptionError(
      "seats-full",
      "ظرفیت الماس تکمیل است (۲۰ صندلی، دعوتی)."
    );
  }
}

/**
 * MVP test activation: pending → active, cycle starts, quotas reset,
 * sleeping kamins wake (slot-capped). Only the OWNER's own pending
 * intent may be activated this way — real charging replaces this step.
 */
export async function activateSubscription(
  sb: Sb,
  userId: string,
  subscriptionId: string
): Promise<SubscriptionRow> {
  const rows = await sb.rest<SubscriptionRow[]>(
    "GET",
    `subscriptions?id=eq.${enc(subscriptionId)}&limit=1`
  );
  const sub = rows[0];
  if (!sub) throw new SubscriptionError("not-found", "اشتراک پیدا نشد.");
  if (sub.user_id !== userId) {
    throw new SubscriptionError("forbidden", "این اشتراک مال شما نیست.");
  }
  if (sub.status !== "pending") {
    throw new SubscriptionError(
      "wrong-state",
      "فقط درخواستِ در انتظار (pending) فعال می‌شود."
    );
  }
  if (sub.tier === "almas") await checkAlmasSeats(sb);

  // Re-price at activation — a pending intent may predate a re-index.
  const price = await priceFor(sb, sub.tier, sub.billing);
  const now = new Date();
  const ends = addInterval(now, sub.billing);

  const updated = await sb.rest<SubscriptionRow[]>(
    "PATCH",
    `subscriptions?id=eq.${enc(subscriptionId)}`,
    {
      status: "active",
      price_usd: price.usd,
      price_toman: price.toman,
      annual_locked_toman:
        sub.billing === "annual" ? price.toman : sub.annual_locked_toman,
      cycle_started_at: now.toISOString(),
      cycle_ends_at: ends.toISOString(),
      updated_at: now.toISOString(),
    }
  );
  const active = updated[0];
  if (!active) throw new SubscriptionError("not-found", "فعال‌سازی ناموفق بود.");

  await resetQuotaCycle(sb, userId);
  const slots = tierByKey(sub.tier)?.kaminSlots ?? 1;
  await wakeKaminsForUser(sb, userId, slots);
  return active;
}

/**
 * Lazy expiry: if the cycle ended, flip active → expired and SLEEP the
 * kamins (definitions + history kept — blueprint §1.3). Called on
 * GET /api/subscription and before quota decisions that need the tier.
 */
export async function expireCheck(
  sb: Sb,
  userId: string
): Promise<SubscriptionRow | null> {
  const sub = await getSubscription(sb, userId);
  if (!sub || sub.status !== "active") return sub;
  if (!sub.cycle_ends_at) return sub;
  if (new Date(sub.cycle_ends_at).getTime() > Date.now()) return sub;

  const now = new Date().toISOString();
  const updated = await sb.rest<SubscriptionRow[]>(
    "PATCH",
    `subscriptions?id=eq.${enc(sub.id)}&status=eq.active`,
    { status: "expired", updated_at: now }
  );
  await sleepKaminsForUser(sb, userId);
  return updated[0] ?? { ...sub, status: "expired" };
}

/**
 * Renewal: expired (or active) → active with a fresh cycle, quotas
 * reset, kamins wake. Idempotent per idempotency key — a double
 * webhook extends the cycle exactly once (blueprint §1.3).
 */
export async function renewSubscription(
  sb: Sb,
  userId: string,
  subscriptionId: string,
  idempotencyKey?: string | null
): Promise<{ subscription: SubscriptionRow; renewed: boolean }> {
  const rows = await sb.rest<SubscriptionRow[]>(
    "GET",
    `subscriptions?id=eq.${enc(subscriptionId)}&limit=1`
  );
  const sub = rows[0];
  if (!sub) throw new SubscriptionError("not-found", "اشتراک پیدا نشد.");
  if (sub.user_id !== userId) {
    throw new SubscriptionError("forbidden", "این اشتراک مال شما نیست.");
  }
  if (sub.status === "canceled" || sub.status === "pending") {
    throw new SubscriptionError(
      "wrong-state",
      "فقط اشتراک فعال یا منقضی تمدید می‌شود."
    );
  }
  if (idempotencyKey && sub.last_renewal_key === idempotencyKey) {
    return { subscription: sub, renewed: false };
  }

  const now = new Date();
  const base =
    sub.cycle_ends_at && new Date(sub.cycle_ends_at).getTime() > now.getTime()
      ? new Date(sub.cycle_ends_at)
      : now;
  const ends = addInterval(base, sub.billing);
  // Renewal re-prices from the CURRENT rate (monthly re-index applies
  // to new cycles; existing annuals keep annual_locked_toman).
  const price = await priceFor(sb, sub.tier, sub.billing);

  const updated = await sb.rest<SubscriptionRow[]>(
    "PATCH",
    `subscriptions?id=eq.${enc(subscriptionId)}`,
    {
      status: "active",
      price_usd: price.usd,
      price_toman: price.toman,
      cycle_started_at: now.toISOString(),
      cycle_ends_at: ends.toISOString(),
      last_renewal_key: idempotencyKey ?? null,
      updated_at: now.toISOString(),
    }
  );
  const renewed = updated[0];
  if (!renewed) throw new SubscriptionError("not-found", "تمدید ناموفق بود.");

  await resetQuotaCycle(sb, userId);
  const slots = tierByKey(sub.tier)?.kaminSlots ?? 1;
  await wakeKaminsForUser(sb, userId, slots);
  return { subscription: renewed, renewed: true };
}

/**
 * Manual dollar re-index (navid-approved manual flow): records the new
 * rate and inserts fresh tier_prices rows for every tier/billing.
 * Existing subscription rows are NEVER rewritten — annuals stay
 * grandfathered; monthly subs pick up the new price on their next cycle.
 */
export async function reindexPrices(
  sb: Sb,
  dollarRate: number
): Promise<{
  dollarRate: number;
  dollarClause: boolean;
  prices: Array<{ tier: TierKey; billing: Billing; usd: number; toman: number }>;
}> {
  if (!Number.isFinite(dollarRate) || dollarRate <= 0) {
    throw new SubscriptionError("invalid-rate", "نرخ دلار نامعتبر است.");
  }
  const rate = Math.round(dollarRate);
  await sb.rest("PATCH", `app_settings?key=eq.dollar_rate_toman`, {
    value: String(rate),
    updated_at: new Date().toISOString(),
  });
  const prices: Array<{
    tier: TierKey;
    billing: Billing;
    usd: number;
    toman: number;
  }> = [];
  for (const tier of TIERS) {
    for (const billing of ["monthly", "annual"] as Billing[]) {
      const usd = TIER_USD[tier][billing];
      const toman = tomanFromUsd(usd, rate);
      await sb.rest("POST", "tier_prices", {
        tier,
        billing,
        usd_price: usd,
        toman_price: toman,
        dollar_rate: rate,
      });
      prices.push({ tier, billing, usd, toman });
    }
  }
  return { dollarRate: rate, dollarClause: rate > 350_000, prices };
}
