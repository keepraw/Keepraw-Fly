import { loadChineseWebfonts } from "../typography/load-webfonts";

/**
 * Canvas 2D typography for share images. Canvas never inherits DOM styles,
 * so every draw sets family, size, weight, alignment and baseline explicitly.
 * Families mirror design-system.css; nothing here adds a font source.
 */
export type ShareLocale = "en" | "zh-CN" | "zh-TW";

const LATIN = [
  '"Inter"',
  '"Segoe UI Variable Text"',
  '"Segoe UI"',
  "system-ui",
  "-apple-system",
  "BlinkMacSystemFont",
  '"Helvetica Neue"',
  "Arial",
];
const SYSTEM_SC = [
  '"PingFang SC"',
  '"Microsoft YaHei UI"',
  '"Microsoft YaHei"',
  '"Noto Sans CJK SC"',
  '"Source Han Sans SC"',
];
const SYSTEM_TC = [
  '"PingFang TC"',
  '"Microsoft JhengHei UI"',
  '"Microsoft JhengHei"',
  '"Noto Sans CJK TC"',
  '"Source Han Sans TC"',
];
const WEBFONT: Partial<Record<ShareLocale, string>> = {
  "zh-CN": "MiSans",
  "zh-TW": "MiSans TC",
};

/** The exact family list used for a locale, with or without its webfont. */
export function shareFontFamily(locale: ShareLocale, webfont: boolean) {
  const cjk =
    locale === "zh-CN" ? SYSTEM_SC : locale === "zh-TW" ? SYSTEM_TC : [];
  const named = webfont && WEBFONT[locale] ? [`"${WEBFONT[locale]}"`] : [];
  // Latin first so digits/Latin glyphs match the UI; CJK falls through.
  return [
    ...LATIN.slice(0, 3),
    ...named,
    ...cjk,
    ...LATIN.slice(3),
    "sans-serif",
  ].join(", ");
}

export interface ShareFonts {
  locale: ShareLocale;
  family: string;
  /** "webfont": the locale's webfont is loaded; "system": the locale has no
   * webfont; "fallback": it failed or timed out, so the deterministic system
   * stack is used and every measurement is taken against it. */
  status: "webfont" | "system" | "fallback";
}

export interface PrepareFontOptions {
  /** Upper bound for webfont loading; then the fallback stack is used. */
  timeoutMs?: number;
  /** Never request the webfont (deterministic fallback). */
  disableWebfont?: boolean;
  /** Text whose glyphs must be available (selects unicode-range subsets). */
  sample?: string;
  document?: Document;
}

const WEIGHTS = ["400", "500", "600"] as const;

/** The app's MiSans stylesheets register their faces only after `onload`
 * remaps them (load-webfonts.ts), so FontFaceSet.load() before that finds no
 * face. Wait until every stylesheet for the locale has loaded or failed. */
function stylesheetsSettled(owner: Document, locale: ShareLocale) {
  const links = [
    ...owner.querySelectorAll<HTMLLinkElement>(
      `link[data-chinese-webfont^="${locale}-"]`,
    ),
  ];
  return Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          const settled = () => link.dataset.fontStatus !== "loading";
          if (settled()) return resolve();
          const done = () => {
            // load-webfonts' own onload runs first; read its verdict next tick.
            setTimeout(resolve, 0);
          };
          link.addEventListener("load", done, { once: true });
          link.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

/** Wait for the fonts the share image actually uses, or fall back. */
export async function prepareShareFonts(
  locale: ShareLocale,
  options: PrepareFontOptions = {},
): Promise<ShareFonts> {
  const owner = options.document ?? document;
  const webfont = WEBFONT[locale];
  if (!webfont) {
    await owner.fonts.ready;
    return { locale, family: shareFontFamily(locale, false), status: "system" };
  }
  const fallback: ShareFonts = {
    locale,
    family: shareFontFamily(locale, false),
    status: "fallback",
  };
  if (options.disableWebfont) return fallback;
  loadChineseWebfonts(locale, owner);
  const sample =
    options.sample ?? (locale === "zh-TW" ? "飛行護照年度" : "飞行护照年度");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), options.timeoutMs ?? 6000);
  });
  try {
    const loaded = await Promise.race([
      stylesheetsSettled(owner, locale).then(() =>
        Promise.all(
          WEIGHTS.map((weight) =>
            owner.fonts.load(`${weight} 32px "${webfont}"`, sample),
          ),
        ),
      ),
      timeout,
    ]);
    if (loaded === "timeout" || loaded.some((faces) => faces.length === 0))
      return fallback;
    const ready = WEIGHTS.every((weight) =>
      owner.fonts.check(`${weight} 32px "${webfont}"`, sample),
    );
    return ready
      ? { locale, family: shareFontFamily(locale, true), status: "webfont" }
      : fallback;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

export interface ShareTextStyle {
  size: number;
  weight?: 400 | 500 | 600 | 700;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  letterSpacing?: number;
}

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Sets every text property explicitly; returns the CSS font shorthand. */
export function applyTextStyle(
  context: Context2D,
  fonts: Pick<ShareFonts, "family">,
  style: ShareTextStyle,
): string {
  const font = `${style.weight ?? 400} ${style.size}px ${fonts.family}`;
  context.font = font;
  context.fillStyle = style.color ?? "#ffffff";
  context.textAlign = style.align ?? "left";
  context.textBaseline = style.baseline ?? "alphabetic";
  context.direction = "ltr";
  if ("letterSpacing" in context)
    context.letterSpacing = `${style.letterSpacing ?? 0}px`;
  return font;
}

export type MeasureText = (text: string) => number;

const CJK =
  /[\u2E80-\u9FFF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF\u3000-\u303F]/u;
// Kinsoku subset for English, Simplified and Traditional Chinese: closing
// punctuation never starts a line, opening punctuation never ends one. ASCII
// " and ' are ambiguous (open or close, apostrophes) and stay with their word.
const OPENING = /^[（「『【〔〈《“‘([{]$/u;
const CLOSING = /^[），。、；：！？」』】〕〉》”’,.;:!?)\]}%]$/u;

const isOpening = (char: string) => OPENING.test(char);
const isClosing = (char: string) => CLOSING.test(char);

/**
 * Break units. Latin and digits break at spaces (each unit keeps its trailing
 * whitespace); every CJK character is its own unit; closing punctuation is
 * glued to the unit before it and opening punctuation to the unit after it,
 * so a break between units never strands either. Every character is kept, in
 * order.
 */
export function shareTextTokens(text: string): string[] {
  const tokens: string[] = [];
  let word = "";
  let opening = "";
  const pushWord = () => {
    if (word) tokens.push(word);
    word = "";
  };
  const attachToPrevious = (value: string) => {
    if (word) word += value;
    else if (tokens.length) tokens[tokens.length - 1] += value;
    else word = value;
  };
  for (const char of Array.from(text)) {
    if (/\s/u.test(char)) {
      word += opening + char;
      opening = "";
      pushWord();
    } else if (isOpening(char)) {
      pushWord();
      opening += char;
    } else if (isClosing(char)) {
      // An empty bracket pair stays together with what precedes it.
      attachToPrevious(opening + char);
      opening = "";
    } else if (CJK.test(char)) {
      pushWord();
      tokens.push(opening + char);
      opening = "";
    } else {
      word += opening + char;
      opening = "";
    }
  }
  if (opening) attachToPrevious(opening);
  pushWord();
  return tokens;
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** User-perceived characters, so a split never cuts a grapheme cluster. */
export function shareGraphemes(text: string): string[] {
  return segmenter
    ? Array.from(segmenter.segment(text), (part) => part.segment)
    : Array.from(text);
}

export interface WrapResult {
  lines: string[];
  truncated: boolean;
}

/**
 * Greedy wrapping against a real measurement function. Lines break between
 * tokens (see shareTextTokens); a token wider than `maxWidth`, wherever it
 * occurs, is split into graphemes. No line exceeds `maxWidth` unless a single
 * grapheme does. When the text needs more than `maxLines`, the last line ends
 * with an ellipsis.
 */
export function wrapShareText(
  text: string,
  measure: MeasureText,
  maxWidth: number,
  maxLines = Infinity,
  ellipsis = "…",
): WrapResult {
  const lines: string[] = [];
  let line = "";
  const fits = (value: string) => measure(value.trimEnd()) <= maxWidth;
  const breakLine = () => {
    lines.push(line.trimEnd());
    line = "";
  };
  /** Starts `token` on the current (empty) line, splitting it if needed. */
  const startToken = (token: string) => {
    if (fits(token)) {
      line = token;
      return;
    }
    for (const grapheme of shareGraphemes(token)) {
      if (!line || fits(line + grapheme)) {
        line += grapheme;
        continue;
      }
      // Inside a split, still keep opening punctuation off the line end and
      // closing punctuation off the line start when the width allows it.
      const kept = shareGraphemes(line);
      const last = kept.at(-1)!;
      const carry =
        kept.length > 1 &&
        (isOpening(last) || isClosing(grapheme)) &&
        fits(last + grapheme);
      if (carry) line = kept.slice(0, -1).join("");
      breakLine();
      line = (carry ? last : "") + grapheme;
    }
  };
  const pushToken = (token: string) => {
    if (!line) startToken(token);
    else if (fits(line + token)) line += token;
    else {
      breakLine();
      startToken(token.trimStart());
    }
  };
  for (const paragraph of text.split("\n")) {
    for (const token of shareTextTokens(paragraph)) pushToken(token);
    breakLine();
  }
  if (lines.length <= maxLines) return { lines, truncated: false };
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1] ?? "";
  while (last && measure(last + ellipsis) > maxWidth)
    last = shareGraphemes(last).slice(0, -1).join("");
  kept[maxLines - 1] = last.trimEnd() + ellipsis;
  return { lines: kept, truncated: true };
}

/** Wraps and draws a block; returns the lines and the block height. */
export function drawShareTextBlock(
  context: Context2D,
  fonts: Pick<ShareFonts, "family">,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  style: ShareTextStyle & { lineHeight?: number; maxLines?: number },
) {
  applyTextStyle(context, fonts, style);
  const lineHeight = style.lineHeight ?? Math.round(style.size * 1.25);
  const result = wrapShareText(
    text,
    (value) => context.measureText(value).width,
    maxWidth,
    style.maxLines,
  );
  result.lines.forEach((value, index) =>
    context.fillText(value, x, y + index * lineHeight),
  );
  return { ...result, height: result.lines.length * lineHeight };
}
