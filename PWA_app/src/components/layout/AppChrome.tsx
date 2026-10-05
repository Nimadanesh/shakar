"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { BottomTabBar } from "@/components/layout/BottomTabBar";

/** Routes that own the full viewport (no header, no tab bar). */
const CHROMELESS_PREFIXES = ["/onboarding", "/auth"];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
    </>
  );
}
