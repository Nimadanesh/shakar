"use client";

import { useEffect, useState } from "react";
import { OptionSheet } from "@/components/search/OptionSheet";
import { CITIES } from "@/data/taxonomy";
import { getHomeCity, setHomeCity } from "@/lib/home-city";
import { isOnboarded } from "@/lib/first-run";

const DISMISSED_KEY = "shekaar-home-city-dismissed";

/**
 * First-run home-city prompt (navid 2026-10-08): a calm bottom sheet on the
 * home page asking the new user where they live, so hunts default to their
 * city. Shows ONCE — only when onboarded, no home city set, never dismissed.
 * Never traps: «فعلاً نه» dismisses forever, and every close path persists.
 */
export function HomeCityPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!isOnboarded()) return;
      if (getHomeCity() !== null) return;
      if (window.localStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      return;
    }
    // Let the home form paint first — the prompt arrives calmly, not
    // as a gate.
    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore — worst case the prompt shows once more
    }
    setOpen(false);
  }

  function pick(cityId: string) {
    if (cityId !== "all") {
      setHomeCity(cityId);
      // The home form is already mounted with the old (empty) default —
      // tell it to re-seed so the user's first hunt really runs at home.
      window.dispatchEvent(
        new CustomEvent<string>("shekaar:home-city-changed", { detail: cityId })
      );
    }
    dismiss();
  }

  if (!open) return null;

  return (
    <OptionSheet
      open={open}
      title="شهرت کجاست؟"
      subtitle="شکارها رو پیش‌فرض توی شهر خودت می‌گردم. برای هر شکار می‌تونی شهر رو عوض کنی."
      options={CITIES}
      selected="all"
      onSelect={pick}
      onClose={dismiss}
      searchable
      searchPlaceholder="جستجوی شهر…"
      footer={
        <button
          type="button"
          onClick={dismiss}
          className="flex min-h-11 w-full items-center justify-center rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          فعلاً نه
        </button>
      }
    />
  );
}
