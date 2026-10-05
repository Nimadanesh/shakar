"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  faDigitsToEn,
  formatPriceCompact,
  formatPriceWords,
} from "@/lib/prices";

const QUICK_PRICES = [
  { label: "۵۰م", value: "50000000" },
  { label: "۱۰۰م", value: "100000000" },
  { label: "۲۰۰م", value: "200000000" },
  { label: "۵۰۰م", value: "500000000" },
];

interface PriceSheetProps {
  open: boolean;
  priceMin: string;
  priceMax: string;
  onApply: (min: string, max: string) => void;
  onClose: () => void;
}

/** Digits kept as plain English digits (parsePriceInput still accepts them). */
function digitsOnly(raw: string): string {
  return faDigitsToEn(raw).replace(/[^\d]/g, "");
}

/**
 * Price range picker: digits-only inputs (conventional, unambiguous) with
 * the amount spelled out in Persian words underneath, plus quick amounts.
 */
export function PriceSheet({ open, priceMin, priceMax, onApply, onClose }: PriceSheetProps) {
  const [min, setMin] = useState(() => digitsOnly(priceMin));
  const [max, setMax] = useState(() => digitsOnly(priceMax));
  const [target, setTarget] = useState<"min" | "max">("max");
  const [error, setError] = useState<string | null>(null);

  // Reset the draft every time the sheet opens.
  useEffect(() => {
    if (open) {
      setMin(digitsOnly(priceMin));
      setMax(digitsOnly(priceMax));
      setError(null);
      setTarget("max");
    }
  }, [open, priceMin, priceMax]);

  function apply() {
    const minV = min === "" ? null : Number(min);
    const maxV = max === "" ? null : Number(max);
    if (minV !== null && maxV !== null && minV > maxV) {
      setError("کف قیمت نمی‌تواند از سقف بیشتر باشد.");
      return;
    }
    onApply(min, max);
    onClose();
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-border bg-secondary px-3 text-[15px] tabular-nums text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring";

  function field(
    kind: "min" | "max",
    label: string,
    value: string,
    setValue: (v: string) => void
  ) {
    const words = value === "" ? null : formatPriceWords(Number(value));
    return (
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <input
          type="text"
          inputMode="numeric"
          dir="ltr"
          value={value}
          onChange={(e) => {
            setValue(digitsOnly(e.target.value));
            setError(null);
          }}
          onFocus={() => setTarget(kind)}
          placeholder="0"
          aria-label={`${label} به تومان — فقط عدد`}
          className={`${inputClass} text-left`}
        />
        <span
          className="min-h-5 text-xs leading-5 text-muted-foreground"
          aria-live="polite"
        >
          {words ? `${words} تومان` : "بدون محدودیت"}
        </span>
      </label>
    );
  }

  const minV = min === "" ? null : Number(min);
  const maxV = max === "" ? null : Number(max);
  const preview =
    minV !== null && maxV !== null
      ? `از ${formatPriceCompact(minV)} تا ${formatPriceCompact(maxV)}`
      : maxV !== null
        ? `تا ${formatPriceCompact(maxV)}`
        : minV !== null
          ? `از ${formatPriceCompact(minV)}`
          : null;

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
        <div className="grid grid-cols-2 gap-3" dir="rtl">
          {field("min", "کف قیمت", min, setMin)}
          {field("max", "سقف قیمت", max, setMax)}
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
        {preview && (
          <p className="text-xs leading-5 text-muted-foreground" aria-live="polite">
            {preview}
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
