"use client";

import { Search } from "lucide-react";

export const FOCUS_SEARCH_EVENT = "shekar:focus-search";

export function Header() {
  function handleClick() {
    window.location.hash = "search";
    window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
  }

  return (
    <header className="sticky top-3 z-40 mx-4 max-w-screen-sm sm:mx-auto">
      <button
        type="button"
        onClick={handleClick}
        aria-label="رفتن به جستجو"
        className="flex h-12 w-full items-center gap-2 rounded-full border border-white/10 bg-secondary/70 px-4 text-sm text-muted-foreground shadow-[0_8px_32px_rgb(0_0_0/0.45)] backdrop-blur-xl transition-colors duration-150 ease-out hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.98]"
      >
        <Search size={18} aria-hidden="true" className="shrink-0" />
        <span className="truncate">جستجو در آگهی‌ها…</span>
      </button>
    </header>
  );
}
