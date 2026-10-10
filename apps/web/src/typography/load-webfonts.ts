import type { Language } from "../storage/types";

export const chineseWebfontVersion = "4.3.1";
const root = `https://cdn.jsdelivr.net/npm/misans-webfont@${chineseWebfontVersion}`;
const weights = ["regular", "medium", "semibold"] as const;

/** Native, non-blocking stylesheets; unicode-range selects the needed WOFF2 subsets. */
export function loadChineseWebfonts(language: Language, owner: Document): void {
  if (language === "en") return;
  const traditional = language === "zh-TW";
  const folder = traditional ? "misans-tc" : "misans";
  const prefix = traditional ? "misanstc" : "misans";
  for (const weight of weights) {
    const key = `${language}-${weight}`;
    if (owner.querySelector(`link[data-chinese-webfont="${key}"]`)) continue;
    const link = owner.createElement("link");
    link.rel = "stylesheet";
    link.href = `${root}/${folder}/${prefix}-${weight}/result.min.css`;
    link.crossOrigin = "anonymous";
    link.referrerPolicy = "no-referrer";
    link.dataset.chineseWebfont = key;
    // Loading and failure are evidence for diagnostics, never app readiness gates.
    link.dataset.fontStatus = "loading";
    link.onload = () => {
      link.dataset.fontStatus = "loaded";
    };
    link.onerror = () => {
      link.dataset.fontStatus = "unavailable";
    };
    owner.head.append(link);
  }
}
