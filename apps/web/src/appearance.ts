import type { Appearance } from "./storage/types";

// The head script restores this cosmetic hint before CSS/React can paint.
// IndexedDB remains the source of truth for viewer preferences.
export function initialAppearance(): Appearance {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : "system";
}

export function applyAppearance(appearance: Appearance) {
  if (appearance === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = appearance;
  try {
    if (appearance === "system")
      localStorage.removeItem("keepraw-fly-appearance");
    else localStorage.setItem("keepraw-fly-appearance", appearance);
  } catch {
    // A blocked cosmetic cache must not prevent loading or changing preferences.
  }
}

export type ResolvedAppearance = "light" | "dark";

/**
 * The theme actually on screen. "system" follows the operating system's
 * prefers-color-scheme, the same media query the stylesheets use, so callers
 * never treat the literal "system" as light or dark.
 */
export function resolveAppearance(
  appearance: Appearance,
  matchMedia:
    ((query: string) => { matches: boolean }) | undefined = typeof window ===
  "undefined"
    ? undefined
    : window.matchMedia?.bind(window),
): ResolvedAppearance {
  if (appearance === "light" || appearance === "dark") return appearance;
  return matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
