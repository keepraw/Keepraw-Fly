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
