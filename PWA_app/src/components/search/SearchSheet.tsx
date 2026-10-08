"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BellRing, Bookmark, Heart, History, Radar, Search, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  filterSearchItems,
  sortSearchItems,
  type SearchItem,
  type SearchItemKind,
} from "./search-items";

const KIND_ICON: Record<SearchItemKind, typeof Search> = {
  fresh: BellRing,
  kamin: Radar,
  history: History,
  favorite: Heart,
  "saved-hunt": Bookmark,
};

/**
 * Cross-tab live search (navid 2026-10-08): a bottom sheet opened from
 * the search FAB on /saved and /archive. Results stream in as you type
 * (no submit), each carrying its home tab and its constraints (قیدها) —
 * so the dealer's five BMW hunts with different constraints read apart.
 */
export function SearchSheet({
  open,
  onClose,
  title,
  items,
  loadingHint,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  items: SearchItem[];
  /** Shown while async titles (favorites) resolve. */
  loadingHint?: string | null;
  onSelect: (item: SearchItem) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) setQuery("");
  }, [open ]);

  const results = useMemo(
    () => sortSearchItems(filterSearchItems(items, query)),
    [items, query]
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      label={title}
      title={title}
      subtitle="هرچی تایپ کنی، زنده میاد"
      initialFocusRef={inputRef}
    >
      <div className="sticky top-0 -mx-4 -mt-1 bg-card px-4 pb-2 pt-1">
        <div className="relative">
          <Search
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="مثلاً بی ام و تهران…"
            aria-label="جستجو"
            autoComplete="off"
            enterKeyHint="search"
            className="h-12 w-full rounded-xl border border-border bg-secondary/60 pe-10 ps-4 text-[16px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
          />
          {query !== "" && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="پاک کردن جستجو"
              className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {loadingHint && (
        <p className="text-[12px] text-muted-foreground" aria-live="polite">
          {loadingHint}
        </p>
      )}

      {results.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">
          {query.trim() === "" ? "هنوز چیزی برای جستجو نیست." : "چیزی پیدا نشد — یه کلمه‌ی دیگه امتحان کن."}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5" aria-label="نتایج جستجو">
          {results.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-start transition-colors hover:border-ring focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Icon size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                        {item.title}
                      </span>
                      <span className="shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] leading-4 text-muted-foreground">
                        {item.tabLabel}
                      </span>
                    </span>
                    {item.constraints.length > 0 && (
                      <span className="mt-1 block truncate text-[11px] leading-5 text-muted-foreground">
                        {item.constraints.join(" • ")}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}

/**
 * The search FAB: bottom-left, shared by /saved and /archive
 * (navid 2026-10-08).
 */
export function SearchFab({ onOpen, label }: { onOpen: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="fixed bottom-24 left-4 z-40 flex size-13 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-ring active:scale-95"
    >
      <Search size={20} aria-hidden="true" />
    </button>
  );
}
