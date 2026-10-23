import type { PosterCopy } from "./poster-copy";
import type { PrepareFontOptions, ShareLocale } from "./share-text";
import sources from "./fonts/sources.json";

export type PosterFontRole = "text" | "display" | "figures" | "mono" | "brand";
export interface PosterFonts {
  locale: ShareLocale;
  families: Record<PosterFontRole, string>;
  status: "webfont" | "fallback";
}

const latinFiles = import.meta.glob<string>("./fonts/*.woff2", {
  eager: true,
  query: "?url",
  import: "default",
});
const LATIN = {
  text: { name: "ibm-plex-sans", weight: 400, fallback: "Arial, sans-serif" },
  display: { name: "ibm-plex-serif", weight: 500, fallback: "Georgia, serif" },
  figures: { name: "ibm-plex-serif", weight: 400, fallback: "Georgia, serif" },
  mono: {
    name: "ibm-plex-mono",
    weight: 400,
    fallback: '"Liberation Mono", "Courier New", monospace',
  },
  brand: {
    name: "barlow-semi-condensed",
    weight: 600,
    fallback: "Arial, sans-serif",
  },
} as const;
const CJK_SYSTEM = {
  "zh-CN": {
    serif: '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", SimSun',
    sans: '"Source Han Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei"',
  },
  "zh-TW": {
    serif: '"Source Han Serif TC", "Noto Serif CJK TC", "Songti TC", PMingLiU',
    sans: '"Source Han Sans TC", "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei"',
  },
  "ja-JP": {
    serif:
      '"Source Han Serif", "Noto Serif CJK JP", "Yu Mincho", "Hiragino Mincho ProN"',
    sans: '"Source Han Sans", "Noto Sans CJK JP", "Yu Gothic", "Hiragino Sans"',
  },
  "ko-KR": {
    serif: '"Source Han Serif K", "Noto Serif CJK KR", "Batang"',
    sans: '"Source Han Sans K", "Noto Sans CJK KR", "Malgun Gothic"',
  },
} as const;
type CjkLocale = keyof typeof CJK_SYSTEM;
const HAN = /\p{Script=Han}/u;
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HANGUL = /\p{Script=Hangul}/u;

/** Only scripts actually present are requested. The UI locale selects Han forms;
 * a Latin UI with a native CJK name uses that name's script where identifiable. */
export function posterCjkLocales(
  locale: ShareLocale,
  sample: string,
): CjkLocale[] {
  const primary =
    locale !== "en"
      ? locale
      : KANA.test(sample)
        ? "ja-JP"
        : HANGUL.test(sample)
          ? "ko-KR"
          : "zh-CN";
  const locales: CjkLocale[] = [];
  if (HAN.test(sample) || KANA.test(sample) || HANGUL.test(sample))
    locales.push(primary);
  if (KANA.test(sample) && primary !== "ja-JP") locales.push("ja-JP");
  if (HANGUL.test(sample) && primary !== "ko-KR") locales.push("ko-KR");
  return locales;
}

/** Include actual values, uppercase labels and notes before any measurement. */
export function posterFontSample(copy: PosterCopy): string {
  const strings: string[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === "string") strings.push(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object")
      Object.values(value).forEach(collect);
  };
  collect({
    labels: [
      copy.labels.routeMap,
      copy.labels.profile,
      copy.labels.name,
      copy.labels.number,
      copy.labels.issuingAuthority,
      copy.labels.firstFlight,
      copy.labels.period,
    ],
    holder: copy.holder,
    title: copy.title,
    firstFlight: copy.firstFlight,
    recordPeriod: copy.recordPeriod,
    stats: [
      copy.distance,
      copy.flights,
      copy.duration,
      ...(copy.secondary ?? []),
      copy.routes,
    ],
    notes: copy.notes,
    mrz: copy.mrz,
    brand: "KEEPRAW FLY 01 / 02",
  });
  return [
    ...new Set([...strings.join(""), ...strings.join("").toLocaleUpperCase()]),
  ].join("");
}

const latinLoads = new WeakMap<Document, Map<string, Promise<boolean>>>();
function loadLatin(owner: Document, role: PosterFontRole) {
  let cache = latinLoads.get(owner);
  if (!cache) {
    cache = new Map();
    latinLoads.set(owner, cache);
  }
  const existing = cache.get(role);
  if (existing) return existing;
  const spec = LATIN[role];
  const promise = Promise.all(
    sources.latin
      .filter(
        (source) =>
          source.file.startsWith(`${spec.name}-`) &&
          source.file.includes(`-${spec.weight}-`),
      )
      .map(async (source) => {
        const url = latinFiles[`./fonts/${source.file}`];
        const face = new FontFace(`KRF ${role}`, `url("${url}")`, {
          weight: String(spec.weight),
          unicodeRange: source.unicodeRange,
        });
        await face.load();
        owner.fonts.add(face);
      }),
  ).then(
    () => true,
    () => false,
  );
  cache.set(role, promise);
  // Transient errors can be retried on the next export.
  void promise.then((ok) => {
    if (!ok) cache!.delete(role);
  });
  return promise;
}

/** A native SRI stylesheet keeps relative subset URLs and CSP enforcement.
 * Remap faces to a private passport family, leaving MiSans/UI rules untouched. */
function cjkStylesheet(
  owner: Document,
  source: (typeof sources.cjk)[number],
): Promise<boolean> {
  const key = `${source.locale}-${source.role}`;
  const previous = owner.querySelector<HTMLLinkElement>(
    `link[data-passport-font="${key}"]`,
  );
  if (previous?.dataset.fontStatus === "loaded") return Promise.resolve(true);
  if (previous?.dataset.fontStatus === "unavailable") previous.remove();
  return new Promise((resolve) => {
    const link = previous?.isConnected ? previous : owner.createElement("link");
    const finish = () => resolve(link.dataset.fontStatus === "loaded");
    if (previous?.isConnected) {
      link.addEventListener("load", finish, { once: true });
      link.addEventListener("error", finish, { once: true });
      return;
    }
    link.rel = "stylesheet";
    link.href = `https://cdn.jsdelivr.net/npm/${source.package}@${source.version}/${source.stylesheet}`;
    link.integrity = source.integrity;
    link.crossOrigin = "anonymous";
    link.referrerPolicy = "no-referrer";
    link.dataset.passportFont = key;
    link.dataset.fontStatus = "loading";
    link.onload = () => {
      try {
        const sheet = link.sheet;
        if (!sheet) throw new Error("Missing passport font stylesheet");
        let faces = 0;
        for (let index = 0; index < sheet.cssRules.length; index++) {
          const rule = sheet.cssRules[index];
          if (!rule || rule.type !== CSSRule.FONT_FACE_RULE) continue;
          const style = (rule as CSSFontFaceRule).style;
          sheet.insertRule(
            `@font-face { font-family: "KRF ${key}"; font-weight: ${source.weight}; font-style: normal; font-display: block; src: ${style.getPropertyValue("src")}; unicode-range: ${style.getPropertyValue("unicode-range")}; }`,
            index,
          );
          sheet.deleteRule(index + 1);
          faces++;
        }
        if (!faces) throw new Error("Empty passport font stylesheet");
        link.dataset.fontStatus = "loaded";
      } catch {
        link.dataset.fontStatus = "unavailable";
      }
      finish();
    };
    link.onerror = () => {
      link.dataset.fontStatus = "unavailable";
      finish();
    };
    owner.head.append(link);
  });
}

/** Every returned family is frozen to faces that finished loading. A timeout or
 * later successful download can never change a previously measured render. */
export async function preparePosterFonts(
  locale: ShareLocale,
  options: PrepareFontOptions & { copy?: PosterCopy } = {},
): Promise<PosterFonts> {
  const owner = options.document ?? document;
  const sample =
    (options.copy ? posterFontSample(options.copy) : options.sample) ??
    (locale === "zh-TW"
      ? "飛行護照"
      : locale === "zh-CN"
        ? "飞行护照"
        : "Flight Passport");
  const locales = posterCjkLocales(locale, sample);
  const roles = Object.keys(LATIN) as PosterFontRole[];
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const loaded = new Set<string>();
  if (!options.disableWebfont) {
    const work = [
      ...roles.map(async (role) => {
        if ((await loadLatin(owner, role)) && !expired) loaded.add(role);
      }),
      ...sources.cjk
        .filter((source) => locales.includes(source.locale as CjkLocale))
        .map(async (source) => {
          const key = `${source.locale}-${source.role}`;
          try {
            if (!(await cjkStylesheet(owner, source))) return;
            // Latin is served locally. Request only CJK subsets for this role.
            const roleSample =
              source.role === "serif" && options.copy
                ? options.copy.title + options.copy.holder.name
                : sample;
            const glyphs = [...roleSample]
              .filter((char) => /[^\u0000-\u024f]/u.test(char))
              .join("");
            const faces = await owner.fonts.load(
              `${source.weight} 32px "KRF ${key}"`,
              glyphs,
            );
            if (
              faces.length &&
              faces.every((face) => face.status === "loaded") &&
              !expired
            )
              loaded.add(key);
          } catch {
            // A failed subset needs fresh FontFace rules on a later retry.
            const link = owner.querySelector<HTMLLinkElement>(
              `link[data-passport-font="${key}"]`,
            );
            if (link) link.dataset.fontStatus = "unavailable";
            /* The explicit regional system stack remains usable. */
          }
        }),
    ];
    await Promise.race([
      Promise.all(work),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, options.timeoutMs ?? 6000);
      }),
    ]);
    expired = true;
    clearTimeout(timer);
  }
  const cjk = (role: "serif" | "sans") =>
    locales
      .map((language) =>
        [
          loaded.has(`${language}-${role}`) ? `"KRF ${language}-${role}"` : "",
          CJK_SYSTEM[language][role],
        ]
          .filter(Boolean)
          .join(", "),
      )
      .join(", ");
  const families = Object.fromEntries(
    roles.map((role) => {
      const regional =
        role === "text" ? cjk("sans") : role === "display" ? cjk("serif") : "";
      return [
        role,
        [
          loaded.has(role) ? `"KRF ${role}"` : "",
          regional,
          LATIN[role].fallback,
        ]
          .filter(Boolean)
          .join(", "),
      ];
    }),
  ) as Record<PosterFontRole, string>;
  return {
    locale,
    families,
    status:
      loaded.size === roles.length + locales.length * 2
        ? "webfont"
        : "fallback",
  };
}
