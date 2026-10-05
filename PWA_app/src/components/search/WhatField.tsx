"use client";

import { forwardRef, useEffect, useRef, useState } from "react";

interface WhatFieldProps {
  value: string;
  onChange: (value: string) => void;
}

const ROTATING = [
  "مثلاً پیانو آکوستیک یاماها U3…",
  "مثلاً آپارتمان نوساز سعادت‌آباد…",
  "مثلاً دوربین سونی زیر ۱۰۰ میلیون…",
];

/**
 * «چی؟» — the WHAT of the hunt. A plain field of the hunt-definition
 * form, not a search box: no submit icon, no Enter-to-fire. Enter just
 * blurs the field; the only way to fire is the «شکار کن» button.
 */
export const WhatField = forwardRef<HTMLInputElement, WhatFieldProps>(
  function WhatField({ value, onChange }, ref) {
    const [slot, setSlot] = useState(0);
    const localRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (value !== "") return;
      const t = setInterval(() => setSlot((s) => (s + 1) % ROTATING.length), 4000);
      return () => clearInterval(t);
    }, [value]);

    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="hunt-what"
          className="text-[13px] font-medium leading-5 text-foreground"
        >
          چی رو می‌خوای شکار کنی؟
        </label>
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
          placeholder={ROTATING[slot]}
          autoComplete="off"
          enterKeyHint="done"
          aria-label="چی رو می‌خوای شکار کنی؟"
          className="h-13 min-h-13 w-full rounded-xl border border-border bg-card px-4 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
        />
      </div>
    );
  }
);
