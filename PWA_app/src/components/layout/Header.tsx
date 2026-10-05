"use client";

import { Search } from "lucide-react";

export const FOCUS_SEARCH_EVENT = "shekar:focus-search";

/**
 * Navigation header only. The single real search input lives in the Search
 * Workspace below; this control is an unmistakable action button (icon-only,
 * circular) that scrolls to and focuses it — never a second search field.
 */
export function Header() {
  function handleClick() {
    window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-screen-sm items-center justify-between px-4">
        <span className="text-[17px] font-semibold tracking-tight text-foreground">شکار</span>
        <button
          type="button"
          onClick={handleClick}
          aria-label="رفتن به جستجو"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 ease-out hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.96]"
        >
          <Search size={20} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
