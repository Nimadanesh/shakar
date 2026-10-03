"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, Search } from "lucide-react";
import { FOCUS_SEARCH_EVENT } from "@/components/layout/Header";
import { KeywordChips } from "@/components/search/KeywordChips";
import { validateSearchFilters } from "@/lib/keywords";
import type { SearchFilterParams } from "@/lib/keywords";

const categories = [
  { value: "all", label: "همه دسته‌ها" },
  { value: "vehicles", label: "خودرو" },
  { value: "real-estate", label: "املاک" },
  { value: "mobile", label: "موبایل و کالای دیجیتال" },
  { value: "home", label: "خانه و آشپزخانه" },
  { value: "jobs", label: "استخدام" },
] as const;

const cities = [
  { value: "all", label: "همه شهرها" },
  { value: "tehran", label: "تهران" },
  { value: "karaj", label: "کرج" },
  { value: "isfahan", label: "اصفهان" },
  { value: "shiraz", label: "شیراز" },
  { value: "mashhad", label: "مشهد" },
  { value: "tabriz", label: "تبریز" },
] as const;

interface SearchFiltersProps {
  onSearch: (params: SearchFilterParams) => void;
  isSearching?: boolean;
}

export function SearchFilters({ onSearch, isSearching = false }: SearchFiltersProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [city, setCity] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [includeKeywords, setIncludeKeywords] = useState<string[]>([]);
  const [excludeKeywords, setExcludeKeywords] = useState<string[]>([]);
  const [hasImage, setHasImage] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function focusQuery() {
      queryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      queryRef.current?.focus({ preventScroll: true });
    }
    window.addEventListener(FOCUS_SEARCH_EVENT, focusQuery);
    return () => window.removeEventListener(FOCUS_SEARCH_EVENT, focusQuery);
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const params: SearchFilterParams = {
      query: query.trim(),
      category,
      city,
      priceMin: priceMin.trim(),
      priceMax: priceMax.trim(),
      includeKeywords,
      excludeKeywords,
      hasImage,
    };
    const validationError = validateSearchFilters(params);
    setError(validationError);
    if (validationError) return;
    onSearch(params);
  }

  const selectClassName =
    "h-11 w-full appearance-none rounded-full border border-input bg-card pe-10 ps-4 text-[13px] text-foreground outline-none transition-colors focus:border-ring";

  return (
    <form id="search" role="search" onSubmit={handleSubmit} className="flex scroll-mt-24 flex-col gap-4">
      <div className="flex h-12 items-center gap-2 rounded-full border border-border bg-card ps-4 pe-1.5 shadow-[0_8px_32px_rgb(0_0_0/0.35)] focus-within:border-ring">
        <Search size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        <input
          ref={queryRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="چی شکار می‌کنی؟"
          aria-label="متن جستجو"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        {query.trim() !== "" && (
          <button
            type="submit"
            disabled={isSearching}
            aria-label="جستجو"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-ring active:scale-95 disabled:opacity-50"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="دسته‌بندی"
            className={selectClassName}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        </div>
        <div className="relative">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="شهر"
            className={selectClassName}
          >
            {cities.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
        </div>
      </div>

      <button
        type="button"
        aria-expanded={advancedOpen}
        onClick={() => setAdvancedOpen((v) => !v)}
        className="flex items-center justify-center gap-1 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        فیلتر دقیق‌تر
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`transition-transform duration-200 ease-out ${advancedOpen ? "rotate-180" : ""}`}
        />
      </button>

      {advancedOpen && (
        <div className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-2 text-[13px] font-medium leading-5 text-foreground">
              کف قیمت
              <input
                type="text"
                inputMode="numeric"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="از (تومان)"
                aria-label="کف قیمت به تومان"
                className="h-11 w-full rounded-xl border border-input bg-muted/40 px-3 text-[13px] font-normal text-foreground outline-none transition-colors focus:border-ring"
              />
            </label>
            <label className="flex flex-col gap-2 text-[13px] font-medium leading-5 text-foreground">
              سقف قیمت
              <input
                type="text"
                inputMode="numeric"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="تا (تومان)"
                aria-label="سقف قیمت به تومان"
                className="h-11 w-full rounded-xl border border-input bg-muted/40 px-3 text-[13px] font-normal text-foreground outline-none transition-colors focus:border-ring"
              />
            </label>
          </div>

          <KeywordChips
            id="include-keywords"
            label="این کلمات در توضیحات باشد"
            placeholder="بنویس و Enter بزن…"
            values={includeKeywords}
            onChange={setIncludeKeywords}
            tone="include"
          />
          <KeywordChips
            id="exclude-keywords"
            label="این کلمات در توضیحات نباشد"
            placeholder="بنویس و Enter بزن…"
            values={excludeKeywords}
            onChange={setExcludeKeywords}
            tone="exclude"
          />

          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={hasImage}
              onChange={(e) => setHasImage(e.target.checked)}
              className="size-4 accent-primary"
            />
            فقط آگهی‌های عکس‌دار
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
