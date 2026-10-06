"use client";

import { cn } from "@/lib/utils";
import type { DimensionDef } from "@/lib/dimensions";

interface DimensionChipsProps {
  def: DimensionDef;
  /** "" = unresolved; stays visible after picking so the user can change it. */
  value: string;
  onSelect: (value: string) => void;
}

/**
 * One required dimension block (the generalized #4 transaction pattern):
 * label + «لازمه» badge, one-line hint, one-tap options. A neutral option
 * («فرقی نداره») is a real answer the engine respects — never a dark
 * pattern. Selecting is free and pre-search; the hunt stays blocked until
 * every visible dimension is resolved.
 */
export function DimensionChips({ def, value, onSelect }: DimensionChipsProps) {
  const allOptions = def.neutral ? [...def.options, def.neutral] : def.options;
  const cols = allOptions.length <= 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium leading-5 text-foreground">{def.label}</p>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] leading-4 text-muted-foreground">
          لازمه
        </span>
      </div>
      <p className="-mt-1 text-xs leading-5 text-muted-foreground">{def.hint}</p>
      <div className={cn("grid gap-2", cols)} role="radiogroup" aria-label={def.label}>
        {allOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onSelect(opt.value)}
            className={cn(
              "min-h-11 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              value === opt.value
                ? "border-ring bg-secondary text-foreground"
                : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
