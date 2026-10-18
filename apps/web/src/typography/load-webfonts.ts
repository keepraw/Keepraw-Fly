export const chineseWebfontVersion = "4.3.1";
const root = `https://cdn.jsdelivr.net/npm/misans-webfont@${chineseWebfontVersion}`;
const weights = ["regular", "medium", "semibold"] as const;

/**
 * Subresource Integrity for every stylesheet this module requests. Each value
 * is the SHA-384 of `<folder>/<prefix>-<weight>/result.min.css` inside the npm
 * tarball misans-webfont@4.3.1 (registry integrity sha512-lVU2j0sS0Ah/Djcq…),
 * cross-checked against jsDelivr and unpkg. Regenerate and verify with
 * `node scripts/verify-webfont-sri.mjs` when the pinned version changes.
 *
 * SRI covers these CSS files only. The WOFF2 subsets they reference are not
 * integrity-checked by the browser; they are constrained to the same pinned
 * package path and by the font-src CSP directive.
 */
export const chineseWebfontIntegrity: Readonly<Record<string, string>> = {
  "misans/misans-regular":
    "sha384-ADK+o9KNEnq2kFaphGmj32wc21qWh/80fTEGdzl28WNnvKyllvmPB8RFautzQC49",
  "misans/misans-medium":
    "sha384-kdYDxqHkZLeW1HEDUM7F8hfeOLQi8FCoPK1DqbbntYJGyzUCStAWh5gw8BO/vTxD",
  "misans/misans-semibold":
    "sha384-qRxF4pdgcnC7daNCBwogFhtspyCTCkAV7QXkBpMMSnkq99XsB6VtUsOHBJAAb/8C",
  "misans-tc/misanstc-regular":
    "sha384-0e4QpicMxVc4058vHMKKIdgQ+N6yEOtNkgyijaWtYnfB8VwURji+5LqBH3RYn31K",
  "misans-tc/misanstc-medium":
    "sha384-LStR3InXOx4qfmuh7Fq/wHdzUGAm2WF57GltUqJr9SkG18aIw5zaE1mTWbU4ShzT",
  "misans-tc/misanstc-semibold":
    "sha384-1hZQKpnbFFGg+RYnom9BkdHu3Yk7iZVD20rEejGra7jczOGnYhHO1xq6S+RfTC5u",
};

export interface ChineseWebfontStylesheet {
  key: string;
  href: string;
  integrity: string;
  family: "MiSans" | "MiSans TC";
  weight: "400" | "500" | "600";
}

/** The exact stylesheets (URL + SRI) a Chinese locale requests. */
export function chineseWebfontStylesheets(
  language: string,
): ChineseWebfontStylesheet[] {
  if (language !== "zh-CN" && language !== "zh-TW") return [];
  const traditional = language === "zh-TW";
  const folder = traditional ? "misans-tc" : "misans";
  const prefix = traditional ? "misanstc" : "misans";
  return weights.map((weight) => {
    const path = `${folder}/${prefix}-${weight}`;
    const integrity = chineseWebfontIntegrity[path];
    if (!integrity) throw new Error(`Missing SRI for ${path}`);
    return {
      key: `${language}-${weight}`,
      href: `${root}/${path}/result.min.css`,
      integrity,
      family: traditional ? "MiSans TC" : "MiSans",
      weight: ({ regular: "400", medium: "500", semibold: "600" } as const)[
        weight
      ],
    };
  });
}

/** Native, non-blocking stylesheets; unicode-range selects the needed WOFF2 subsets. */
export function loadChineseWebfonts(language: string, owner: Document): void {
  for (const stylesheet of chineseWebfontStylesheets(language)) {
    const { key, family } = stylesheet;
    const numericWeight = stylesheet.weight;
    if (owner.querySelector(`link[data-chinese-webfont="${key}"]`)) continue;
    const link = owner.createElement("link");
    link.rel = "stylesheet";
    // A modified stylesheet fails SRI: the browser refuses it, fires error,
    // and the UI keeps its system-font fallback stack.
    link.integrity = stylesheet.integrity;
    link.href = stylesheet.href;
    link.crossOrigin = "anonymous";
    link.referrerPolicy = "no-referrer";
    link.dataset.chineseWebfont = key;
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
