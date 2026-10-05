"use client";

import { useRouter } from "next/navigation";
import { useFavorites } from "@/hooks/useFavorites";
import { requireAuth } from "@/lib/auth";

/**
 * Favorites with the auth gate. Guests hunting fully is fine, but
 * favoriting is a persistent action: without a session the user is
 * routed to /auth with the exact action stored for resume.
 * Drop-in replacement for useFavorites where gating applies.
 */
export function useGatedFavorites() {
  const router = useRouter();
  const { isFavorite, toggle } = useFavorites();

  function guardedToggle(adId: string) {
    if (!requireAuth({ type: "favorite", adId }, (url) => router.push(url))) return;
    toggle(adId);
  }

  return { isFavorite, toggle: guardedToggle };
}
