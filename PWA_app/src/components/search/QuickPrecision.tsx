"use client";

import { forwardRef } from "react";
import { Crosshair } from "lucide-react";

interface QuickPrecisionProps {
  onOpenAdvanced: () => void;
  advancedActive: boolean;
  refinementCount: number;
}

/**
 * The single lightweight precision entry point. Category/city live inside
 * «شکار دقیق» (sheet) so natural-language search stays first; this button
 * is the single visible door to refinement, with a quiet active count.
 */
export const QuickPrecision = forwardRef<HTMLButtonElement, QuickPrecisionProps>(
  function QuickPrecision({ onOpenAdvanced, advancedActive, refinementCount }, advancedRef) {
    return (
      <button
        ref={advancedRef}
        type="button"
        onClick={onOpenAdvanced}
        aria-haspopup="dialog"
        className={`flex h-11 w-full items-center justify-center gap-2 rounded-lg border text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
          advancedActive
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:text-foreground"
        }`}
      >
        <Crosshair size={16} aria-hidden="true" />
        شکار دقیق
        {refinementCount > 0 && (
          <span className="flex min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold leading-5 tabular-nums text-primary">
            {refinementCount.toLocaleString("fa-IR")}
          </span>
        )}
      </button>
    );
  }
);
