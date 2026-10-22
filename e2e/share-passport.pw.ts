import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Flight Passport share overlay. Pressing Share on Passport generates the
 * full-resolution PNG locally (Canvas 2D) and shows it in place as a real
 * <img> backed by a Blob URL. Every PNG here is read back from that <img>'s
 * own Blob URL and decoded (signature, IHDR, createImageBitmap, pixels).
 */

type Appearance = "light" | "dark" | "system";
const fixtureUrl = new URL(
  "./fixtures/share-poster.keepraw-fly.json",
  import.meta.url,
);
/** Every airport code in the fixture (and the dense archive); none may ever
 * be drawn. */
const FIXTURE_CODES = [
  ...new Set([
    ...(
      JSON.parse(readFileSync(fixtureUrl, "utf8")).flights as Array<{
        origin: { iata: string };
        destination: { iata: string };
      }>
    ).flatMap((flight) => [flight.origin.iata, flight.destination.iata]),
    "AMS",
    "YVR",
    "GRU",
  ]),
];
// Optional: copy the generated passports somewhere reviewable.
const artifactDir = process.env.SHARE_PASSPORT_ARTIFACTS;

async function loadArchive() {
  return JSON.parse(await readFile(fixtureUrl, "utf8"));
}

async function seed(
  page: Page,
  archive: unknown,
  options: {
    language?: string;
    appearance?: Appearance;
    distanceUnit?: "miles" | "kilometers";
  } = {},
) {
  await page.goto("/");
  await expect(page.locator(".loading-screen")).toHaveCount(0);
  await expect(
    page.locator(".site-header, input[type=file]").first(),
  ).toBeAttached();
  await page.evaluate(
    async ({ archive, language, appearance, distanceUnit }) => {
      const modulePath = "/src/storage/browser.ts";
      const { browserStorage } = await import(/* @vite-ignore */ modulePath);
      await browserStorage.saveDocument(archive, "personal");
      await browserStorage.saveSettings({
        language,
        appearance,
        distanceUnit,
        timeFormat: "24-hour",
        powerUserMode: false,
        solarMode: "fixed",
      });
    },
    {
      archive,
      language: options.language ?? "en-US",
      appearance: options.appearance ?? "light",
      distanceUnit: options.distanceUnit ?? "kilometers",
    },
  );
  // Storage is read on start-up; reload so the app opens the seeded archive.
  await page.reload();
}

interface ShareLog {
  contexts: string[];
  text: string[];
  created: string[];
  revoked: string[];
}

interface PosterTextDraw {
  text: string;
  x: number;
  y: number;
  maxWidth: number | null;
  font: string;
  spacing: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  direction: CanvasDirection;
  fill: string;
  alpha: number;
  composite: GlobalCompositeOperation;
  transform: number[];
  advance: number;
  bounds: { x: number; y: number; width: number; height: number };
}

interface PosterPaint {
  width: number;
  height: number;
  texts: PosterTextDraw[];
}

/** Capture the text on the actual canvas passed to PNG encoding. TextMetrics
 * ink bounds can change with font hinting; draw positions and advances cannot. */
async function recordPosterPaint(page: Page) {
  await page.addInitScript(() => {
    const paints: PosterPaint[] = [];
    (window as unknown as { __posterPaints: PosterPaint[] }).__posterPaints =
      paints;
    const texts = new WeakMap<HTMLCanvasElement, PosterTextDraw[]>();
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (
      text,
      x,
      y,
      ...rest
    ) {
      const metrics = this.measureText(text);
      const list = texts.get(this.canvas) ?? [];
      const { a, b, c, d, e, f } = this.getTransform();
      list.push({
        text: String(text),
        x,
        y,
        maxWidth: rest[0] ?? null,
        font: this.font,
        spacing: this.letterSpacing,
        align: this.textAlign,
        baseline: this.textBaseline,
        direction: this.direction,
        fill: String(this.fillStyle),
        alpha: this.globalAlpha,
        composite: this.globalCompositeOperation,
        transform: [a, b, c, d, e, f],
        advance: metrics.width,
        bounds: {
          x: x - metrics.actualBoundingBoxLeft,
          y: y - metrics.actualBoundingBoxAscent,
          width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
          height:
            metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
        },
      });
      texts.set(this.canvas, list);
      return Reflect.apply(fillText, this, [text, x, y, ...rest]);
    };
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
      paints.push({
        width: this.width,
        height: this.height,
        texts: [...(texts.get(this) ?? [])],
      });
      return Reflect.apply(toBlob, this, [callback, ...rest]);
    };
  });
}

/** Records Canvas work, drawn text and Blob URLs from the first script on. */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const log = {
      contexts: [] as string[],
      text: [] as string[],
      created: [] as string[],
      revoked: [] as string[],
    };
    (window as unknown as { __share: typeof log }).__share = log;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      // Detached canvases are the export canvas; attached ones belong to
      // Passport. The share image must never be a canvas on the page.
      log.contexts.push(`${this.isConnected ? "page" : "export"}:${type}`);
      // The Passport Globe is covered elsewhere; keep this suite on 2D only.
      if (type === "webgl2" || type === "webgl") return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      log.text.push(String(text));
      return Reflect.apply(fillText, this, [text, ...rest]);
    } as typeof fillText;
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (object: Blob | MediaSource) => {
      const url = create(object);
      log.created.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => {
      log.revoked.push(url);
      revoke(url);
    };
  });
}

async function readLog(page: Page): Promise<ShareLog> {
  return page.evaluate(
    () => (window as unknown as { __share: ShareLog }).__share,
  );
}

async function resetLog(page: Page) {
  await page.evaluate(() => {
    const log = (window as unknown as { __share: ShareLog }).__share;
    for (const list of Object.values(log)) list.length = 0;
  });
}

const dialog = (page: Page) => page.getByRole("dialog");
const image = (page: Page) => page.locator(".share-overlay-image");

/** Press Share on Passport and wait for the finished image. */
async function openShare(page: Page) {
  if (!/#passport$/.test(page.url())) await page.goto("/#passport");
  const before = new URL(page.url()).hash;
  await page.locator(".passport-share-button").click();
  await expect(dialog(page)).toBeVisible();
  // Encoding a full-resolution PNG can take a few seconds on CI machines.
  await expect(image(page)).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(() =>
      image(page).evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);
  // Still on Passport: no navigation and no hash change.
  expect(new URL(page.url()).hash).toBe(before);
}

interface Decoded {
  src: string;
  tag: string;
  natural: { width: number; height: number };
  box: { width: number; height: number; x: number; y: number };
  viewport: { width: number; height: number };
  ihdr: { width: number; height: number };
  type: string;
  opaque: boolean;
  std: number;
  colors: number;
  corner: [number, number, number];
  inkRows: number;
}

/** Reads the PNG from the <img>'s own Blob URL and decodes it in the page. */
async function decodeImage(page: Page) {
  const result = await image(page).evaluate(async (img: HTMLImageElement) => {
    const response = await fetch(img.src);
    const blob = await response.blob();
    const data = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(data.buffer);
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!signature.every((value, index) => data[index] === value))
      throw new Error("bad PNG signature");
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let sum = 0,
      squares = 0,
      opaque = true;
    const colors = new Set<number>();
    const rows = new Set<number>();
    const corner = [pixels.data[0]!, pixels.data[1]!, pixels.data[2]!] as [
      number,
      number,
      number,
    ];
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i]!,
        g = pixels.data[i + 1]!,
        b = pixels.data[i + 2]!;
      if (pixels.data[i + 3] !== 255) opaque = false;
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += luma;
      squares += luma * luma;
      if (i % 16 === 0) colors.add((r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3));
      const dist =
        Math.abs(r - corner[0]) +
        Math.abs(g - corner[1]) +
        Math.abs(b - corner[2]);
      if (dist > 120) rows.add(Math.floor(i / 4 / bitmap.width));
    }
    const count = pixels.data.length / 4;
    const mean = sum / count;
    const rect = img.getBoundingClientRect();
    const hex = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", data)),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    bitmap.close();
    return {
      decoded: {
        src: img.src,
        tag: img.tagName,
        natural: { width: img.naturalWidth, height: img.naturalHeight },
        box: { width: rect.width, height: rect.height, x: rect.x, y: rect.y },
        viewport: { width: innerWidth, height: innerHeight },
        ihdr: { width: view.getUint32(16), height: view.getUint32(20) },
        type: blob.type,
        opaque,
        std: Math.sqrt(squares / count - mean * mean),
        colors: colors.size,
        corner,
        inkRows: rows.size,
      },
      bytes: Array.from(data),
      hash: hex,
    };
  });
  return {
    decoded: result.decoded as Decoded,
    bytes: Buffer.from(result.bytes),
    hash: result.hash,
  };
}

async function keep(testInfo: TestInfo, name: string, bytes: Buffer) {
  await writeFile(testInfo.outputPath(name), bytes);
  if (artifactDir) {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(path.join(artifactDir, name), bytes);
  }
}

/** Both independent leaves, their binding and cover survive PNG encoding. */
function expectPassport(decoded: Decoded) {
  expect(decoded.tag).toBe("IMG");
  expect(decoded.src).toMatch(/^blob:/);
  expect(decoded.type).toBe("image/png");
  expect(decoded.ihdr).toEqual({ width: 1200, height: 1600 });
  expect(decoded.natural).toEqual(decoded.ihdr);
  expect(decoded.opaque).toBe(true);
  expect(decoded.std).toBeGreaterThan(12);
  expect(decoded.colors).toBeGreaterThan(40);
  expect(decoded.inkRows).toBeGreaterThan(800);
  expect(decoded.box.width / decoded.box.height).toBeCloseTo(0.75, 2);
  expect(decoded.box.x).toBeGreaterThanOrEqual(0);
  expect(decoded.box.x + decoded.box.width).toBeLessThanOrEqual(
    decoded.viewport.width + 0.5,
  );
}

function expectNoPrivateFields(drawn: string[]) {
  const text = drawn.join("\n");
  for (const code of FIXTURE_CODES)
    expect(text).not.toMatch(new RegExp(`\\b${code}\\b`));
  expect(text).not.toMatch(/\b[A-Z]{2}\d{3,4}\b/);
  expect(text).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
}

test.beforeEach(async ({ page }) => {
  await instrument(page);
});

test("opened book uses actual archive totals and stays local @cross-browser", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, await loadArchive());
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await openShare(page);
  await expect(dialog(page)).toHaveAttribute("data-layout", "top-bottom");
  await expect(dialog(page)).toHaveAccessibleName("Flight Passport");
  await expect(image(page)).toHaveAttribute("data-map-routes", "49");
  await expect(image(page)).toHaveAttribute("data-map-airports", "19");
  await expect(image(page)).toHaveAttribute("data-truncated", "0");
  const result = await decodeImage(page);
  expectPassport(result.decoded);
  await keep(testInfo, "flight-passport-book.png", result.bytes);
  const drawn = (await readLog(page)).text;
  expectNoPrivateFields(drawn);
  expect(drawn).toEqual(
    expect.arrayContaining([
      "FLIGHT RECORD",
      "FLIGHT PASSPORT",
      "HOLDER NAME",
      "TRAVELLER",
      "PASSPORT NO.",
      "DOCUMENT TYPE",
      "ISSUING STATE",
      "ISSUING AUTHORITY",
      "FIRST FLIGHT",
      "RECORD PERIOD",
      "571474",
      "91",
      "768",
      "20",
      "8",
      "12",
      "50",
      "DIGITAL TRAVEL JOURNAL",
    ]),
  );
  expect(drawn.some((text) => /^KRF-[A-F0-9]{16}$/.test(text))).toBe(true);
  expect(writes).toEqual([]);
});

test("nickname and random souvenir number survive reopening and reload without changing flights", async ({
  page,
}) => {
  await seed(page, await loadArchive());
  await openShare(page);
  const before = await page.evaluate(async () => {
    const { browserStorage } = await import(
      /* @vite-ignore */ "/src/storage/browser.ts"
    );
    return {
      archive: JSON.stringify(await browserStorage.loadDocument()),
      profile: JSON.parse(
        localStorage.getItem("keepraw-fly.passport-profile.v1")!,
      ),
    };
  });
  const oldUrl = await image(page).getAttribute("src");
  await page.getByRole("button", { name: "Edit name" }).click();
  await expect(page.getByLabel("Holder name / travel nickname")).toBeFocused();
  await page
    .getByLabel("Holder name / travel nickname")
    .fill("云间漫游 / KEEPRAW");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(image(page)).toBeVisible();
  await expect(image(page)).not.toHaveAttribute("src", oldUrl!);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("keepraw-fly.passport-profile.v1")!),
  );
  expect(saved).toEqual({
    name: "云间漫游 / KEEPRAW",
    number: before.profile.number,
  });
  expect((await readLog(page)).text).toContain(saved.name);
  expect((await readLog(page)).revoked).toContain(oldUrl);
  await page.keyboard.press("Escape");
  await expect(page.locator(".passport-share-button")).toBeFocused();
  await openShare(page);
  expect((await readLog(page)).text).toContain(saved.name);
  await page.reload();
  await openShare(page);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("keepraw-fly.passport-profile.v1")!),
    ),
  ).toEqual(saved);
  const after = await page.evaluate(async () => {
    const { browserStorage } = await import(
      /* @vite-ignore */ "/src/storage/browser.ts"
    );
    return JSON.stringify(await browserStorage.loadDocument());
  });
  expect(after).toBe(before.archive);
});

test("native save, focus trap, backdrop close and Blob lifetime remain intact @cross-browser", async ({
  page,
}) => {
  await seed(page, await loadArchive());
  await openShare(page);
  const src = await image(page).getAttribute("src");
  const prevented = await image(page).evaluate((img) =>
    ["contextmenu", "touchstart", "pointerdown", "dragstart"].map((type) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      img.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  );
  expect(prevented).toEqual([false, false, false, false]);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Edit name" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  expect((await readLog(page)).revoked).not.toContain(src);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect((await readLog(page)).revoked).toContain(src);
  expect(
    await page.evaluate(
      (url) =>
        fetch(url!).then(
          () => true,
          () => false,
        ),
      src,
    ),
  ).toBe(false);
  await openShare(page);
  await page.mouse.click(2, 2);
  await expect(dialog(page)).toHaveCount(0);
  expect((await readLog(page)).created.length).toBe(
    (await readLog(page)).revoked.length,
  );
});

test("full archive is used even with year and search filters", async ({
  page,
}) => {
  await seed(page, await loadArchive());
  await page.goto("/#passport");
  await page.getByRole("button", { name: "2023", exact: true }).click();
  await page.locator("#passport-flight-search").fill("SFO");
  await openShare(page);
  await expect(image(page)).toHaveAttribute("data-map-routes", "49");
  expect((await readLog(page)).text).toContain("91");
  await page.keyboard.press("Escape");
  await expect(page.locator("#passport-flight-search")).toHaveValue("SFO");
});

for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 761, height: 900 },
  { width: 760, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 844, height: 390 },
])
  test(`whole book and name editor fit ${viewport.width}×${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await seed(page, await loadArchive(), { appearance: "dark" });
    await openShare(page);
    expectPassport((await decodeImage(page)).decoded);
    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    );
    expect(fits).toBe(true);
    await page.getByRole("button", { name: "Edit name" }).click();
    await expect(
      page.getByLabel("Holder name / travel nickname"),
    ).toBeInViewport();
    await page.getByLabel("Holder name / travel nickname").fill("Keepraw");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(image(page)).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`book-${viewport.width}.png`),
      fullPage: false,
    });
  });

test("all locales, units and long Unicode names render without overlaps or lost text", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/");
  const results = await page.evaluate(
    async (flights) => {
      const load = (path: string) => import(/* @vite-ignore */ path);
      const [data, copyModule, layoutModule, exporter, text, i18n] =
        await Promise.all([
          load("/src/share/poster-data.ts"),
          load("/src/share/poster-copy.ts"),
          load("/src/share/poster-layout.ts"),
          load("/src/share/poster-export.ts"),
          load("/src/share/share-text.ts"),
          load("/src/i18n.ts"),
        ]);
      const out = [];
      for (const language of [
        "en-US",
        "en-GB",
        "zh-CN",
        "zh-TW",
        "ja-JP",
        "ko-KR",
        "de-DE",
        "fr-FR",
        "es",
        "pt-BR",
      ]) {
        await i18n.changeUiLanguage(language);
        for (const unit of ["miles", "kilometers"]) {
          const name = language.startsWith("zh")
            ? "云间漫游者".repeat(6) + "飞行"
            : "W".repeat(32);
          const copy = copyModule.buildPosterCopy(
            data.buildPosterModel(flights),
            i18n.i18n.t.bind(i18n.i18n),
            language,
            unit,
            { name, number: "KRF-1234567890ABCDEF" },
          );
          const layout = layoutModule.createPosterLayout();
          const fonts = await text.prepareShareFonts(
            text.shareLocaleForLanguage(language),
            { sample: name + copy.title + copy.recordTitle + copy.disclaimer },
          );
          const canvas = document.createElement("canvas");
          const report = exporter.renderPosterToCanvas(
            canvas,
            { layout, copy, fonts },
            layout.width,
          );
          canvas.width = 0;
          out.push({ language, unit, report, copy, layout });
        }
      }
      return out;
    },
    (await loadArchive()).flights,
  );
  for (const { language, unit, report, copy, layout } of results) {
    const where = `${language} ${unit}`;
    expect(report.outside, where).toEqual([]);
    expect(report.truncated, where).toEqual([]);
    expect(report.map.routes).toBe(49);
    const texts = report.texts as Array<{
      text: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    expect(
      texts.filter((box) => box.y < layout.binding.y).map((box) => box.text),
    ).toContain("FLIGHT RECORD");
    expect(
      texts.filter((box) => box.y > layout.holderPage.y).map((box) => box.text),
    ).toContain("HOLDER NAME");
    for (let a = 0; a < texts.length; a++)
      for (let b = a + 1; b < texts.length; b++) {
        const p = texts[a]!,
          q = texts[b]!;
        expect(
          p.x < q.x + q.width - 1 &&
            q.x < p.x + p.width - 1 &&
            p.y < q.y + q.height - 1 &&
            q.y < p.y + p.height - 1,
          `${where}: ${p.text} / ${q.text}`,
        ).toBe(false);
      }
    const nameLines = texts
      .filter((box) => box.y > 1080 && box.y < 1190 && box.x < 800)
      .map((box) => box.text)
      .join("");
    expect(nameLines).toBe(copy.holder.name);
  }
});

test("an archive without non-cancelled flights explains instead of drawing", async ({
  page,
}) => {
  const archive = await loadArchive();
  archive.flights = archive.flights.map((flight: object) => ({
    ...flight,
    cancelled: true,
  }));
  await seed(page, archive);
  await page.goto("/#passport");
  await page.locator(".passport-share-button").click();
  await expect(dialog(page)).toHaveAttribute("data-status", "empty");
  await expect(image(page)).toHaveCount(0);
  await expect(page.getByRole("alert")).toContainText(
    "There are no completed flights",
  );
});

test("export errors can be retried without closing the book", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.toBlob;
    (window as unknown as { failPng: boolean }).failPng = true;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
      if ((window as unknown as { failPng: boolean }).failPng)
        return callback(null);
      return Reflect.apply(original, this, [callback, ...rest]);
    };
  });
  await seed(page, await loadArchive());
  await page.goto("/#passport");
  await page.locator(".passport-share-button").click();
  await expect(page.getByRole("alert")).toContainText(
    "The image could not be created.",
  );
  await page.evaluate(() => {
    (window as unknown as { failPng: boolean }).failPng = false;
  });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(image(page)).toBeVisible();
  expectPassport((await decodeImage(page)).decoded);
});

test("blocked local storage is reported and does not change the archive", async ({
  page,
}) => {
  await seed(page, await loadArchive());
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.goto("/#passport");
  await openShare(page);
  await expect(page.locator(".share-profile-warning")).toBeVisible();
  await page.getByRole("button", { name: "Edit name" }).click();
  await page.getByLabel("Holder name / travel nickname").fill("Test");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Local saving is unavailable",
  );
  await expect(page.getByLabel("Holder name / travel nickname")).toBeVisible();
});

test("DPR changes do not change the book layout or text drawing", async ({
  browser,
}) => {
  const paints: PosterPaint[] = [];
  for (const deviceScaleFactor of [1, 3]) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await instrument(page);
    await recordPosterPaint(page);
    await seed(page, await loadArchive());
    await page.evaluate(() =>
      localStorage.setItem(
        "keepraw-fly.passport-profile.v1",
        JSON.stringify({ name: "KEEPRAW", number: "KRF-1234567890ABCDEF" }),
      ),
    );
    await openShare(page);
    expectPassport((await decodeImage(page)).decoded);
    paints.push(
      await page.evaluate(() =>
        (
          window as unknown as { __posterPaints: PosterPaint[] }
        ).__posterPaints.at(-1)!,
      ),
    );
    await context.close();
  }
  const commands = (paint: PosterPaint) =>
    paint.texts.map(({ bounds, ...command }) => {
      void bounds;
      return command;
    });
  expect(commands(paints[1]!)).toEqual(commands(paints[0]!));
});

test("dense archives retain complete statistics while labelling the map selection", async ({
  page,
}) => {
  const archive = await loadArchive();
  const codes = [
    "PEK",
    "PVG",
    "CAN",
    "HKG",
    "NRT",
    "HND",
    "ICN",
    "SIN",
    "BKK",
    "DXB",
    "LHR",
    "CDG",
    "FRA",
    "AMS",
    "JFK",
    "SFO",
    "LAX",
    "SYD",
    "YVR",
    "GRU",
  ];
  archive.flights = codes.flatMap((from, i) =>
    codes.flatMap((to, j) =>
      j <= i
        ? []
        : [
            {
              ...archive.flights[0],
              id: `dense-${i}-${j}`,
              origin: { iata: from },
              destination: { iata: to },
              serviceDate: "2024-05-15",
              scheduledDeparture: "2024-05-15T08:00:00Z",
              scheduledArrival: "2024-05-15T14:00:00Z",
            },
          ],
    ),
  );
  await seed(page, archive);
  await openShare(page);
  await expect(image(page)).toHaveAttribute("data-map-routes", "60");
  await expect(image(page)).toHaveAttribute("data-truncated", "0");
  const drawn = (await readLog(page)).text;
  expectNoPrivateFields(drawn);
  expect(drawn).toContain("BUSIEST 60 OF 190 ROUTES SHOWN");
  expect(drawn).toContain("190");
});

test("Chinese journals and nicknames remain available when webfonts fail", async ({
  page,
}) => {
  await page.route(/misans-webfont/, (route) => route.abort());
  await seed(page, await loadArchive(), { language: "zh-CN" });
  await openShare(page);
  await expect(image(page)).toHaveAttribute("data-fonts", "fallback");
  await expect(page.locator(".share-overlay-hint")).toContainText("系统字体");
  expectPassport((await decodeImage(page)).decoded);
  expect((await readLog(page)).text).toContain("飞行足迹");
});
