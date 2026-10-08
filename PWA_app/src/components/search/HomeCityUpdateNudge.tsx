"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { cityLabel } from "@/data/taxonomy";
import { getHomeCity, setHomeCity } from "@/lib/home-city";
import type { HuntDefinition } from "@/lib/server/hunt/pipeline";

const NEVER_ASK_KEY = "shekaar-home-city-ask-never";

/**
 * Post-hunt home-city nudge (navid 2026-10-08, two-location model).
 *
 * The hunt ran in a city different from the home default — offer to update
 * the default. Calm by construction: an inline card (never a modal), one
 * question, and «دیگه نپرس» kills it forever so it never nags.
 */
function HomeCityUpdateNudge({ city }: { city: string }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;

  function accept() {
    setHomeCity(city);
    setGone(true);
  }

  function never() {
    try {
      window.localStorage.setItem(NEVER_ASK_KEY, "1");
    } catch {
      // ignore — worst case it asks once more
    }
    setGone(true);
  }

  return (
    <div className="mt-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        <MapPin size={15} aria-hidden="true" className="shrink-0" />
        این شکار رو توی {cityLabel(city)} زدی
      </p>
      <p className="mt-1 text-[13px] leading-6 text-zinc-500">
        {cityLabel(city)} بشه شهر پیش‌فرضت؟ شکارهای بعدی هم از اینجا شروع می‌شن.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={accept}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          بله، ثبت کن
        </button>
        <button
          type="button"
          onClick={() => setGone(true)}
          className="rounded-full px-4 py-2 text-sm text-zinc-500 transition-colors hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          نه
        </button>
        <button
          type="button"
          onClick={never}
          className="rounded-full px-2 py-2 text-[12px] text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-600 hover:underline dark:hover:text-zinc-300"
        >
          دیگه نپرس
        </button>
      </div>
    </div>
  );
}

/**
 * Gate: renders the nudge only when there is something worth asking —
 * a finished hunt that ran in a real city different from the home default.
 */
export function HomeCityUpdateGate({
  definition,
}: {
  definition: HuntDefinition | null;
}) {
  const [home] = useState<string | null>(() => getHomeCity());
  const [never] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(NEVER_ASK_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (
    never ||
    home === null ||
    definition === null ||
    definition.city === "all" ||
    definition.city === home
  ) {
    return null;
  }
  return <HomeCityUpdateNudge city={definition.city} />;
}
