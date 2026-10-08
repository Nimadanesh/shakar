"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { ActiveHuntChip } from "@/components/search/ActiveHuntChip";
import { useProfileSync } from "@/hooks/useProfileSync";
import { warmUsage } from "@/lib/usage";

/** Routes that own the full viewport (no header, no tab bar). */
const CHROMELESS_PREFIXES = ["/onboarding", "/auth"];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Profile sync: when logged in, pull server favorites/history/saved hunts
  // and merge into the local stores (the profile IS the phone number).
  useProfileSync();
  // Quota warm: the «شکار کن» button's enabled state comes from the server.
  // Starting the fetch here (every page) means the value is usually
  // resolved before any hunt form renders — the button never flashes
  // enabled-then-disabled for an exhausted quota (navid 2026-10-08).
  useEffect(() => {
    warmUsage();
  }, []);
  const chromeless = CHROMELESS_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  if (chromeless) {
    return (
      <div className="mx-auto flex w-full max-w-screen-sm flex-1 flex-col px-4">
        {children}
      </div>
    );
  }

  return (
    <>
      <Header />
      <div
        className="mx-auto flex w-full max-w-screen-sm flex-1 flex-col px-4"
        style={{ paddingBottom: "calc(6rem + env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
      <BottomTabBar />
      <ActiveHuntChip />
    </>
  );
}
