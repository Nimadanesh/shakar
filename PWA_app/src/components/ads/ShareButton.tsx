"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

/**
 * Share this ad's canonical URL. Uses the Web Share API where available,
 * falls back to copying the link. SSR-safe: everything touches the
 * browser only inside the click handler.
 */
export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: document.title, url });
      } catch {
        // User dismissed the share sheet — not an error.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — leave the button as-is.
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-live="polite"
      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-border px-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {copied ? (
        <Check size={18} aria-hidden="true" className="text-signal" />
      ) : (
        <Share2 size={18} aria-hidden="true" />
      )}
      {copied ? "پیوند کپی شد" : "اشتراک‌گذاری"}
    </button>
  );
}
