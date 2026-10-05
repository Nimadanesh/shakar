/**
 * Monetization source of truth.
 *
 * The product sells a MONTHLY SUBSCRIPTION for a fixed number of hunts —
 * there is deliberately no per-hunt price. HUNTS_PER_MONTH is null until
 * the subscription tiers are actually decided; the UI must NEVER invent
 * a number, and must never show a per-hunt price (not even «هر شکار پولی
 * است»). Each hunt consumes one hunt from the subscriber's monthly quota.
 */
export const HUNTS_PER_MONTH: number | null = null;
