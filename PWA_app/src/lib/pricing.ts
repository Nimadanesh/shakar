/**
 * Pricing source of truth for hunt costs.
 *
 * HUNT_CREDIT_COST is the per-hunt price in credits. It is null until
 * pricing is actually decided — the UI must NEVER invent a number.
 * When null, surfaces fall back to honest generic wording.
 */
export const HUNT_CREDIT_COST: number | null = null;

/** Short honest cost line shown next to every «شکار کن» trigger. */
export function huntCostLabel(): string {
  if (HUNT_CREDIT_COST === null) return "هر شکار پولی است";
  const n = HUNT_CREDIT_COST.toLocaleString("fa-IR");
  return `هر شکار ${n} اعتبار`;
}
