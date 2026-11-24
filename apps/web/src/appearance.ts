import {
  DEFAULT_SKIN_ID,
  resolveSkin,
  skinAppearance,
  skinHasAppearanceChoice,
  type SkinId,
} from "./skins/registry";
import type { Appearance } from "./storage/types";

const APPEARANCE_HINT_KEY = "keepraw-fly-appearance";
const SKIN_HINT_KEY = "keepraw-fly-skin";

// The head script restores these cosmetic hints before CSS/React can paint.
// IndexedDB remains the source of truth for viewer preferences.
export function initialAppearance(): Appearance {
  try {
    const hint = localStorage.getItem(APPEARANCE_HINT_KEY);
    if (hint === "light" || hint === "dark") return hint;
  } catch {
    // Without the cache the appearance follows the device until settings load.
  }
  return "system";
}

export function initialSkin(): SkinId {
  return resolveSkin(document.documentElement.dataset.skin).id as SkinId;
}

/**
 * Shows the skin in the requested appearance. A skin drawn in one appearance
 * fixes the theme; the request itself is still cached, so it returns when a
 * skin with a choice is selected again.
 */
export function applyAppearance(
  appearance: Appearance,
  skinId: SkinId = initialSkin(),
) {
  const skin = resolveSkin(skinId);
  const root = document.documentElement;
  root.dataset.skin = skin.id;
  if (!skinHasAppearanceChoice(skin))
    root.dataset.theme = skinAppearance(skin, resolveAppearance(appearance));
  else if (appearance === "system") delete root.dataset.theme;
  else root.dataset.theme = appearance;
  try {
    if (skin.id === DEFAULT_SKIN_ID) localStorage.removeItem(SKIN_HINT_KEY);
    else localStorage.setItem(SKIN_HINT_KEY, skin.id);
    if (appearance === "system") localStorage.removeItem(APPEARANCE_HINT_KEY);
    else localStorage.setItem(APPEARANCE_HINT_KEY, appearance);
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
