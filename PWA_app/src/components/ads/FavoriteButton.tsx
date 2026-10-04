"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({ adId, label }: { adId: string; label?: string }) {
  const { isFavorite, toggle } = useFavorites();
  const favorite = isFavorite(adId);

  return (
    <button
      type="button"
      aria-label={favorite ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
      aria-pressed={favorite}
      onClick={() => toggle(adId)}
      className={cn(
        "flex h-11 items-center justify-center gap-2 rounded-lg border border-border px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
        favorite ? "border-primary/40 text-primary" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Heart size={18} aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
      {label ?? "علاقه‌مندی"}
    </button>
  );
}
