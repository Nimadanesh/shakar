"use client";

import { Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { SortKey } from "@/lib/search";
import { cn } from "@/lib/utils";

const SORT_OPTIONS: Array<{ value: SortKey; label: string; hint: string }> = [
  { value: "best", label: "دقیق‌ترین تطابق", hint: "پیش‌فرض شکار" },
  { value: "cheap", label: "ارزان‌ترین", hint: "قیمت کم به زیاد" },
  { value: "pricey", label: "گران‌ترین", hint: "قیمت زیاد به کم" },
];

interface SortSheetProps {
  open: boolean;
  sort: SortKey;
  onSelect: (sort: SortKey) => void;
  onClose: () => void;
}

/**
 * Sort control. Only genuinely supported orders are offered — «جدیدترین»
 * is intentionally absent: fixtures carry no reliable timestamps.
 */
export function SortSheet({ open, sort, onSelect, onClose }: SortSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="مرتب‌سازی نتایج"
      title="مرتب‌سازی نتایج"
    >
      <div role="radiogroup" aria-label="مرتب‌سازی نتایج" className="flex flex-col gap-1">
        {SORT_OPTIONS.map((option) => {
          const selected = option.value === sort;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                onSelect(option.value);
                onClose();
              }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                selected
                  ? "border-primary/60 bg-primary/10"
                  : "border-transparent hover:bg-secondary"
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                  selected ? "border-primary ring-1 ring-primary/50 ring-inset" : "border-border-strong"
                )}
              >
                {selected && <span className="size-2.5 rounded-full bg-primary" />}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className={cn("text-sm", selected ? "font-medium text-foreground" : "text-muted-foreground")}>
                  {option.label}
                </span>
                <span className="text-xs leading-4 text-muted-foreground">{option.hint}</span>
              </span>
              {selected && <Check size={16} aria-hidden="true" className="ms-auto text-primary" />}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
