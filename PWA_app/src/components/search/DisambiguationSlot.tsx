"use client";

import { cn } from "@/lib/utils";

export interface DisambiguationOption {
  id: string;
  label: string;
}

interface DisambiguationSlotProps {
  /**
   * Genuine-ambiguity options («منظورت کدومه؟»), decided by the
   * deterministic disambiguation layer. Null/empty = no ambiguity:
   * the slot stays reserved at its fixed height and shows the idle
   * whisper — surrounding content never shifts either way.
   *
   * NOTE (2026-10-18): the disambiguation engine is not built yet
   * (owned by «شکار — هوش مصنوعی»). Until it lands, this renders
   * options={null} — the idle whisper only. No behavior is faked.
   */
  options: DisambiguationOption[] | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

/**
 * The fixed-height disambiguation slot under the «چی؟» field.
 * Spacing per designSystem §11: slot top = space-3 (12px), label→chips =
 * space-2 (8px); height 80px derived (12 + 20 + 8 + 40).
 */
export function DisambiguationSlot({
  options,
  selectedId,
  onSelect,
}: DisambiguationSlotProps) {
  const active = options !== null && options.length > 0;

  if (!active) {
    return (
      <div
        aria-hidden="true"
        className="flex h-20 items-center justify-start overflow-hidden"
      >
        <p className="text-[11px] leading-5 text-muted-foreground/80">
          در صورت ابهام، گزینه‌ها رو همین‌جا می‌بینی
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-20 flex-col justify-start gap-2 overflow-hidden pt-3">
      <p className="text-[13px] font-bold leading-5 text-foreground">
        منظورت کدومه؟
      </p>
      <div
        role="group"
        aria-label="منظورت کدومه؟"
        className="flex gap-2 overflow-x-auto overflow-y-hidden pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {(options as DisambiguationOption[]).map((opt) => {
          const selected = opt.id === selectedId;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect?.(opt.id)}
              aria-pressed={selected}
              className={cn(
                "h-10 shrink-0 whitespace-nowrap rounded-[10px] border px-3.5 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                selected
                  ? "border-[1.5px] border-white/80 bg-white/[0.07] text-white"
                  : "border-border bg-transparent text-muted-foreground hover:border-ring hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
