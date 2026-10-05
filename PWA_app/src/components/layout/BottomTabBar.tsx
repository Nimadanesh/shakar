"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Crosshair, LayoutGrid, TrendingUp, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "آگهی‌ها", icon: LayoutGrid },
  { href: "/saved", label: "شکار من", icon: Crosshair },
  { href: "/discover", label: "کشف بازار", icon: TrendingUp },
  { href: "/profile", label: "پروفایل", icon: User },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="ناوبری اصلی"
      className="fixed inset-x-0 bottom-0 z-40 px-4"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto grid w-full max-w-screen-sm grid-cols-4 gap-1 rounded-2xl border border-border bg-secondary/70 p-1.5 shadow-[0_8px_32px_rgb(0_0_0/0.45)] backdrop-blur-xl">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] leading-4 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-ring active:scale-95",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
