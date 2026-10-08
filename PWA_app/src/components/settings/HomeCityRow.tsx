"use client";

import { useState } from "react";
import { Check, MapPin } from "lucide-react";
import { OptionSheet } from "@/components/search/OptionSheet";
import { CITIES, cityLabel } from "@/data/taxonomy";
import { getHomeCity, setHomeCity } from "@/lib/home-city";

/**
 * «شهر من» — the home city (navid 2026-10-08, two-location model). This is
 * the standing default every hunt seeds from; changing the city inside a
 * hunt never rewrites it. Device-local for now; server sync is queued on
 * the profile-sync slice.
 */
export function HomeCityRow() {
  const [home, setHome] = useState<string | null>(() => getHomeCity());
  const [open, setOpen] = useState(false);

  function pick(cityId: string) {
    setHomeCity(cityId);
    setHome(getHomeCity());
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-border px-4 text-sm transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <MapPin size={16} aria-hidden="true" />
          شهر من
        </span>
        <span className="flex items-center gap-1.5 text-foreground">
          {home !== null ? cityLabel(home) : "ثبت نشده"}
          {home !== null && (
            <Check size={14} aria-hidden="true" className="text-muted-foreground" />
          )}
        </span>
      </button>
      <p className="-mt-1 px-1 text-[12px] leading-5 text-muted-foreground">
        شکارها پیش‌فرض توی این شهر انجام می‌شن؛ برای هر شکار می‌تونی عوضش کنی.
      </p>
      <OptionSheet
        open={open}
        title="شهر من"
        subtitle="شهری که توش زندگی می‌کنی — شکارها پیش‌فرض اینجا انجام می‌شن."
        options={CITIES}
        selected={home ?? "all"}
        onSelect={pick}
        onClose={() => setOpen(false)}
        searchable
        searchPlaceholder="جستجوی شهر…"
      />
    </>
  );
}
