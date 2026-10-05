"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { parsePriceInput, formatPriceToman } from "@/lib/prices";

const QUICK_PRICES = [
  { label: "۵۰م", value: "۵۰ میلیون" },
  { label: "۱۰۰م", value: "۱۰۰ میلیون" },
  { label: "۲۰۰م", value: "۲۰۰ میلیون" },
  { label: "۵۰۰م", value: "۵۰۰ میلیون" },
];

interface PriceSheetProps {
  open: boolean;
  priceMin: string;
  priceMax: string;
  onApply: (min: string, max: string) => void;
  onClose: () => void;
}

/** Price range picker in a bottom sheet: min/max fields + quick amounts. */
export function PriceSheet({ open, priceMin, priceMax, onApply, onClose }: PriceSheetProps) {
  const [min, setMin] = useState(priceMin);
  const [max, setMax] = useState(priceMax);
  const [target, setTarget] = useState<"min" | "max">("max");
  const [error, setError] = useState<string | null>(null);

  // Reset the draft every time the sheet opens.
  useEffect(() => {
    if (open) {
      setMin(priceMin);
      setMax(priceMax);
      setError(null);
      setTarget("max");
    }
  }, [open, priceMin, priceMax]);

  function apply() {
    const minV = parsePriceInput(min);
    const maxV = parsePriceInput(max);
    if (minV !== null && maxV !== null && minV > maxV) {
      setError("کف قیمت نمی‌تواند از سقف بیشتر باشد.");
      return;
    }
    if (min.trim() !== "" && minV === null) {
      setError("کف قیمت قابل فهم نیست — مثلاً «۵۰ میلیون».");
      return;
    }
    if (max.trim() !== "" && maxV === null) {
      setError("سقف قیمت قابل فهم نیست — مثلاً «۲۰۰ میلیون».");
      return;
    }
    onApply(min.trim(), max.trim());
    onClose();
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm tabular-nums text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="محدوده قیمت"
      title="محدوده قیمت"
      footer={
        <button
          type="button"
          onClick={apply}
          className="h-12 w-full rounded-xl bg-action-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
        >
          تأیید
        </button>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">کف قیمت</span>
            <input
              type="text"
              inputMode="numeric"
              value={min}
              onChange={(e) => {
                setMin(e.target.value);
                setError(null);
              }}
              onFocus={() => setTarget("min")}
              placeholder="مثلاً ۵۰ میلیون"
              aria-label="کف قیمت به تومان"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground">سقف قیمت</span>
            <input
              type="text"
              inputMode="numeric"
              value={max}
              onChange={(e) => {
                setMax(e.target.value);
                setError(null);
              }}
              onFocus={() => setTarget("max")}
              placeholder="مثلاً ۲۰۰ میلیون"
              aria-label="سقف قیمت به تومان"
              className={inputClass}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="مقادیر سریع قیمت">
          {QUICK_PRICES.map((quick) => (
            <button
              key={quick.label}
              type="button"
              onClick={() => {
                if (target === "min") setMin(quick.value);
                else setMax(quick.value);
                setError(null);
              }}
              className="flex min-h-8 items-center rounded-lg border border-border px-3 text-xs tabular-nums text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {quick.label}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-xs leading-5 text-danger">
            {error}
          </p>
        )}
        {(min.trim() !== "" || max.trim() !== "") &&
          (() => {
            const minV = parsePriceInput(min);
            const maxV = parsePriceInput(max);
            const preview =
              minV !== null && maxV !== null
                ? `از ${formatPriceToman(minV)} تا ${formatPriceToman(maxV)}`
                : maxV !== null
                  ? `تا ${formatPriceToman(maxV)}`
                  : minV !== null
                    ? `از ${formatPriceToman(minV)}`
                    : null;
            return preview ? (
              <p className="text-xs leading-5 text-muted-foreground" aria-live="polite">
                {preview}
              </p>
            ) : null;
          })()}
      </div>
    </BottomSheet>
  );
}
