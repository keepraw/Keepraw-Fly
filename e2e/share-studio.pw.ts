import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Share Studio (stage 3B): pure Canvas 2D data posters. Every PNG here is
 * produced by the real Studio UI in a real browser, captured as a download,
 * and decoded (signature, IHDR, createImageBitmap, pixel statistics).
 */

type Template = "passport" | "year";
type Aspect = "3:4" | "4:3";
type Privacy = "overview" | "routes" | "airports";
const SIZE: Record<Aspect, { width: number; height: number }> = {
  "3:4": { width: 1200, height: 1600 },
  "4:3": { width: 1600, height: 1200 },
};
const slug = (aspect: Aspect) => (aspect === "3:4" ? "3x4" : "4x3");

const fixtureUrl = new URL(
  "./fixtures/share-poster.keepraw-fly.json",
  import.meta.url,
);
// Optional: copy the four concept posters somewhere reviewable.
const artifactDir = process.env.SHARE_STUDIO_ARTIFACTS;

async function loadArchive() {
  return JSON.parse(await readFile(fixtureUrl, "utf8"));
}

async function seed(
  page: Page,
  archive: unknown,
  language = "en-US",
  distanceUnit: "miles" | "kilometers" = "kilometers",
) {
  await page.goto("/");
  await expect(page.locator('input[type="file"]')).toBeAttached();
  await page.evaluate(
    async ({ archive, language, distanceUnit }) => {
      const modulePath = "/src/storage/browser.ts";
      const { browserStorage } = await import(/* @vite-ignore */ modulePath);
      await browserStorage.saveDocument(archive, "personal");
      await browserStorage.saveSettings({
        language,
        appearance: "light",
        distanceUnit,
        timeFormat: "24-hour",
        powerUserMode: false,
        solarMode: "fixed",
      });
    },
    { archive, language, distanceUnit },
  );
  // Storage is read on start-up; reload so the app opens the seeded archive.
  await page.reload();
}

/** Records Canvas work and network traffic from the first script on. */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const log = {
      contexts: [] as string[],
      text: [] as string[],
    };
    (window as unknown as { __share: typeof log }).__share = log;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      // Detached canvases (the export canvas) count as Studio work.
      const where =
        this.isConnected && !this.closest(".share-studio-page")
          ? "other"
          : "studio";
      log.contexts.push(`${where}:${String(type)}`);
      // The Passport Globe is covered elsewhere; keep this suite on 2D only.
      if (type === "webgl2" || type === "webgl") return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      log.text.push(String(text));
      return Reflect.apply(fillText, this, [text, ...rest]);
    } as typeof fillText;
  });
}

async function resetLog(page: Page) {
  await page.evaluate(() => {
    const log = (
      window as unknown as {
        __share: { contexts: string[]; text: string[] };
      }
    ).__share;
    log.contexts.length = 0;
    log.text.length = 0;
  });
}

async function readLog(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as { __share: { contexts: string[]; text: string[] } })
        .__share,
  );
}

async function openStudio(page: Page) {
  await page.goto("/#passport");
  await page.locator(".passport-share-button").click();
  await expect(page).toHaveURL(/#share$/);
  await expect(page.locator(".share-studio-canvas")).toBeVisible();
}

async function configure(
  page: Page,
  options: {
    template?: Template;
    year?: number | "lifetime";
    aspect?: Aspect;
    privacy?: Privacy;
  },
) {
  const pick = async (name: string, value: string) => {
    const input = page.locator(`input[name="${name}"][value="${value}"]`);
    if (await input.isChecked()) return;
    // The visible control is the label; the native radio is visually hidden.
    await page.locator("label.share-studio-option", { has: input }).click();
    await expect(input).toBeChecked();
  };
  if (options.template) await pick("share-template", options.template);
  if (options.year === "lifetime") await pick("share-range", "lifetime");
  else if (options.year !== undefined) {
    await pick("share-range", "year");
    await page
      .locator(".share-studio-select select")
      .selectOption(String(options.year));
  }
  if (options.aspect) await pick("share-aspect", options.aspect);
  if (options.privacy) {
    // Two separate opt-ins: real routes, then airport codes and names.
    const toggle = async (name: string, on: boolean) => {
      const input = page.locator(`input[name="${name}"]`);
      if ((await input.isChecked()) !== on) await input.setChecked(on);
      await expect(input).toBeChecked({ checked: on });
    };
    await toggle("share-routes", options.privacy !== "overview");
    if (options.privacy !== "overview")
      await toggle("share-airports", options.privacy === "airports");
    else
      await expect(page.locator('input[name="share-airports"]')).toBeDisabled();
  }
  await expect(page.locator(".share-studio-canvas")).toHaveAttribute(
    "data-preview-ready",
    "true",
  );
}

interface Decoded {
  width: number;
  height: number;
  ihdr: { width: number; height: number; colorType: number };
  opaque: boolean;
  mean: number;
  std: number;
  colors: number;
  corner: [number, number, number];
  inkRows: number;
  previewDiff: number | null;
}

/** Click Download, capture the file, decode it in the page. */
async function download(page: Page, compareWithPreview = true) {
  const [file] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".share-studio-download").click(),
  ]);
  const filePath = await file.path();
  const bytes = await readFile(filePath);
  const decoded: Decoded = await page.evaluate(
    async ({ base64, compareWithPreview }) => {
      const binary = atob(base64);
      const data = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      const view = new DataView(data.buffer);
      const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      if (!signature.every((value, index) => data[index] === value))
        throw new Error("bad PNG signature");
      const ihdr = {
        width: view.getUint32(16),
        height: view.getUint32(20),
        colorType: data[25]!,
      };
      const bitmap = await createImageBitmap(
        new Blob([data], { type: "image/png" }),
      );
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
        if (i % 16 === 0)
          colors.add((r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3));
        const dist =
          Math.abs(r - corner[0]) +
          Math.abs(g - corner[1]) +
          Math.abs(b - corner[2]);
        if (dist > 120) rows.add(Math.floor(i / 4 / bitmap.width));
      }
      const count = pixels.data.length / 4;
      const mean = sum / count;
      let previewDiff: number | null = null;
      const preview = document.querySelector<HTMLCanvasElement>(
        ".share-studio-canvas",
      );
      if (compareWithPreview && preview) {
        // Same draw function at a lower resolution: downscale the export to
        // the preview size and compare pixel by pixel.
        const small = new OffscreenCanvas(preview.width, preview.height);
        const smallContext = small.getContext("2d")!;
        smallContext.imageSmoothingQuality = "high";
        smallContext.drawImage(bitmap, 0, 0, preview.width, preview.height);
        const a = smallContext.getImageData(
          0,
          0,
          preview.width,
          preview.height,
        );
        const b = preview
          .getContext("2d")!
          .getImageData(0, 0, preview.width, preview.height);
        let diff = 0;
        for (let i = 0; i < a.data.length; i += 4)
          diff +=
            Math.abs(a.data[i]! - b.data[i]!) +
            Math.abs(a.data[i + 1]! - b.data[i + 1]!) +
            Math.abs(a.data[i + 2]! - b.data[i + 2]!);
        previewDiff = diff / (a.data.length / 4) / 3;
      }
      const { width, height } = bitmap;
      bitmap.close();
      return {
        width,
        height,
        ihdr,
        opaque,
        mean,
        std: Math.sqrt(squares / count - mean * mean),
        colors: colors.size,
        corner,
        inkRows: rows.size,
        previewDiff,
      };
    },
    { base64: bytes.toString("base64"), compareWithPreview },
  );
  return {
    bytes,
    decoded,
    name: file.suggestedFilename(),
    hash: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function keep(testInfo: TestInfo, name: string, bytes: Buffer) {
  await writeFile(testInfo.outputPath(name), bytes);
  if (artifactDir) {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(path.join(artifactDir, name), bytes);
  }
}

function expectPoster(decoded: Decoded, aspect: Aspect, template: Template) {
  const { width, height } = SIZE[aspect];
  expect(decoded.width).toBe(width);
  expect(decoded.height).toBe(height);
  expect(decoded.ihdr.width).toBe(width);
  expect(decoded.ihdr.height).toBe(height);
  expect(decoded.opaque).toBe(true);
  // Neither black, blank nor a flat fill: real typography and the map.
  expect(decoded.std).toBeGreaterThan(12);
  expect(decoded.colors).toBeGreaterThan(40);
  // Content spread over most of the artboard height (not shifted/cropped).
  expect(decoded.inkRows).toBeGreaterThan(height * 0.25);
  const [r, g, b] = decoded.corner;
  if (template === "passport") {
    expect(r + g + b).toBeLessThan(120); // deep navy
    expect(b).toBeGreaterThan(r);
  } else {
    expect(r + g + b).toBeGreaterThan(660); // paper white
  }
  if (decoded.previewDiff !== null) expect(decoded.previewDiff).toBeLessThan(9);
}

test.describe("Share Studio", () => {
  test.beforeEach(async ({ page }) => {
    await instrument(page);
  });

  test("exports the four concept posters through the Studio UI", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const archive = await loadArchive();
    await seed(page, archive);
    const requests: { method: string; url: string }[] = [];
    page.on("request", (request) =>
      requests.push({ method: request.method(), url: request.url() }),
    );
    const before = await page.evaluate(async () => {
      const modulePath = "/src/storage/browser.ts";
      const { browserStorage } = await import(/* @vite-ignore */ modulePath);
      return JSON.stringify((await browserStorage.loadDocument()).document);
    });
    await openStudio(page);
    // Only what happens from here on is Studio work.
    await resetLog(page);

    // Defaults: Flight Passport, Lifetime, 4:3 on a desktop, privacy
    // overview (no routes, no airports).
    for (const [name, value] of [
      ["share-template", "passport"],
      ["share-range", "lifetime"],
      ["share-aspect", "4:3"],
    ])
      await expect(
        page.locator(`input[name="${name}"][value="${value}"]`),
      ).toBeChecked();
    await expect(page.locator('input[name="share-routes"]')).not.toBeChecked();
    await expect(page.locator('input[name="share-airports"]')).toBeDisabled();
    await expect(page.locator(".share-studio-canvas")).toHaveAttribute(
      "data-map-routes",
      "0",
    );

    const combos: Array<{ template: Template; aspect: Aspect; file: string }> =
      [
        {
          template: "passport",
          aspect: "3:4",
          file: "flight-passport-3x4.png",
        },
        {
          template: "passport",
          aspect: "4:3",
          file: "flight-passport-4x3.png",
        },
        { template: "year", aspect: "3:4", file: "year-in-flight-3x4.png" },
        { template: "year", aspect: "4:3", file: "year-in-flight-4x3.png" },
      ];
    const hashes = new Set<string>();
    for (const combo of combos) {
      await configure(page, { template: combo.template, aspect: combo.aspect });
      if (combo.template === "year")
        // Switching from Lifetime picks the most recent year with flights.
        await expect(page.locator(".share-studio-select select")).toHaveValue(
          "2025",
        );
      const result = await download(page);
      expectPoster(result.decoded, combo.aspect, combo.template);
      expect(result.name).toBe(
        combo.template === "year"
          ? `keepraw-fly-year-in-flight-2025-${slug(combo.aspect)}.png`
          : `keepraw-fly-flight-passport-lifetime-${slug(combo.aspect)}.png`,
      );
      const { width, height } = SIZE[combo.aspect];
      await expect(page.locator(".share-studio-status")).toHaveText(
        `PNG saved · ${width} × ${height}`,
      );
      hashes.add(result.hash);
      await keep(testInfo, combo.file, result.bytes);
    }
    expect(hashes.size).toBe(4);

    const log = await readLog(page);
    // Pure Canvas 2D: no WebGL context was ever requested by the Studio.
    expect(log.contexts.filter((type) => type !== "studio:2d")).toEqual([]);
    expect(log.contexts.length).toBeGreaterThan(0);
    // Privacy overview: no airport identifiers or personal fields drawn.
    const drawn = log.text.join("\n");
    for (const code of ["PEK", "PVG", "HKG", "SFO", "LHR", "SYD", "QQX"])
      expect(drawn).not.toContain(code);
    for (const secret of ["SHARE_SENTINEL_NAME", "Share Sentinel", "2025-"])
      expect(drawn).not.toContain(secret);
    expect(drawn).not.toMatch(/\b[A-Z]{2}\d{3}\b/); // flight numbers
    expect(drawn).toContain("FLIGHT PASSPORT");
    expect(drawn).toContain("2025");
    // Machine-readable band: brand, scope and totals only.
    expect(drawn).toMatch(/LIFETIME<<20172025<<91FLT<<\d+KM<<\d+H/);
    // Lifetime totals and trends come from the full archive.
    expect(drawn).toContain("91"); // 92 records, one cancelled
    // Lifetime span and monthly trend come from the full archive too.
    expect(drawn).toContain("2017 – 2025");
    expect(drawn).toContain("Distance from 90 of 91 flights");

    // Local only: no uploads, no new third-party endpoints.
    expect(requests.filter((r) => r.method !== "GET")).toEqual([]);
    expect(
      requests.filter(
        (r) => !/^(http:\/\/127\.0\.0\.1|blob:|data:)/.test(r.url),
      ),
    ).toEqual([]);
    const after = await page.evaluate(async () => {
      const modulePath = "/src/storage/browser.ts";
      const { browserStorage } = await import(/* @vite-ignore */ modulePath);
      return JSON.stringify((await browserStorage.loadDocument()).document);
    });
    expect(after).toBe(before);
  });

  test("ignores Passport search, year and airport selection", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const archive = await loadArchive();
    await seed(page, archive);
    await page.goto("/#passport");
    await page.getByRole("button", { name: "2023", exact: true }).click();
    await page.locator("#passport-flight-search").fill("SFO");
    await openStudio(page);
    await configure(page, {});
    const fromStudio = await download(page, false);

    // Reference: the same poster built in-page from the complete archive.
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
      const model = data.buildPosterModel(flights, {
        template: "passport",
        scope: { kind: "lifetime" },
        privacy: "overview",
        locale: "en-US",
      });
      const copy = copyModule.buildPosterCopy(
        model,
        i18n.i18n.t.bind(i18n.i18n),
        "en-US",
        "kilometers",
      );
      const layout = layoutModule.createPosterLayout("passport", "4:3");
      const fonts = await text.prepareShareFonts("en");
      const result = await exporter.exportPosterPng({ layout, copy, fonts });
      const bytes = new Uint8Array(await result.blob.arrayBuffer());
      return { flights: model.statistics.flights, bytes: Array.from(bytes) };
    }, archive.flights);
    expect(reference.flights).toBe(91);
    expect(
      createHash("sha256").update(Buffer.from(reference.bytes)).digest("hex"),
    ).toBe(fromStudio.hash);
  });

  test("routes and airport labels appear only after explicit opt-in", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await seed(page, await loadArchive());
    await openStudio(page);
    await configure(page, { aspect: "3:4" });
    const canvas = page.locator(".share-studio-canvas");
    await expect(canvas).toHaveAttribute("data-map-routes", "0");
    await expect(canvas).toHaveAttribute("data-map-airports", "0");
    const overview = await download(page);

    // Step 1: real routes, still without codes or names.
    await resetLog(page);
    await configure(page, { privacy: "routes" });
    await expect(canvas).toHaveAttribute("data-privacy", "routes");
    const routes = Number(await canvas.getAttribute("data-map-routes"));
    expect(routes).toBe(49); // every plottable airport pair in the archive
    // Every airport with known coordinates (the unknown one is not drawn).
    expect(Number(await canvas.getAttribute("data-map-airports"))).toBe(19);
    const withRoutes = await download(page);
    expectPoster(withRoutes.decoded, "3:4", "passport");
    expect(withRoutes.hash).not.toBe(overview.hash);
    await keep(testInfo, "flight-passport-3x4-routes.png", withRoutes.bytes);
    let drawn = (await readLog(page)).text;
    expect(drawn.filter((text) => /^[A-Z]{3}$/.test(text))).toEqual([]);
    expect(drawn.join("\n")).toContain("ALL 49 ROUTES SHOWN");
    expect(drawn.join("\n")).not.toMatch(/\b[A-Z]{2}\d{3}\b|2025-\d\d/);

    // Step 2: the separate airport grant adds codes and names.
    await resetLog(page);
    await configure(page, { privacy: "airports" });
    const withAirports = await download(page);
    expectPoster(withAirports.decoded, "3:4", "passport");
    await keep(
      testInfo,
      "flight-passport-3x4-airports.png",
      withAirports.bytes,
    );
    drawn = (await readLog(page)).text;
    const codes = new Set(drawn.filter((text) => /^[A-Z]{3}$/.test(text)));
    expect(codes.size).toBeGreaterThan(0);
    expect(codes.size).toBeLessThanOrEqual(8); // 5 map labels + top 3
    expect(drawn.join("\n")).not.toMatch(/\b[A-Z]{2}\d{3}\b|2025-\d\d/);

    // Turning routes off revokes both grants again.
    await resetLog(page);
    await configure(page, { privacy: "overview" });
    await expect(
      page.locator('input[name="share-airports"]'),
    ).not.toBeChecked();
    await expect(canvas).toHaveAttribute("data-map-routes", "0");
    const again = await download(page);
    expect(again.hash).toBe(overview.hash);
    expect(
      (await readLog(page)).text.filter((text) => /^[A-Z]{3}$/.test(text)),
    ).toEqual([]);
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
    await seed(page, archive);
    await openStudio(page);
    await resetLog(page);
    await configure(page, { privacy: "routes" });
    const canvas = page.locator(".share-studio-canvas");
    await expect(canvas).toHaveAttribute("data-map-routes", "60");
    const result = await download(page);
    expectPoster(result.decoded, "4:3", "passport");
    const drawn = (await readLog(page)).text.join("\n");
    expect(drawn).toContain("Busiest 60 of 190 routes shown".toUpperCase());
    // Totals still count every flight, not just the drawn selection.
    expect(drawn).toContain("190");
  });

  test("blocks misleading posters when no year has completed flights", async ({
    page,
  }) => {
    const archive = await loadArchive();
    archive.flights = archive.flights.map((flight: object) => ({
      ...flight,
      cancelled: true,
    }));
    await seed(page, archive);
    await page.goto("/#share");
    await expect(page.locator(".share-studio-blocked")).toHaveText(
      "There are no completed flights to share yet.",
    );
    await expect(page.locator(".share-studio-download")).toBeDisabled();
    await expect(page.locator(".share-studio-canvas")).toHaveCount(0);
    await expect(
      page.locator('input[name="share-range"][value="year"]'),
    ).toBeDisabled();
  });

  test("Year in Flight requires a year and offers only years with flights", async ({
    page,
  }) => {
    await seed(page, await loadArchive());
    await openStudio(page);
    await configure(page, { template: "year" });
    await expect(
      page.locator('input[name="share-range"][value="lifetime"]'),
    ).toBeDisabled();
    const options = await page
      .locator(".share-studio-select option")
      .allTextContents();
    expect(options).toEqual([
      "2025",
      "2024",
      "2023",
      "2022",
      "2021",
      "2020",
      "2019",
      "2018",
      "2017",
    ]);
    await configure(page, { year: 2020 });
    const result = await download(page);
    expect(result.name).toBe("keepraw-fly-year-in-flight-2020-4x3.png");
    expectPoster(result.decoded, "4:3", "year");
  });

  test("repeated and concurrent exports are stable", async ({ page }) => {
    await seed(page, await loadArchive());
    await openStudio(page);
    await configure(page, { template: "year", aspect: "3:4" });
    const first = await download(page);
    const second = await download(page);
    const third = await download(page);
    expect(new Set([first.hash, second.hash, third.hash]).size).toBe(1);
    // A double click starts one export; the button is disabled meanwhile.
    let downloads = 0;
    page.on("download", () => (downloads += 1));
    await page.locator(".share-studio-download").dblclick();
    // Encoding a 1200×1600 PNG can take a few seconds on CI machines.
    await expect(page.locator(".share-studio-status")).toHaveText(
      "PNG saved · 1200 × 1600",
      { timeout: 20_000 },
    );
    await page.waitForTimeout(300);
    expect(downloads).toBe(1);
  });

  test("reports a Canvas encoding failure without downloading", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toBlob = function (callback) {
        setTimeout(() => callback(null), 0);
      };
    });
    await seed(page, await loadArchive());
    await openStudio(page);
    await configure(page, {});
    let downloaded = false;
    page.on("download", () => (downloaded = true));
    await page.locator(".share-studio-download").click();
    await expect(page.locator(".share-studio-status")).toHaveText(
      "The PNG could not be created. Nothing was saved.",
    );
    await expect(page.locator(".share-studio-download")).toBeEnabled();
    expect(downloaded).toBe(false);
  });
});

const localeCases = [
  { language: "zh-CN", title: "飞行护照", year: "年度飞行" },
  { language: "zh-TW", title: "飛行護照", year: "年度飛行" },
  { language: "ja-JP", title: "フライトパスポート", year: "フライトの一年" },
  { language: "ko-KR", title: "플라이트 패스포트", year: "올해의 비행" },
  { language: "en-US", title: "FLIGHT PASSPORT", year: "YEAR IN FLIGHT" },
  { language: "de-DE", title: "FLUGPASS", year: "FLUGJAHR" },
] as const;

for (const locale of localeCases)
  test(`localized posters stay inside the artboard: ${locale.language}`, async ({
    page,
  }, testInfo) => {
    await instrument(page);
    await seed(page, await loadArchive(), locale.language, "miles");
    await page.goto("/#share");
    await expect(page.locator(".share-studio-canvas")).toBeVisible();
    for (const [template, aspect, privacy] of [
      ["passport", "3:4", "airports"],
      ["year", "4:3", "airports"],
      ["year", "3:4", "overview"],
      ["passport", "4:3", "overview"],
    ] as const) {
      await configure(page, { template, aspect, privacy });
      const result = await download(page);
      // exportPosterPng refuses layouts whose text leaves the safe area.
      expectPoster(result.decoded, aspect, template);
      if (privacy === "airports")
        await keep(
          testInfo,
          `${locale.language}-${template}-${slug(aspect)}.png`,
          result.bytes,
        );
    }
    const drawn = (await readLog(page)).text.join("\n");
    expect(drawn).toContain(locale.title);
    expect(drawn).toContain(locale.year);
    // Fonts resolved without falling back (zh webfont, or system stacks).
    await expect(
      page.locator(".share-studio-actions .share-studio-note"),
    ).toHaveCount(0);
  });

test("Chinese posters fall back to system fonts when the webfont fails", async ({
  page,
}) => {
  await instrument(page);
  await page.route(/misans-webfont/, (route) => route.abort());
  await seed(page, await loadArchive(), "zh-CN");
  await page.goto("/#share");
  await configure(page, {});
  await expect(
    page.getByText("海报字体加载失败，已改用系统字体。"),
  ).toBeVisible();
  const result = await download(page);
  expectPoster(result.decoded, "4:3", "passport");
});

test("PNG size and composition are stable across DPR and viewports", async ({
  browser,
}) => {
  const exports: { name: string; bytes: Buffer }[] = [];
  for (const viewport of [
    { name: "desktop-dpr1", width: 1440, height: 900, scale: 1, mobile: false },
    { name: "desktop-dpr2", width: 1280, height: 800, scale: 2, mobile: false },
    { name: "mobile-dpr3", width: 390, height: 844, scale: 3, mobile: true },
  ]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.scale,
      isMobile: viewport.mobile,
      hasTouch: viewport.mobile,
      acceptDownloads: true,
    });
    const page = await context.newPage();
    await instrument(page);
    await seed(page, await loadArchive());
    await page.goto("/#share");
    // Phones open on 3:4, desktops on 4:3.
    await expect(
      page.locator(
        `input[name="share-aspect"][value="${viewport.mobile ? "3:4" : "4:3"}"]`,
      ),
    ).toBeChecked();
    await configure(page, { template: "year", aspect: "3:4" });
    const preview = page.locator(".share-studio-canvas");
    const previewBox = (await preview.boundingBox())!;
    const controlsBox = (await page
      .locator(".share-studio-controls")
      .boundingBox())!;
    if (viewport.mobile) {
      // Preview first, settings below.
      expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(
        controlsBox.y,
      );
      expect(previewBox.x + previewBox.width).toBeLessThanOrEqual(
        viewport.width,
      );
    } else {
      // Settings left, preview right.
      expect(controlsBox.x + controlsBox.width).toBeLessThanOrEqual(
        previewBox.x,
      );
    }
    expect(
      await preview.evaluate((canvas: HTMLCanvasElement) => canvas.width),
    ).toBeLessThanOrEqual(1200);
    const result = await download(page);
    expectPoster(result.decoded, "3:4", "year");
    exports.push({ name: viewport.name, bytes: result.bytes });
    await context.close();
  }
  // Same composition everywhere: compare decoded pixels against the first.
  const context = await browser.newContext();
  const page = await context.newPage();
  const diffs = await page.evaluate(
    async (images) => {
      const decode = async (base64: string) => {
        const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([data]));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext("2d")!;
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      };
      const base = await decode(images[0]!);
      const result: { mean: number; changed: number }[] = [];
      for (const image of images.slice(1)) {
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
    exports.map((item) => item.bytes.toString("base64")),
  );
  await context.close();
  for (const diff of diffs) {
    // Text antialiasing may differ by device (the poster carries many small
    // glyphs: stamp ring, labels); layout and content may not.
    expect(diff.mean).toBeLessThan(1);
    expect(diff.changed).toBeLessThan(1200 * 1600 * 0.004);
  }
});

// Engine coverage: the same Studio export in Chromium, Firefox and WebKit.
// Canvas 2D text, Path2D map geometry, toBlob encoding and the download all
// differ by engine, so every poster here is a real download in that engine.
test("Studio exports all four posters in this engine @cross-browser", async ({
  page,
  browserName,
}, testInfo) => {
  test.setTimeout(120_000);
  await instrument(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, await loadArchive());
  await openStudio(page);
  await resetLog(page);
  const hashes = new Set<string>();
  for (const [template, aspect, privacy] of [
    ["passport", "3:4", "overview"],
    ["passport", "4:3", "routes"],
    ["year", "3:4", "routes"],
    ["year", "4:3", "overview"],
  ] as const) {
    await configure(page, { template, aspect, privacy });
    const canvas = page.locator(".share-studio-canvas");
    await expect(canvas).toHaveAttribute(
      "data-map-routes",
      privacy === "overview" ? "0" : template === "year" ? "20" : "49",
    );
    const result = await download(page);
    expectPoster(result.decoded, aspect, template);
    const { width, height } = SIZE[aspect];
    await expect(page.locator(".share-studio-status")).toHaveText(
      `PNG saved · ${width} × ${height}`,
    );
    hashes.add(result.hash);
    await keep(
      testInfo,
      `${browserName}-${template}-${slug(aspect)}-${privacy}.png`,
      result.bytes,
    );
  }
  expect(hashes.size).toBe(4);
  const log = await readLog(page);
  expect(log.contexts.filter((type) => type !== "studio:2d")).toEqual([]);
  const drawn = log.text.join("\n");
  expect(drawn).not.toMatch(/\b[A-Z]{2}\d{3}\b|2025-\d\d/);
  expect(log.text.filter((text) => /^[A-Z]{3}$/.test(text))).toEqual([]);
});
