"use client";

import { forwardRef, useEffect, useState } from "react";
import { Search, X } from "lucide-react";

const ROTATING_PLACEHOLDERS = [
  "پیانو آکوستیک واقعی، نه طرح…",
  "آپارتمان نوساز سعادت‌آباد تا ۵ میلیارد…",
  "دوربین سونی، بدون تعمیر…",
];

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isSearching?: boolean;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onChange, onSubmit, isSearching = false }, ref) {
    const hasText = value.trim() !== "";
    const [placeholderIndex, setPlaceholderIndex] = useState(0);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
      if (focused || hasText) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const timer = window.setInterval(() => {
        setPlaceholderIndex((i) => (i + 1) % ROTATING_PLACEHOLDERS.length);
      }, 4000);
      return () => window.clearInterval(timer);
    }, [focused, hasText]);

    function handleSubmit(event: React.FormEvent) {
      event.preventDefault();
      onSubmit();
    }

    return (
      <form
        role="search"
        onSubmit={handleSubmit}
        className="flex h-14 items-center gap-2 rounded-lg border border-border bg-card ps-4 pe-2 transition-shadow focus-within:border-ring focus-within:shadow-glow"
      >
        <Search size={22} aria-hidden="true" className="shrink-0 text-muted-foreground" />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={ROTATING_PLACEHOLDERS[placeholderIndex]}
          aria-label="متن جستجو"
          autoComplete="off"
          enterKeyHint="search"
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
        />
        {hasText && (
          <button
            type="button"
            aria-label="پاک کردن جستجو"
            onClick={() => onChange("")}
            className="flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
        {hasText && (
          <button
            type="submit"
            disabled={isSearching}
            aria-label="جستجو"
            className="flex size-11 shrink-0 items-center justify-center rounded-md bg-action-primary text-primary-foreground transition-all hover:bg-action-primary-hover focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.97] active:bg-action-primary-active disabled:opacity-40"
          >
            <Search size={20} aria-hidden="true" />
          </button>
        )}
      </form>
    );
  }
);
