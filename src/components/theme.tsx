"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-script";
import { cx } from "@/lib/utils";

export type ThemePreference = "light" | "dark" | "system";

const listeners = new Set<() => void>();
const systemQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function applyTheme(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && systemQuery().matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribePreference(callback: () => void) {
  listeners.add(callback);
  const query = systemQuery();
  const onSystemChange = () => {
    if (readPreference() === "system") applyTheme("system");
  };
  query.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(callback);
    query.removeEventListener("change", onSystemChange);
  };
}

export function setTheme(pref: ThemePreference) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // storage unavailable (private mode): still apply for this page view
  }
  applyTheme(pref);
  listeners.forEach((listener) => listener());
}

export function useThemePreference() {
  return useSyncExternalStore(subscribePreference, readPreference, () => "system" as const);
}

function subscribeDarkClass(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

/** True while the dark theme is active (for charts that need concrete colors). */
export function useIsDark() {
  return useSyncExternalStore(
    subscribeDarkClass,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

const LABELS: Record<ThemePreference, string> = { light: "Light", dark: "Dark", system: "System" };
const NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };

export function ThemeToggle({ className }: { className?: string }) {
  const pref = useThemePreference();
  const next = NEXT[pref];
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABELS[pref]}. Switch to ${LABELS[next].toLowerCase()}.`}
      className={cx("text-sm", className)}
    >
      Theme: {LABELS[pref]}
    </button>
  );
}
