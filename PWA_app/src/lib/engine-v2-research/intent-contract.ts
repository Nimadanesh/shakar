/**
 * Stage 2 research contract. This module is intentionally isolated from the
 * legacy v2/v3 hunt pipeline; downstream stages must opt in explicitly.
 */
export type SlotPolarity = "must" | "mustNot";
export type SlotHardness = "hard" | "soft" | null;
export type SlotStatus = "confirmed" | "unknown";
export type TransactionKind = "buy" | "sell" | "rent" | "service" | "employment";
export type HuntEntityKind = "commodity" | "service";

export interface IntentSlot {
  /** Stable domain type, e.g. "condition", "model", "capacity". */
  readonly kind: string;
  /** Alternatives are OR values, never an implicit AND. */
  readonly values: readonly string[];
  readonly polarity: SlotPolarity;
  /** null means no hardness marker was supplied; never default to hard. */
  readonly hardness: SlotHardness;
  readonly status: SlotStatus;
  /** Exact phrase copied from the hunt that supports this slot. */
  readonly sourcePhrase: string;
}

export interface PriceConstraint {
  readonly min: number | null;
  readonly max: number | null;
  readonly currency: string | null;
  readonly status: SlotStatus;
  readonly sourcePhrase: string | null;
}

export interface LocationConstraint {
  readonly value: string | null;
  readonly status: SlotStatus;
  readonly sourcePhrase: string | null;
}

export interface IntentContract {
  readonly schemaVersion: "2.0";
  readonly huntId: string;
  readonly entity: {
    readonly kind: HuntEntityKind;
    readonly values: readonly string[];
    readonly status: SlotStatus;
    readonly sourcePhrase: string;
  };
  readonly slots: readonly IntentSlot[];
  readonly transactions: {
    readonly values: readonly TransactionKind[];
    readonly status: SlotStatus;
    readonly sourcePhrase: string | null;
  };
  readonly location: LocationConstraint;
  readonly price: PriceConstraint;
}

export interface ContractValidationIssue {
  readonly path: string;
  readonly message: string;
}

export function validateIntentContract(value: IntentContract): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [];
  if (!value.huntId.trim()) issues.push({ path: "huntId", message: "huntId must not be empty" });
  if (!value.entity.values.length) issues.push({ path: "entity.values", message: "entity needs at least one value" });
  if (!value.entity.sourcePhrase.trim()) issues.push({ path: "entity.sourcePhrase", message: "source phrase is required" });
  value.slots.forEach((slot, index) => {
    const base = `slots[${index}]`;
    if (!slot.kind.trim()) issues.push({ path: `${base}.kind`, message: "slot kind must not be empty" });
    if (!slot.values.length) issues.push({ path: `${base}.values`, message: "slot needs at least one alternative" });
    if (!slot.sourcePhrase.trim()) issues.push({ path: `${base}.sourcePhrase`, message: "source phrase is required" });
    if (slot.status === "unknown" && slot.hardness !== null) {
      issues.push({ path: `${base}.hardness`, message: "unknown slot status cannot silently assert hardness" });
    }
  });
  if (value.price.min !== null && value.price.max !== null && value.price.min > value.price.max) {
    issues.push({ path: "price", message: "price.min must not exceed price.max" });
  }
  return issues;
}

/** Human-readable audit rendering: one line per slot, including negation and unknowns. */
export function renderIntentContract(contract: IntentContract): string[] {
  const lines = [
    `شکار ${contract.huntId} | ${contract.entity.kind}: ${contract.entity.values.join(" یا ")} | وضعیت: ${contract.entity.status} | منبع: «${contract.entity.sourcePhrase}»`,
  ];
  contract.slots.forEach((slot, index) => {
    lines.push(
      `اسلات ${index + 1} | گونه: ${slot.kind} | مقدارها: ${slot.values.join(" یا ")} | قطبیت: ${slot.polarity === "mustNot" ? "نباید" : "باید"} | سختی: ${slot.hardness === null ? "تعیین‌نشده" : slot.hardness === "hard" ? "سخت" : "نرم"} | وضعیت: ${slot.status === "unknown" ? "نامشخص" : "تأییدشده"} | منبع: «${slot.sourcePhrase}»`,
    );
  });
  lines.push(`تراکنش | مقدارها: ${contract.transactions.values.join(" یا ") || "نامشخص"} | وضعیت: ${contract.transactions.status} | منبع: «${contract.transactions.sourcePhrase ?? "ثبت نشده"}»`);
  lines.push(`محل | مقدار: ${contract.location.value ?? "نامشخص"} | وضعیت: ${contract.location.status} | منبع: «${contract.location.sourcePhrase ?? "ثبت نشده"}»`);
  lines.push(`قیمت | حداقل: ${contract.price.min ?? "نامشخص"} | حداکثر: ${contract.price.max ?? "نامشخص"} | ارز: ${contract.price.currency ?? "نامشخص"} | وضعیت: ${contract.price.status} | منبع: «${contract.price.sourcePhrase ?? "ثبت نشده"}»`);
  return lines;
}

/**
 * Contract-level guard: unknown or soft slots are never rejection gates.
 * Condition (new/used) is descriptive metadata, not a reject/accept judge.
 */
export function slotMayReject(slot: IntentSlot): boolean {
  if (slot.status !== "confirmed" || slot.hardness !== "hard") return false;
  if (slot.kind.trim().toLowerCase() === "condition") return false;
  return true;
}
