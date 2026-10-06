"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { normalizePersian } from "@/lib/normalizePersian";

interface OptionSheetProps {
  open: boolean;
  title: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  /**
   * Divar-style search inside the sheet. Off by default — only the city
   * sheet needs it (29 options); the category sheet has 6.
   */
  searchable?: boolean;
  searchPlaceholder?: string;
}

/** Generic single-choice list picker in a bottom sheet. */
export function OptionSheet({
  open,
  title,
  options,
  selected,
  onSelect,
  onClose,
  searchable = false,
  searchPlaceholder = "جستجوی شهر…",
}: OptionSheetProps) {
  const [query, setQuery] = useState("");

  // The search box never carries a stale filter into the next open:
  // every close resets it. (All closes flow through handleClose.)
  function handleClose() {
    setQuery("");
    onClose();
  }

  const visible = useMemo(() => {
    const needle = normalizePersian(query);
    if (!searchable || needle === "") return options;
    return options.filter((opt) => normalizePersian(opt.label).includes(needle));
  }, [query, options, searchable]);

  return (
    <BottomSheet open={open} onClose={handleClose} label={title} title={title}>
      {searchable && (
        <div className="sticky top-0 z-10 -mx-1 bg-card px-1 pb-2 pt-1">
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="min-h-12 w-full rounded-lg border border-border bg-background py-3 pe-4 ps-10 text-base text-foreground placeholder:text-muted-foreground/70 focus:border-ring focus:outline-none"
            />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1 pb-2" role="listbox" aria-label={title}>
        {visible.map((opt) => {
          const active = opt.value === selected;
          return (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onSelect(opt.value);
                handleClose();
              }}
              className={`flex min-h-12 w-full items-center justify-between rounded-lg px-4 text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-ring ${
                active
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              {opt.label}
              {active && <Check size={16} aria-hidden="true" className="shrink-0" />}
            </button>
          );
        })}
        {visible.length === 0 && (
          <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
            شهری با این نام پیدا نشد.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
