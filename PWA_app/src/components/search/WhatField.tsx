"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatFieldProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * × button: wipes the ENTIRE form (not just this field) back to
   * pristine. Shown only when `showClear` — i.e. the form holds data.
   */
  onClearAll?: () => void;
  showClear?: boolean;
}

/**
 * Rotating examples — the same worked examples from the
 * «چگونه شکار بهتری داشته باشیم؟» coaching sheet, so the box itself
 * teaches the pattern. The new line slides in from below, pushing the
 * old one up (killed by the global reduced-motion rule).
 */
const EXAMPLES = [
  "آپارتمان ۸۰ تا ۱۰۰ متری در سعادت‌آباد، آسانسور حتماً، طبقه اول نباشه، تا ۸ میلیارد",
  "لپ‌تاپ گیمینگ، RTX 4060 حتماً، رم ۱۶ گیگ، تا ۸۰ میلیون",
  "آیفون ۱۳، بدون تعمیر، ۱۲۸ گیگ، تا ۵۰ میلیون",
];

const ROTATE_MS = 4000;

/**
 * «چی؟» — the WHAT of the hunt. A plain field of the hunt-definition
 * form, not a search box: no submit icon, no Enter-to-fire. Enter just
 * blurs the field; the only way to fire is the «شکار کن» button.
 */
export const WhatField = forwardRef<HTMLInputElement, WhatFieldProps>(
  function WhatField({ value, onChange, onClearAll, showClear }, ref) {
    const [[prevSlot, slot], setSlots] = useState<[number, number]>([0, 0]);
    const localRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (value !== "") return;
      const t = setInterval(
        () => setSlots(([p, s]) => [s, (s + 1) % EXAMPLES.length]),
        ROTATE_MS
      );
      return () => clearInterval(t);
    }, [value]);

    const clearVisible = showClear === true && typeof onClearAll === "function";

    return (
      <div className="flex flex-col gap-2">
        <label
          htmlFor="hunt-what"
          className="text-[13px] font-medium leading-5 text-foreground"
        >
          چی رو می‌خوای شکار کنی؟
        </label>
        <div className="relative">
          <input
            id="hunt-what"
            ref={(node) => {
              localRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              // A quota unit is at stake — Enter must never fire the hunt.
              if (e.key === "Enter") localRef.current?.blur();
            }}
            autoComplete="off"
            enterKeyHint="done"
            aria-label="چی رو می‌خوای شکار کنی؟"
            className={cn(
              "h-13 min-h-13 w-full rounded-lg border border-border bg-card px-4 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring",
              // Room for the × (end side in RTL = left).
              clearVisible && "pl-11"
            )}
          />
          {value === "" && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              {prevSlot !== slot && (
                <span
                  key={`out-${prevSlot}`}
                  className="animate-ph-out absolute inset-0 flex items-center px-4"
                >
                  <span className="min-w-0 truncate text-base text-muted-foreground">
                    {EXAMPLES[prevSlot]}
                  </span>
                </span>
              )}
              <span
                key={`in-${slot}`}
                className="animate-ph-in absolute inset-0 flex items-center px-4"
              >
                <span className="min-w-0 truncate text-base text-muted-foreground">
                  {EXAMPLES[slot]}
                </span>
              </span>
            </div>
          )}
          {clearVisible && (
            <button
              type="button"
              onClick={onClearAll}
              aria-label="پاک کردن همه‌ی فیلدها"
              className="absolute left-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }
);
