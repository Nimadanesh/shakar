"use client";

import { useRouter } from "next/navigation";
import { useFavorites } from "@/hooks/useFavorites";
import { requireAuth } from "@/lib/auth";

/**
 * Favorites with the auth gate. Guests hunting fully is fine, but
 * favoriting is a persistent action: without a session the user is
 * routed to /auth with the exact action stored for resume.
 *
 * Task continuity (navid 2026-10-08): the gate records where the user
 * was (page + scroll) so that after OTP they land back in the exact
 * spot — mid-hunt-review — with the favorite applied. Losing the hunt
 * context here is what used to bounce new users.
 * Drop-in replacement for useFavorites where gating applies.
 */
export function useGatedFavorites() {
  const router = useRouter();
  const { isFavorite, toggle } = useFavorites();

  function guardedToggle(adId: string) {
    const here =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/";
    if (
      !requireAuth({ type: "favorite", adId }, (url) => router.push(url), here, {
        scrollY: typeof window !== "undefined" ? window.scrollY : 0,
        pendingFavorite: adId,
      })
    )
      return;
    toggle(adId);
  }

  return { isFavorite, toggle: guardedToggle };
}
