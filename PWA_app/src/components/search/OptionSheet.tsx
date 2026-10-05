"use client";

import { Check } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";

interface OptionSheetProps {
  open: boolean;
  title: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/** Generic single-choice list picker in a bottom sheet. */
export function OptionSheet({
  open,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: OptionSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} label={title} title={title}>
      <div className="flex flex-col gap-1 pb-2" role="listbox" aria-label={title}>
        {options.map((opt) => {
          const active = opt.value === selected;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onSelect(opt.value);
                onClose();
              }}
              className={`flex min-h-12 w-full items-center justify-between rounded-lg px-4 text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                active
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              {opt.label}
              {active && <Check size={16} aria-hidden="true" className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
