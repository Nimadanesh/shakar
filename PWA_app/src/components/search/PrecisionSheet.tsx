"use client";

import { useRef, useState } from "react";
import { Radar } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { KeywordChips } from "@/components/search/KeywordChips";
import { Switch } from "@/components/ui/switch";
import { CATEGORIES, CITIES } from "@/data/taxonomy";
import { formatPriceToman, parsePriceInput } from "@/lib/prices";
import { queryContentTerms, displayTerms, runSearch } from "@/lib/search";
import { SEARCH_FIXTURES } from "@/data/search-fixtures";
import type { SearchContext } from "@/types/search";

export interface PrecisionDraft {
  priceMin: string;
  priceMax: string;
  include: string[];
  exclude: string[];
  hasImage: boolean;
  category: string;
  city: string;
}

interface PrecisionSheetProps {
  open: boolean;
  /**
   * "setup": the sheet is the intent-confirmation gate before the ONE paid
   * search (CTA = «شکار کن»). "refine": the sheet edits an executed hunt
   * (CTA = «اجرای مجدد شکار», explicitly a new paid search).
   */
  mode: "setup" | "refine";
  initial: PrecisionDraft;
  /** Live search context around the draft (query) for honest impact preview. */
  preview: Pick<SearchContext, "query" | "category" | "city">;
  onApply: (draft: PrecisionDraft) => void;
  onClose: () => void;
  /** Optional: when omitted, the کمین entry is not rendered. */
  onOpenRadar?: () => void;
}

const QUICK_PRICES: Array<{ label: string; value: string }> = [
  { label: "۵۰م", value: "۵۰ میلیون" },
  { label: "۱۰۰م", value: "۱۰۰ میلیون" },
  { label: "۲۰۰م", value: "۲۰۰ میلیون" },
  { label: "۵۰۰م", value: "۵۰۰ میلیون" },
];

function PricePreview({ value }: { value: string }) {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = parsePriceInput(trimmed);
  if (parsed === null) {
    return (
      <span className="text-xs leading-5 text-danger" role="alert">
        قیمت معتبر نیست
      </span>
    );
  }
  return (
    <span className="text-xs leading-5 tabular-nums text-muted-foreground">
      ≈ {formatPriceToman(parsed)}
    </span>
  );
}

export function PrecisionSheet({ open, mode, initial, preview, onApply, onClose, onOpenRadar }: PrecisionSheetProps) {
  // Draft restarts from live values on every open via the remount key set by
  // the parent (key changes with `open`), so no syncing effect is needed.
  const [draft, setDraft] = useState<PrecisionDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [priceTarget, setPriceTarget] = useState<"priceMin" | "priceMax">("priceMax");
  const firstFieldRef = useRef<HTMLInputElement>(null);

  const previewCount = (() => {
    if (!open) return null;
    const min = parsePriceInput(draft.priceMin);
    const max = parsePriceInput(draft.priceMax);
    if (min !== null && max !== null && min > max) return null;
    try {
      const ctx: SearchContext = {
        query: preview.query,
        includeKeywords: draft.include,
        excludeKeywords: draft.exclude,
        category: draft.category,
        city: draft.city,
        priceMin: min,
        priceMax: max,
        hasImage: draft.hasImage,
      };
      return runSearch(ctx, SEARCH_FIXTURES).results.length;
    } catch {
      return null;
    }
  })();

  if (!open) return null;

  const queryTerms = queryContentTerms(preview.query, []);
  const displayFor = (terms: string[]) => displayTerms(preview.query, terms);
  const includeSuggestions = displayFor(
    queryTerms.filter((t) => !draft.include.includes(t) && !draft.exclude.includes(t))
  );
  const excludeSuggestions = displayFor(
    queryTerms.filter((t) => !draft.exclude.includes(t) && !draft.include.includes(t))
  );

  function handleApply() {
    const min = parsePriceInput(draft.priceMin);
    const max = parsePriceInput(draft.priceMax);
    if (
      (draft.priceMin.trim() !== "" && min === null) ||
      (draft.priceMax.trim() !== "" && max === null)
    ) {
      setError("قیمت واردشده معتبر نیست.");
      return;
    }
    if (min !== null && max !== null && min > max) {
      setError("کف قیمت نمی‌تواند از سقف قیمت بیشتر باشد.");
      return;
    }
    onApply(draft);
  }

  function handleClearAll() {
    setDraft({
      priceMin: "",
      priceMax: "",
      include: [],
      exclude: [],
      hasImage: false,
      category: "all",
      city: "all",
    });
    setError(null);
  }

  const selectClassName =
    "h-11 w-full appearance-none rounded-xl border border-border bg-secondary pe-10 ps-4 text-[13px] font-medium text-foreground outline-none transition-colors focus:border-ring";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label="شکار دقیق"
      title="شکار دقیق"
      subtitle="دقیق بگو چه چیزی باید باشد و چه چیزی اصلاً نباشد."
      initialFocusRef={firstFieldRef}
      footer={
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg border border-border text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="h-11 rounded-lg bg-action-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:bg-action-primary-active"
            >
              {mode === "setup" ? "شکار کن" : "اجرای مجدد شکار"}
              {previewCount !== null && (
                <span className="tabular-nums"> - {previewCount.toLocaleString("fa-IR")} آگهی</span>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={handleClearAll}
            className="self-center rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
          >
            پاک کردن همه
          </button>
          {onOpenRadar && (
            <button
              type="button"
              onClick={onOpenRadar}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg text-[13px] text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Radar size={15} aria-hidden="true" />
              ذخیره‌ی این شکار و خبرم کن
            </button>
          )}
        </div>
      }
    >
      {mode === "setup" && preview.query.trim() !== "" && (
        <p className="text-[13px] leading-6 text-muted-foreground">
          شکار: <span className="font-medium text-foreground">«{preview.query.trim()}»</span>
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2 text-[13px] font-medium leading-5 text-foreground">
            کف قیمت
            <input
              ref={firstFieldRef}
              type="text"
              inputMode="numeric"
              value={draft.priceMin}
              onChange={(e) => setDraft((d) => ({ ...d, priceMin: e.target.value }))}
              onFocus={() => setPriceTarget("priceMin")}
              placeholder="مثلاً ۱۸۵ میلیون"
              aria-label="کف قیمت به تومان"
              className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm font-normal tabular-nums text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
          </label>
          <label className="flex flex-col gap-2 text-[13px] font-medium leading-5 text-foreground">
            سقف قیمت
            <input
              type="text"
              inputMode="numeric"
              value={draft.priceMax}
              onChange={(e) => setDraft((d) => ({ ...d, priceMax: e.target.value }))}
              onFocus={() => setPriceTarget("priceMax")}
              placeholder="مثلاً ۲۰۰ میلیون"
              aria-label="سقف قیمت به تومان"
              className="h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm font-normal tabular-nums text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
          </label>
        </div>
        {(draft.priceMin.trim() !== "" || draft.priceMax.trim() !== "") && (
          <div className="flex items-center gap-2">
            <PricePreview value={draft.priceMin} />
            {draft.priceMin.trim() !== "" && draft.priceMax.trim() !== "" && (
              <span aria-hidden="true" className="text-muted-foreground">-</span>
            )}
            <PricePreview value={draft.priceMax} />
          </div>
        )}
        <div className="flex flex-wrap gap-1.5" aria-label="مقادیر سریع قیمت">
          {QUICK_PRICES.map((quick) => (
            <button
              key={quick.label}
              type="button"
              onClick={() => {
                setDraft((d) => ({ ...d, [priceTarget]: quick.value }));
                setError(null);
              }}
              className="flex min-h-8 items-center rounded-lg border border-border px-3 text-xs tabular-nums text-muted-foreground transition-colors hover:border-ring hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              {quick.label}
            </button>
          ))}
        </div>
      </div>

      <section
        aria-label="حتماً باشد"
        className="flex flex-col gap-3 rounded-xl border border-signal/30 bg-signal-soft p-3"
      >
        <KeywordChips
          id="sheet-include"
          label="حتماً باشد"
          helper="اگر این کلمات در توضیحات نباشند، آگهی حذف می‌شود."
          placeholder="بنویس و Enter بزن…"
          values={draft.include}
          suggestions={includeSuggestions}
          tone="positive"
          onChange={(include) => setDraft((d) => ({ ...d, include }))}
        />
      </section>

      <section
        aria-label="اصلاً نباشد"
        className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-soft p-3"
      >
        <KeywordChips
          id="sheet-exclude"
          label="اصلاً نباشد"
          helper="اگر این کلمات در توضیحات باشند، آگهی حذف می‌شود."
          placeholder="بنویس و Enter بزن…"
          values={draft.exclude}
          suggestions={excludeSuggestions}
          tone="negative"
          onChange={(exclude) => setDraft((d) => ({ ...d, exclude }))}
        />
      </section>

      <p className="text-xs leading-5 text-muted-foreground">
        برای عبارت دقیق از گیومه استفاده کن: <span dir="ltr">&ldquo;U3&rdquo;</span>
      </p>

      <div className="flex flex-col gap-3">
        <p className="text-[13px] font-medium leading-5 text-foreground">دسته و شهر</p>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            aria-label="دسته‌بندی"
            className={selectClassName}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={draft.city}
            onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
            aria-label="شهر"
            className={selectClassName}
          >
            {CITIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Switch
        checked={draft.hasImage}
        onChange={(hasImage) => setDraft((d) => ({ ...d, hasImage }))}
        label="فقط آگهی‌های عکس‌دار"
      />

      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
    </BottomSheet>
  );
}
