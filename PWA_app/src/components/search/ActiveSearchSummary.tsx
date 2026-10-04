"use client";

import { Chip } from "@/components/ui/chip";

export interface SummaryChip {
  id: string;
  label: string;
  inferred?: boolean;
}

interface ActiveSearchSummaryProps {
  /** Only refinements beyond the raw query. The query lives in the input. */
  chips: SummaryChip[];
  onRemoveChip: (chipId: string) => void;
  onClearAll: () => void;
}

/**
 * Slim removable-constraint strip — deliberately NOT a card, so it never
 * competes with Meaning (understanding) or Results (triage).
 */
export function ActiveSearchSummary({
  chips,
  onRemoveChip,
  onClearAll,
}: ActiveSearchSummaryProps) {
  if (chips.length === 0) return null;

  return (
    <div
      aria-label="جستجوی فعال"
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
    >
      <span className="text-[11px] font-medium leading-4 text-muted-foreground">جستجوی فعال</span>
      {chips.map((chip) => (
        <Chip
          key={chip.id}
          tone={chip.id.startsWith("exclude:") ? "negative" : "neutral"}
          dashed={chip.inferred}
          onRemove={() => onRemoveChip(chip.id)}
          removeLabel={`حذف ${chip.label.replace(/^حذف:\s*/, "")} از جستجو`}
        >
          {chip.inferred ? (
            <>
              {chip.label}
              <span className="rounded-full bg-secondary px-1.5 text-[11px] leading-4 text-muted-foreground">
                حدسی
              </span>
            </>
          ) : (
            chip.label
          )}
        </Chip>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="rounded-full px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        پاک کردن فیلترها
      </button>
    </div>
  );
}
