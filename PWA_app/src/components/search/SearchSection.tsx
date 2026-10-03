"use client";

import { useState } from "react";
import { SearchX, Telescope } from "lucide-react";
import { SearchFilters } from "@/components/search/SearchFilters";
import type { SearchFilterParams } from "@/lib/keywords";

type ResultsState =
  | { status: "idle" }
  | { status: "loading"; params: SearchFilterParams }
  | { status: "pending-backend"; params: SearchFilterParams };

export function SearchSection() {
  const [state, setState] = useState<ResultsState>({ status: "idle" });

  function handleSearch(params: SearchFilterParams) {
    setState({ status: "loading", params });
    window.setTimeout(() => {
      setState({ status: "pending-backend", params });
    }, 900);
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchFilters onSearch={handleSearch} isSearching={state.status === "loading"} />

      <div aria-live="polite">
        {state.status === "idle" && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
            <Telescope size={28} aria-hidden="true" className="text-muted-foreground" />
            <p className="text-sm font-medium">برای شروع، بالا جستجو کنید</p>
            <p className="text-[13px] leading-6 text-muted-foreground">
              دسته، شهر و کلمات داخل توضیحات را مشخص کنید تا شکار شروع شود.
            </p>
          </div>
        )}

        {state.status === "loading" && (
          <div className="flex flex-col gap-3" aria-busy="true" aria-label="در حال جستجو">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3"
              >
                <div className="aspect-[16/10] w-full animate-pulse rounded-xl bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-muted" />
                <div className="h-4 w-1/2 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        )}

        {state.status === "pending-backend" && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-10 text-center">
            <SearchX size={28} aria-hidden="true" className="text-muted-foreground" />
            <p className="text-sm font-medium">موتور جستجو هنوز متصل نیست</p>
            <p className="text-[13px] leading-6 text-muted-foreground">
              فیلترهای شما ثبت شد. اتصال به دیوار قدم بعدی است؛ نتیجه واقعی
              اینجا نمایش داده می‌شود.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
