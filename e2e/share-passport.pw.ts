import {
  expect,
  test,
  type Browser,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Flight Passport share overlay. Pressing Share on Passport generates the
 * full-resolution PNG locally (Canvas 2D) and shows it in place as a real
 * <img> backed by a Blob URL. Every PNG here is read back from that <img>'s
 * own Blob URL and decoded (signature, IHDR, createImageBitmap, pixels).
 */

type Aspect = "3:4" | "4:3";
type Appearance = "light" | "dark" | "system";
const SIZE: Record<Aspect, { width: number; height: number }> = {
  "3:4": { width: 1200, height: 1600 },
  "4:3": { width: 1600, height: 1200 },
};
const slug = (aspect: Aspect) => (aspect === "3:4" ? "3x4" : "4x3");
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
  await expect(page.locator('input[type="file"]')).toBeAttached();
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

const luminance = ([r, g, b]: [number, number, number]) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Checks the PNG and how the <img> shows it: whole, unstretched, on screen. */
function expectPassport(
  decoded: Decoded,
  aspect: Aspect,
  tone: "dark" | "light",
) {
  const { width, height } = SIZE[aspect];
  expect(decoded.tag).toBe("IMG");
  expect(decoded.src).toMatch(/^blob:/);
  expect(decoded.type).toBe("image/png");
  expect(decoded.ihdr).toEqual({ width, height });
  expect(decoded.natural).toEqual({ width, height });
  expect(decoded.opaque).toBe(true);
  // Neither blank nor a flat fill: real typography, the map and routes.
  expect(decoded.std).toBeGreaterThan(12);
  expect(decoded.colors).toBeGreaterThan(40);
  expect(decoded.inkRows).toBeGreaterThan(height * 0.25);
  // Displayed at the artboard's own ratio (never stretched) and fully
  // inside the viewport (never cropped or overflowing).
  expect(decoded.box.width / decoded.box.height).toBeCloseTo(width / height, 2);
  expect(decoded.box.x).toBeGreaterThanOrEqual(0);
  expect(decoded.box.y).toBeGreaterThanOrEqual(0);
  expect(decoded.box.x + decoded.box.width).toBeLessThanOrEqual(
    decoded.viewport.width + 0.5,
  );
  expect(decoded.box.y + decoded.box.height).toBeLessThanOrEqual(
    decoded.viewport.height + 0.5,
  );
  expect(decoded.box.width).toBeGreaterThan(decoded.viewport.width * 0.3);
  const [r, , b] = decoded.corner;
  if (tone === "dark") {
    expect(luminance(decoded.corner)).toBeLessThan(40); // deep navy
    expect(b).toBeGreaterThan(r);
  } else {
    expect(luminance(decoded.corner)).toBeGreaterThan(220); // ivory paper
  }
}

/** No airport code, flight number, exact date or personal field drawn. */
function expectNoIdentifiers(drawn: string[]) {
  const text = drawn.join("\n");
  expect(FIXTURE_CODES.length).toBeGreaterThan(10);
  for (const code of FIXTURE_CODES)
    expect(text).not.toMatch(new RegExp(`\\b${code}\\b`));
  expect(text).not.toMatch(/\b[A-Z]{2}\d{3,4}\b/); // flight numbers
  expect(text).not.toMatch(/\b20\d\d-\d\d-\d\d\b/); // exact dates
}

test.describe("Flight Passport share overlay", () => {
  test.beforeEach(async ({ page }) => {
    await instrument(page);
  });

  test("desktop: Share shows the passport image in place", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const requests: { method: string; url: string }[] = [];
    await seed(page, await loadArchive());
    page.on("request", (request) =>
      requests.push({ method: request.method(), url: request.url() }),
    );
    await page.goto("/#passport");
    await resetLog(page);
    await openShare(page);
    await expect(page).toHaveURL(/#passport$/);
    // Passport stays rendered underneath the overlay.
    await expect(page.locator(".passport-share-button")).toBeAttached();
    const view = dialog(page);
    await expect(view).toHaveAttribute("aria-modal", "true");
    await expect(view).toHaveAccessibleName("Flight Passport");
    await expect(view).toHaveAttribute("data-aspect", "4:3");
    await expect(view).toHaveAttribute("data-tone", "dark");
    // Only the close button: no templates, ranges, formats, privacy or
    // download controls, and no canvas preview.
    await expect(view.locator("button")).toHaveCount(1);
    await expect(view.getByRole("button", { name: "Close" })).toBeFocused();
    await expect(view.locator("input, select, canvas, a")).toHaveCount(0);
    await expect(page.locator("[class*='share-studio']")).toHaveCount(0);
    await expect(page.getByText("Year in Flight")).toHaveCount(0);

    const img = image(page);
    await expect(img).toHaveAttribute("data-map-routes", "49");
    await expect(img).toHaveAttribute("data-map-airports", "19");
    await expect(img).toHaveAttribute("data-truncated", "0");
    await expect(img).toHaveAttribute(
      "alt",
      "Flight Passport image, 1600 × 1200 pixels",
    );
    const result = await decodeImage(page);
    expectPassport(result.decoded, "4:3", "dark");
    await keep(testInfo, "flight-passport-4x3-dark.png", result.bytes);

    const log = await readLog(page);
    // The PNG comes from the detached export canvas, never from the page.
    expect(
      log.contexts.filter(
        (type) => type.endsWith(":2d") && type !== "export:2d",
      ),
    ).toEqual([]);
    const drawn = log.text;
    expectNoIdentifiers(drawn);
    const text = drawn.join("\n");
    expect(text).toContain("Keepraw Fly");
    // 4:3 sets the title over two lines.
    expect(drawn.join(" ")).toContain("FLIGHT PASSPORT");
    expect(text).toContain("Issued by Keepraw Fly");
    // Poster figures never use digit grouping (the app UI still does).
    expect(drawn).toContain("571474");
    expect(text).not.toMatch(/\d,\d{3}/);
    expect(text).toContain("ALL 49 ROUTES SHOWN");
    expect(text).toContain("2017 – 2025");
    expect(text).toContain("91"); // 92 records, one cancelled
    expect(text).toContain("Distance from 90 of 91 flights");
    expect(text).not.toMatch(/YEAR IN FLIGHT|Year in Flight/);
    // The old top-right stamp/badge repeated title and scope; it is gone:
    // the title is drawn once per export (React StrictMode may render a
    // discarded export in development) and no line names the scope alone.
    const exports = drawn.filter(
      (line) => line === "Issued by Keepraw Fly",
    ).length;
    expect(exports).toBeGreaterThanOrEqual(1);
    expect(drawn.filter((line) => /^FLIGHT( PASSPORT)?$/.test(line))).toEqual(
      Array(exports).fill("FLIGHT"),
    );
    expect(drawn.filter((line) => /PASSPORT ·|^LIFETIME$/.test(line))).toEqual(
      [],
    );
    expect(log.created).toHaveLength(1);
    expect(log.revoked).toEqual([]);

    // Everything stays local.
    expect(requests.filter((r) => r.method !== "GET")).toEqual([]);
    expect(
      requests.filter(
        (r) => !/^(http:\/\/(127\.0\.0\.1|localhost)|blob:|data:)/.test(r.url),
      ),
    ).toEqual([]);

    // Escape closes, focus returns to Share, and the Blob URL is released.
    const src = result.decoded.src;
    await page.keyboard.press("Escape");
    await expect(view).toHaveCount(0);
    await expect(page.locator(".passport-share-button")).toBeFocused();
    expect((await readLog(page)).revoked).toEqual([src]);
    const stillReadable = await page.evaluate(
      (url) =>
        fetch(url).then(
          () => true,
          () => false,
        ),
      src,
    );
    expect(stillReadable).toBe(false);
    await expect(page).toHaveURL(/#passport$/);
  });

  test("native image save is never intercepted", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seed(page, await loadArchive());
    await openShare(page);
    const probe = await image(page).evaluate((img: HTMLImageElement) => {
      const fire = (event: Event) => {
        img.dispatchEvent(event);
        return event.defaultPrevented;
      };
      const style = getComputedStyle(img);
      const touch =
        typeof TouchEvent === "undefined"
          ? false
          : fire(
              new TouchEvent("touchstart", { bubbles: true, cancelable: true }),
            );
      return {
        contextmenu: fire(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            button: 2,
          }),
        ),
        touch,
        pointer: fire(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerType: "touch",
          }),
        ),
        dragstart: fire(
          new DragEvent("dragstart", { bubbles: true, cancelable: true }),
        ),
        pointerEvents: style.pointerEvents,
        callout: style.getPropertyValue("-webkit-touch-callout"),
        draggable: img.draggable,
      };
    });
    expect(probe).toMatchObject({
      contextmenu: false,
      touch: false,
      pointer: false,
      dragstart: false,
      draggable: true,
    });
    expect(probe.pointerEvents).not.toBe("none");
    expect(probe.callout).not.toBe("none");
    // A secondary press on the image never closes the overlay.
    await image(page).click({ button: "right" });
    await page.keyboard.press("Shift"); // dismissal key for nothing
    await expect(dialog(page)).toBeVisible();
    // The keyboard stays inside the dialog.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator(".passport-share-button")).toBeFocused();
  });

  test("Blob URLs live exactly as long as their image", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seed(page, await loadArchive());
    await page.goto("/#passport");
    await resetLog(page);
    for (let round = 0; round < 3; round += 1) {
      await openShare(page);
      const src = await image(page).getAttribute("src");
      const log = await readLog(page);
      // Shown while loaded: not revoked early.
      expect(log.revoked).not.toContain(src);
      await page.getByRole("button", { name: "Close" }).click();
      await expect(dialog(page)).toHaveCount(0);
    }
    const log = await readLog(page);
    expect(log.created).toHaveLength(3);
    expect([...log.revoked].sort()).toEqual([...log.created].sort());
    // A backdrop press closes too and releases its URL.
    await openShare(page);
    await page.mouse.click(4, 4);
    await expect(dialog(page)).toHaveCount(0);
    const after = await readLog(page);
    expect(after.revoked).toHaveLength(4);
  });

  test("ignores Passport year, search and airport selection", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const archive = await loadArchive();
    await seed(page, archive);
    await page.goto("/#passport");
    await page.getByRole("button", { name: "2023", exact: true }).click();
    await page.locator("#passport-flight-search").fill("SFO");
    await openShare(page);
    const fromOverlay = await decodeImage(page);
    await expect(image(page)).toHaveAttribute("data-map-routes", "49");

    // Reference: the same passport built in-page from the complete archive.
    const reference = await page.evaluate(async (flights) => {
      const load = (p: string) => import(/* @vite-ignore */ p);
      const [data, copyModule, layoutModule, exporter, text, i18n] =
        await Promise.all([
          load("/src/share/poster-data.ts"),
          load("/src/share/poster-copy.ts"),
          load("/src/share/poster-layout.ts"),
          load("/src/share/poster-export.ts"),
          load("/src/share/share-text.ts"),
          load("/src/i18n.ts"),
        ]);
      const model = data.buildPosterModel(flights);
      const copy = copyModule.buildPosterCopy(
        model,
        i18n.i18n.t.bind(i18n.i18n),
        "en-US",
        "kilometers",
      );
      const layout = layoutModule.createPosterLayout("4:3");
      const fonts = await text.prepareShareFonts("en");
      const result = await exporter.exportPosterPng({
        layout,
        copy,
        fonts,
        tone: "dark",
      });
      const bytes = new Uint8Array(await result.blob.arrayBuffer());
      return { flights: model.statistics.flights, bytes: Array.from(bytes) };
    }, archive.flights);
    expect(reference.flights).toBe(91);
    expect(
      createHash("sha256").update(Buffer.from(reference.bytes)).digest("hex"),
    ).toBe(fromOverlay.hash);
    // Passport keeps its own filters after sharing.
    await page.keyboard.press("Escape");
    await expect(page.locator("#passport-flight-search")).toHaveValue("SFO");
  });

  test("dense archives draw a clearly labelled selection of routes", async ({
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
    const template = archive.flights[0];
    const flights: object[] = [];
    codes.forEach((from, i) =>
      codes.forEach((to, j) => {
        if (j <= i) return;
        const day = `2024-${String(1 + ((i + j) % 12)).padStart(2, "0")}-15`;
        flights.push({
          ...template,
          id: `dense-${i}-${j}`,
          serviceDate: day,
          origin: { iata: from },
          destination: { iata: to },
          scheduledDeparture: `${day}T08:00:00Z`,
          scheduledArrival: `${day}T14:00:00Z`,
        });
      }),
    );
    archive.flights = flights;
    await page.setViewportSize({ width: 1440, height: 1000 });
    await seed(page, archive);
    await page.goto("/#passport");
    await resetLog(page);
    await openShare(page);
    await expect(image(page)).toHaveAttribute("data-map-routes", "60");
    expectPassport((await decodeImage(page)).decoded, "4:3", "dark");
    const drawn = (await readLog(page)).text;
    expectNoIdentifiers(drawn);
    expect(drawn.join("\n")).toContain(
      "Busiest 60 of 190 routes shown".toUpperCase(),
    );
    // Totals still count every flight, not just the drawn selection.
    expect(drawn.join("\n")).toContain("190");
  });

  test("an archive without completed flights explains instead of drawing", async ({
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
    await expect(page.locator(".share-overlay-message")).toHaveText(
      "There are no completed flights to share yet.",
    );
    await expect(image(page)).toHaveCount(0);
    expect((await readLog(page)).created).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("reports a generation failure and retries", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      (window as unknown as { __failPng: boolean }).__failPng = true;
      HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
        if ((window as unknown as { __failPng: boolean }).__failPng) {
          setTimeout(() => callback(null), 0);
          return;
        }
        return Reflect.apply(original, this, [callback, ...rest]);
      };
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await seed(page, await loadArchive());
    await page.goto("/#passport");
    await page.locator(".passport-share-button").click();
    await expect(page.getByRole("alert")).toContainText(
      "The image could not be created.",
    );
    await expect(image(page)).toHaveCount(0);
    await page.evaluate(
      () => ((window as unknown as { __failPng: boolean }).__failPng = false),
    );
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(image(page)).toBeVisible({ timeout: 20_000 });
    expectPassport((await decodeImage(page)).decoded, "4:3", "dark");
  });

  test("a #share bookmark lands on Passport", async ({ page }) => {
    await seed(page, await loadArchive());
    await page.goto("/#share");
    await expect(page).toHaveURL(/#passport$/);
    await expect(page.locator(".passport-share-button")).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator("[class*='share-studio']")).toHaveCount(0);
    // A hash change to #share while running does the same.
    await page.goto("/#settings");
    await page.evaluate(() => (window.location.hash = "share"));
    await expect(page).toHaveURL(/#passport$/);
    await expect(page.locator(".passport-share-button")).toBeVisible();
  });
});

// ------------------------------------------------------------- grid ----

const gridLocales = [
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
] as const;

test("header, grid and type scale hold in every locale and format", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const archive = await loadArchive();
  await page.goto("/");
  const results = await page.evaluate(
    async ({ flights, locales }) => {
      const load = (p: string) => import(/* @vite-ignore */ p);
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
      for (const language of locales) {
        await i18n.changeUiLanguage(language);
        for (const unit of ["miles", "kilometers"])
          for (const aspect of ["3:4", "4:3"])
            for (const tone of ["dark", "light"]) {
              const copy = copyModule.buildPosterCopy(
                data.buildPosterModel(flights),
                i18n.i18n.t.bind(i18n.i18n),
                language,
                unit,
              );
              const layout = layoutModule.createPosterLayout(aspect);
              const fonts = await text.prepareShareFonts(
                text.shareLocaleForLanguage(language),
              );
              const canvas = document.createElement("canvas");
              const report = exporter.renderPosterToCanvas(
                canvas,
                { layout, copy, fonts, tone },
                layout.width,
              );
              canvas.width = 0;
              out.push({ language, unit, aspect, tone, copy, layout, report });
            }
      }
      return out;
    },
    { flights: archive.flights, locales: [...gridLocales] },
  );
  type Box = {
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  const find = (texts: Box[], value: string) => {
    const box = texts.find((item) => item.text === value);
    expect(box, value).toBeTruthy();
    return box!;
  };
  for (const {
    language,
    unit,
    aspect,
    tone,
    copy,
    layout,
    report,
  } of results) {
    const where = `${language} ${unit} ${aspect} ${tone}`;
    expect(report.outside, where).toEqual([]);
    expect(report.truncated, where).toEqual([]);
    const texts = report.texts as Box[];
    // Issuer: on the brand's row, right-aligned to the content edge, above
    // the first rule, and clear of the brand.
    const brand = find(texts, copy.brand);
    const issuer = find(texts, copy.issuer);
    const firstRule = layout.rules[0].y;
    expect(issuer.y + issuer.height, where).toBeLessThan(firstRule);
    expect(issuer.y + issuer.height, where).toBeGreaterThan(brand.y);
    expect(issuer.y, where).toBeLessThan(brand.y + brand.height);
    expect(
      Math.abs(issuer.x + issuer.width - layout.right),
      where,
    ).toBeLessThan(2);
    expect(issuer.x, where).toBeGreaterThan(brand.x + brand.width + 24);
    // Nothing is drawn below the machine-readable zone.
    const lowest = Math.max(...texts.map((box) => box.y + box.height));
    expect(lowest, where).toBeLessThanOrEqual(layout.mrz.lines[1] + 8);
    // Each stat: label and figure start on the block's grid line, and the
    // label's last line sits on the row's shared label baseline.
    const stats = [
      [copy.distance, layout.distance],
      [copy.flights, layout.primary[0]],
      [copy.duration, layout.primary[1]],
      ...copy.secondary.map((stat: unknown, index: number) => [
        stat,
        layout.secondary[index],
      ]),
    ] as Array<
      [{ label: string; value: string }, { x: number; label: number }]
    >;
    for (const [stat, block] of stats) {
      const value = find(texts, stat.value);
      expect(
        Math.abs(value.x - block.x),
        `${where} ${stat.label}`,
      ).toBeLessThan(6);
      const labelLines = texts.filter(
        (box) =>
          stat.label.toLocaleUpperCase().includes(box.text) &&
          Math.abs(box.x - block.x) < 1 &&
          box.y < value.y,
      );
      expect(labelLines.length, `${where} ${stat.label}`).toBeGreaterThan(0);
      const last = labelLines.at(-1)!;
      expect(last.y + last.height, where).toBeGreaterThan(block.label - 30);
      expect(last.y + last.height, where).toBeLessThan(block.label + 12);
      // A wrapped label never reaches the rule above it.
      const ruleAbove = Math.max(
        ...layout.rules
          .map((r: { y: number }) => r.y)
          .filter((y: number) => y < block.label),
      );
      expect(labelLines[0]!.y, where).toBeGreaterThan(ruleAbove + 4);
      expect(value.x, where).toBeGreaterThanOrEqual(layout.left - 6);
    }
    // No text box overlaps another.
    for (let a = 0; a < texts.length; a += 1)
      for (let b = a + 1; b < texts.length; b += 1) {
        const p = texts[a]!,
          q = texts[b]!;
        const overlap =
          p.x < q.x + q.width - 1 &&
          q.x < p.x + p.width - 1 &&
          p.y < q.y + q.height - 1 &&
          q.y < p.y + p.height - 1;
        expect(overlap, `${where}: "${p.text}" × "${q.text}"`).toBe(false);
      }
    // No digit grouping anywhere on the poster.
    expect(texts.map((box) => box.text).join("\n"), where).not.toMatch(
      /\d[,.\u00a0\u202f\u2009 ]\d{3}(?!\d)/,
    );
  }
});

test("small text stays legible at phone width", async ({ page }) => {
  // A 3:4 poster shown 390 px wide on a phone: labels must stay above
  // roughly 9 CSS px, the issuer and notes above 8 px.
  const archive = await loadArchive();
  await page.goto("/");
  const sizes = await page.evaluate(async () => {
    const load = (p: string) => import(/* @vite-ignore */ p);
    const layoutModule = await load("/src/share/poster-layout.ts");
    const layout = layoutModule.createPosterLayout("3:4");
    const scale = 390 / layout.width;
    return {
      label: layout.primary[0].labelSize * scale,
      secondaryFigure: layout.secondary[0].size * scale,
      issuer: layout.issuer.size * scale,
      note: layout.notes.size * scale,
      brand: layout.brand.size * scale,
    };
  });
  void archive;
  expect(sizes.label).toBeGreaterThanOrEqual(9);
  expect(sizes.secondaryFigure).toBeGreaterThanOrEqual(15);
  expect(sizes.issuer).toBeGreaterThanOrEqual(8);
  expect(sizes.note).toBeGreaterThanOrEqual(8);
  expect(sizes.brand).toBeGreaterThan(sizes.issuer);
});

// ------------------------------------------------------------ viewports ----

async function shareIn(
  browser: Browser,
  viewport: {
    width: number;
    height: number;
    scale?: number;
    mobile?: boolean;
  },
  options: { appearance?: Appearance; colorScheme?: "light" | "dark" } = {},
) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.scale ?? 1,
    isMobile: viewport.mobile ?? false,
    hasTouch: viewport.mobile ?? false,
    colorScheme: options.colorScheme ?? "light",
  });
  const page = await context.newPage();
  await instrument(page);
  await seed(page, await loadArchive(), { appearance: options.appearance });
  await openShare(page);
  const result = await decodeImage(page);
  const tone = (await dialog(page).getAttribute("data-tone")) as
    "dark" | "light";
  return { context, page, result, tone };
}

const viewportCases = [
  // [name, viewport, expected aspect]
  ["desktop", { width: 1440, height: 900 }, "4:3"],
  ["desktop narrow 761", { width: 761, height: 900 }, "4:3"],
  ["breakpoint 760", { width: 760, height: 900 }, "3:4"],
  [
    "phone portrait",
    { width: 390, height: 844, scale: 3, mobile: true },
    "3:4",
  ],
  [
    "phone landscape",
    { width: 844, height: 390, scale: 3, mobile: true },
    "4:3",
  ],
  ["small phone", { width: 320, height: 568, scale: 2, mobile: true }, "3:4"],
] as const;

for (const [name, viewport, aspect] of viewportCases)
  test(`viewport width decides the PNG size: ${name}`, async ({
    browser,
  }, testInfo) => {
    const { context, page, result } = await shareIn(browser, viewport);
    await expect(dialog(page)).toHaveAttribute("data-aspect", aspect);
    expectPassport(result.decoded, aspect, "dark");
    // The close button stays on screen and clear of the image.
    const close = (await page
      .getByRole("button", { name: "Close" })
      .boundingBox())!;
    expect(close.y).toBeGreaterThanOrEqual(0);
    expect(close.x + close.width).toBeLessThanOrEqual(viewport.width + 0.5);
    expect(close.y + close.height).toBeLessThanOrEqual(result.decoded.box.y);
    await expect(page).toHaveURL(/#passport$/);
    await keep(
      testInfo,
      `viewport-${name.replace(/\s+/g, "-")}-${slug(aspect)}.png`,
      result.bytes,
    );
    await context.close();
  });

test("the same portrait PNG comes out at every device scale", async ({
  browser,
}) => {
  const images: Buffer[] = [];
  for (const viewport of [
    { width: 390, height: 844, scale: 3, mobile: true },
    { width: 700, height: 900, scale: 1 },
    { width: 360, height: 740, scale: 2, mobile: true },
  ]) {
    const { context, result } = await shareIn(browser, viewport);
    expect(result.decoded.ihdr).toEqual(SIZE["3:4"]);
    images.push(result.bytes);
    await context.close();
  }
  // Same composition everywhere; only glyph antialiasing may differ by
  // device, never layout or content.
  const context = await browser.newContext();
  const page = await context.newPage();
  const diffs = await page.evaluate(
    async (encoded) => {
      const decode = async (base64: string) => {
        const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([data]));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const base = await decode(encoded[0]!);
      const result: { mean: number; changed: number }[] = [];
      for (const image of encoded.slice(1)) {
        const other = await decode(image);
        let sum = 0,
          changed = 0;
        for (let i = 0; i < base.length; i += 4) {
          const d =
            Math.abs(base[i]! - other[i]!) +
            Math.abs(base[i + 1]! - other[i + 1]!) +
            Math.abs(base[i + 2]! - other[i + 2]!);
          sum += d;
          if (d > 96) changed += 1;
        }
        result.push({ mean: sum / (base.length / 4) / 3, changed });
      }
      return result;
    },
    images.map((bytes) => bytes.toString("base64")),
  );
  await context.close();
  for (const diff of diffs) {
    expect(diff.mean).toBeLessThan(1);
    expect(diff.changed).toBeLessThan(1200 * 1600 * 0.004);
  }
});

// --------------------------------------------------------------- themes ----

const themeCases = [
  // App appearance, system scheme → expected passport tone (always opposite)
  ["light", "dark", "dark"],
  ["dark", "light", "light"],
  ["system", "dark", "light"],
  ["system", "light", "dark"],
] as const;

for (const [appearance, colorScheme, tone] of themeCases)
  test(`app ${appearance} (system ${colorScheme}) shares a ${tone} passport`, async ({
    browser,
  }, testInfo) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844, scale: 2, mobile: true },
    ]) {
      const {
        context,
        page,
        result,
        tone: shown,
      } = await shareIn(browser, viewport, { appearance, colorScheme });
      const aspect: Aspect = viewport.width > 760 ? "4:3" : "3:4";
      expect(shown).toBe(tone);
      expectPassport(result.decoded, aspect, tone);
      expectNoIdentifiers((await readLog(page)).text);
      if (appearance !== "system")
        await keep(
          testInfo,
          `flight-passport-${slug(aspect)}-${tone}.png`,
          result.bytes,
        );
      await context.close();
    }
  });

// -------------------------------------------------------------- locales ----

const localeCases = [
  { language: "zh-CN", title: "飞行护照", issuer: "由 Keepraw Fly 发行" },
  { language: "zh-TW", title: "飛行護照", issuer: "由 Keepraw Fly 發行" },
  {
    language: "ja-JP",
    title: "フライトパスポート",
    issuer: "発行：Keepraw Fly",
  },
  { language: "ko-KR", title: "플라이트 패스포트", issuer: "Keepraw Fly 발행" },
  {
    language: "en-GB",
    title: "FLIGHT PASSPORT",
    issuer: "Issued by Keepraw Fly",
  },
  {
    language: "de-DE",
    title: "FLUGPASS",
    issuer: "Ausgestellt von Keepraw Fly",
  },
  {
    language: "fr-FR",
    title: "PASSEPORT DE VOL",
    issuer: "Délivré par Keepraw Fly",
  },
  {
    language: "es",
    title: "PASAPORTE DE VUELO",
    issuer: "Emitido por Keepraw Fly",
  },
  {
    language: "pt-BR",
    title: "PASSAPORTE DE VOO",
    issuer: "Emitido por Keepraw Fly",
  },
] as const;

for (const locale of localeCases)
  test(`localized passports stay inside the artboard: ${locale.language}`, async ({
    browser,
  }, testInfo) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844, scale: 2, mobile: true },
    ]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.scale ?? 1,
        isMobile: viewport.mobile ?? false,
        hasTouch: viewport.mobile ?? false,
      });
      const page = await context.newPage();
      await instrument(page);
      await seed(page, await loadArchive(), {
        language: locale.language,
        appearance: viewport.mobile ? "dark" : "light",
        distanceUnit: "miles",
      });
      await openShare(page);
      const aspect: Aspect = viewport.width > 760 ? "4:3" : "3:4";
      const tone = viewport.mobile ? "light" : "dark";
      // exportPosterPng refuses layouts whose text leaves the safe area,
      // so a finished image already proves every text box fits.
      await expect(image(page)).toHaveAttribute("data-truncated", "0");
      const result = await decodeImage(page);
      expectPassport(result.decoded, aspect, tone);
      const drawn = (await readLog(page)).text;
      expectNoIdentifiers(drawn);
      const text = drawn.join("\n");
      // The 4:3 title may break over two lines.
      const squash = (value: string) =>
        value.replace(/\s+/g, "").toLocaleUpperCase();
      expect(squash(drawn.join(""))).toContain(squash(locale.title));
      expect(text).toContain(locale.issuer);
      expect(text).toContain("Keepraw Fly");
      await keep(
        testInfo,
        `${locale.language}-${slug(aspect)}-${tone}.png`,
        result.bytes,
      );
      await context.close();
    }
  });

test("Chinese passports fall back to system fonts when the webfont fails", async ({
  page,
}) => {
  await instrument(page);
  await page.route(/misans-webfont/, (route) => route.abort());
  await seed(page, await loadArchive(), { language: "zh-CN" });
  await openShare(page);
  await expect(image(page)).toHaveAttribute("data-fonts", "fallback");
  await expect(
    page.getByText("海报字体加载失败，已改用系统字体。"),
  ).toBeVisible();
  expectPassport((await decodeImage(page)).decoded, "4:3", "dark");
});

// Engine coverage: Canvas 2D text, Path2D map geometry, toBlob encoding,
// Blob URLs and <img> decoding all differ by engine.
test("Share shows both passport formats in this engine @cross-browser", async ({
  page,
  browserName,
}, testInfo) => {
  test.setTimeout(120_000);
  await instrument(page);
  await seed(page, await loadArchive());
  for (const [viewport, aspect] of [
    [{ width: 1440, height: 1000 }, "4:3"],
    [{ width: 600, height: 900 }, "3:4"],
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto("/#passport");
    await resetLog(page);
    await openShare(page);
    await expect(image(page)).toHaveAttribute("data-map-routes", "49");
    const result = await decodeImage(page);
    expectPassport(result.decoded, aspect, "dark");
    const log = await readLog(page);
    expect(
      log.contexts.filter(
        (type) => type.endsWith(":2d") && type !== "export:2d",
      ),
    ).toEqual([]);
    expectNoIdentifiers(log.text);
    expect(log.text.join("\n")).toContain("Issued by Keepraw Fly");
    await keep(testInfo, `${browserName}-${slug(aspect)}.png`, result.bytes);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator(".passport-share-button")).toBeFocused();
    expect((await readLog(page)).revoked).toHaveLength(1);
  }
});
