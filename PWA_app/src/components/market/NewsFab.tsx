"use client";

import { useState } from "react";
import { Newspaper } from "lucide-react";
import { MarketSheet } from "@/components/market/MarketSheet";

/**
 * NEWS entry point on the شکار page: a floating button pinned above the
 * bottom tab bar (bottom-right). Opens the market sheet — FX/coin prices
 * with sparklines, economic headlines, and the coming-soon advisor.
 */
export function NewsFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="اخبار و قیمت بازار"
        className="fixed bottom-24 right-4 z-40 flex size-12 items-center justify-center rounded-full bg-foreground text-background shadow-[0_8px_24px_rgb(0_0_0/0.35)] transition-transform focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.96]"
      >
        <Newspaper size={20} aria-hidden="true" />
      </button>
      <MarketSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
