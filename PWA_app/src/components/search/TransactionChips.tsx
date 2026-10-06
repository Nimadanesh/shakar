"use client";

import type { RefObject } from "react";
import { cn } from "@/lib/utils";

export type TransactionValue = "" | "rent" | "buy";

interface TransactionChipsProps {
  value: TransactionValue;
  onSelect: (v: "rent" | "buy") => void;
  /** Briefly ring the block when شکار کن is tapped while unresolved. */
  flash: boolean;
  sectionRef: RefObject<HTMLDivElement | null>;
}

/**
 * Required disambiguation for real-estate hunts: the transaction type
 * (rent vs buy) can never be guessed on a paid search and must never
 * double the cost by searching both. One tap, zero quota, pre-search.
 */
export function TransactionChips({ value, onSelect, flash, sectionRef }: TransactionChipsProps) {
  return (
    <div
      ref={sectionRef}
      className={cn(
        "flex scroll-mt-24 flex-col gap-2 rounded-lg border p-3 transition-colors",
        flash ? "border-ring" : "border-border"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium leading-5 text-foreground">نوع معامله</p>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] leading-4 text-muted-foreground">
          لازمه
        </span>
      </div>
      <p className="-mt-1 text-xs leading-5 text-muted-foreground">
        این ملک برای اجاره‌ست یا خرید؟ بدون این، شکار دقیق نمی‌شه.
      </p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="نوع معامله">
        {(
          [
            { v: "rent", label: "اجاره" },
            { v: "buy", label: "خرید" },
          ] as const
        ).map(({ v, label }) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onSelect(v)}
            className={cn(
              "min-h-11 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              value === v
                ? "border-ring bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
