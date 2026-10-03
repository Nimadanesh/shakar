import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function ShekarScoreBadge({ score, className }: { score: number; className?: string }) {
  return (
    <span
      aria-label={`Shekar score ${score} of 100`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[12px] font-bold leading-4 text-accent-foreground",
        className
      )}
    >
      <Star size={13} aria-hidden="true" strokeWidth={2.5} />
      <span>{score.toLocaleString("fa-IR")}</span>
    </span>
  );
}
