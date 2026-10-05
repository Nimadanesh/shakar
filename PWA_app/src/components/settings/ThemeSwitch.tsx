"use client";

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";

export const THEME_STORAGE_KEY = "shakar-theme";
export type ThemeName = "dark" | "light";

export function applyTheme(theme: ThemeName) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
}

function initialTheme(): ThemeName {
  if (typeof window === "undefined") return "dark";
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

/** Minimal dark/light toggle. Monochrome-safe: uses semantic tokens only. */
export function ThemeSwitch() {
  // Hydration-safe: the server always renders dark (matching <html>); the
  // stored theme lands after mount. The theme-init.js script already set
  // the correct class pre-paint, so there is no flash — and this component
  // must NOT write the theme on mount: the initial "dark" state is stale
  // until the stored value is read, and persisting it would clobber the
  // user's real choice (profile-page light→dark bug).
  const [theme, setTheme] = useState<ThemeName>("dark");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe init (see above)
    setTheme(initialTheme());
  }, []);

  function handleChange(checked: boolean) {
    const next: ThemeName = checked ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <Switch
      checked={theme === "light"}
      onChange={handleChange}
      label="تم روشن"
      hint="نسخه‌ی روشن و تیره‌ی رابط کاربری"
    />
  );
}
