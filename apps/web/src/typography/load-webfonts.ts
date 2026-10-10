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
    const family = traditional ? "MiSans TC" : "MiSans";
    const numericWeight = { regular: "400", medium: "500", semibold: "600" }[
      weight
    ];
    link.dataset.fontFamily = family;
    link.dataset.fontWeight = numericWeight;
    // Loading and failure are evidence for diagnostics, never app readiness gates.
    link.dataset.fontStatus = "loading";
    link.onload = () => {
      try {
        // 4.3.1 publishes Medium/Semibold as separate families, all at weight 400.
        // Map CORS-readable native faces onto the UI family and true weights.
        // Replace complete rules: Firefox exposes read-only face descriptors.
        // Keeping the same native sheet preserves remote src and unicode-range.
        const sheet = link.sheet;
        if (!sheet) throw new Error("Font stylesheet is unavailable");
        for (let index = 0; index < sheet.cssRules.length; index += 1) {
          const rule = sheet.cssRules[index];
          if (!rule || rule.type !== CSSRule.FONT_FACE_RULE) continue;
          const face = rule as CSSFontFaceRule;
          if (
            face.style.fontFamily.replaceAll('"', "") === family &&
            face.style.fontWeight === numericWeight
          )
            continue;
          const mapped = face.cssText
            .replace(/font-family:\s*[^;]+;/, 'font-family: "' + family + '";')
            .replace(
              /font-weight:\s*[^;]+;/,
              "font-weight: " + numericWeight + ";",
            );
          sheet.insertRule(mapped, index);
          sheet.deleteRule(index + 1);
        }
        link.dataset.fontStatus = "loaded";
      } catch {
        link.dataset.fontStatus = "unavailable";
      }
    };
    link.onerror = () => {
      link.dataset.fontStatus = "unavailable";
    };
    owner.head.append(link);
  }
}
