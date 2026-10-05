import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type NoticeTone = "neutral" | "signal" | "danger";

const TONE_STYLES: Record<NoticeTone, string> = {
  neutral: "border-border bg-secondary/60 text-muted-foreground",
  signal: "border-signal/30 bg-signal-soft text-foreground",
  danger: "border-danger/30 bg-danger-soft text-foreground",
};

interface NoticeBarProps {
  tone?: NoticeTone;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/** Quiet inline notice row for suppressed/hidden-state communication. */
export function NoticeBar({ tone = "neutral", icon, children }: NoticeBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs leading-5",
        TONE_STYLES[tone]
      )}
    >
      {icon ?? <Info size={14} aria-hidden="true" className="shrink-0" />}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
