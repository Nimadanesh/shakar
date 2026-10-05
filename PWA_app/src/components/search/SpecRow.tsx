"use client";

import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface SpecRowProps {
  label: string;
  value: ReactNode;
  inferred?: boolean;
  onOpen: () => void;
}

/**
 * One tappable specs row (دسته / شهر / قیمت). Opens its bottom-sheet
 * picker. Inferred values render dashed until the user picks them.
 */
export function SpecRow({ label, value, inferred, onOpen }: SpecRowProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 text-start transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <span
          className={
            inferred
              ? "rounded-md border border-dashed border-muted-foreground/60 px-2 py-0.5 text-[13px] text-muted-foreground"
              : "text-[13px] text-foreground"
          }
        >
          {value}
          {inferred && <span className="text-[11px] text-muted-foreground/80"> · حدسی</span>}
        </span>
        <ChevronLeft size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
      </span>
    </button>
  );
}
