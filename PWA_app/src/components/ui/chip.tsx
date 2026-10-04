import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChipTone = "neutral" | "positive" | "negative";

const DOT_STYLES: Record<ChipTone, string> = {
  neutral: "bg-muted-foreground",
  positive: "bg-signal",
  negative: "bg-danger",
};

interface ChipProps {
  /** Semantic tone; meaning never relies on color alone (dot + label context). */
  tone?: ChipTone;
  dashed?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  children: React.ReactNode;
}

/**
 * Removable active-constraint chip. Reserved for live refinements —
 * examples, selects and navigation must not use chip language.
 */
export function Chip({ tone = "neutral", dashed = false, onRemove, removeLabel, children }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1.5 pe-1.5 ps-3 text-[13px] leading-5 text-foreground",
        dashed && "border-dashed"
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT_STYLES[tone])} aria-hidden="true" />
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label={removeLabel ?? "حذف"}
          onClick={onRemove}
          className="relative flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring after:absolute after:-inset-2 after:content-['']"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
