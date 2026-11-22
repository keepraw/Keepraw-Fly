import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PosterCopy } from "../apps/web/src/share/poster-copy";
import type { NeonPassportLayout } from "../apps/web/src/share/poster-neon";
import type { PosterDrawReport } from "../apps/web/src/share/poster-paint";

/**
 * Neon Flight Passport: the default share layout. It is drawn from the real
 * archive statistics with the shared 2D scene and the active map theme, and
 * exported at twice the 1080×1350 artboard.
 */
const fixtureUrl = new URL(
  "./fixtures/share-poster.keepraw-fly.json",
  import.meta.url,
);
const artifactDir = process.env.SHARE_PASSPORT_ARTIFACTS;
const PNG = { width: 2160, height: 2700 };
const LANGUAGES = [
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
];

async function loadArchive() {
  return JSON.parse(await readFile(fixtureUrl, "utf8"));
}

async function seed(
  page: Page,
  archive: unknown,
  settings: Record<string, unknown> = {},
) {
  await page.goto("/");
  await expect(page.locator(".loading-screen")).toHaveCount(0);
  await expect(
    page.locator(".site-header, input[type=file]").first(),
  ).toBeAttached();
  await page.evaluate(
    async ({ archive, settings }) => {
      const modulePath = "/src/storage/browser.ts";
      const { browserStorage } = await import(/* @vite-ignore */ modulePath);
      await browserStorage.saveDocument(archive, "personal");
      await browserStorage.saveSettings({
        language: "en-US",
        appearance: "light",
        distanceUnit: "kilometers",
        timeFormat: "24-hour",
        powerUserMode: false,
        solarMode: "fixed",
        ...settings,
      });
    },
    { archive, settings },
  );
  await page.reload();
}

const dialog = (page: Page) => page.getByRole("dialog");
const image = (page: Page) => page.locator(".share-overlay-image");

async function openShare(page: Page) {
  if (!/#passport$/.test(page.url())) await page.goto("/#passport");
  await page.locator(".passport-share-button").click();
  await expect(dialog(page)).toBeVisible();
  await expect(image(page)).toBeVisible({ timeout: 30_000 });
  await expect
    .poll(() =>
      image(page).evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);
}

/** Decodes the PNG behind the <img> Blob URL and samples it. */
async function decode(page: Page) {
  return image(page).evaluate(async (img: HTMLImageElement) => {
    const blob = await (await fetch(img.src)).blob();
    const data = new Uint8Array(await blob.arrayBuffer());
    const view = new DataView(data.buffer);
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let opaque = true;
    const colors = new Set<number>();
    for (let i = 0; i < pixels.length; i += 64) {
      if (pixels[i + 3] !== 255) opaque = false;
      colors.add(
        (pixels[i]! >> 3) * 1024 +
          (pixels[i + 1]! >> 3) * 32 +
          (pixels[i + 2]! >> 3),
      );
    }
    const luma =
      0.2126 * pixels[0]! + 0.7152 * pixels[1]! + 0.0722 * pixels[2]!;
    return {
      src: img.src,
      type: blob.type,
      ihdr: { width: view.getUint32(16), height: view.getUint32(20) },
      natural: { width: img.naturalWidth, height: img.naturalHeight },
      opaque,
      colors: colors.size,
      cornerLuma: luma,
      bytes: Array.from(data),
    };
  });
}

async function keep(name: string, bytes: number[] | Buffer) {
  if (!artifactDir) return;
  await mkdir(artifactDir, { recursive: true });
  await writeFile(path.join(artifactDir, name), Buffer.from(bytes));
}

async function recordText(page: Page) {
  await page.addInitScript(() => {
    const log: string[] = [];
    const contexts: string[] = [];
    Object.assign(window, { __neonText: log, __neonContexts: contexts });
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      log.push(String(text));
      return Reflect.apply(fillText, this, [text, ...rest]);
    } as typeof fillText;
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      contexts.push(String(type));
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
}

interface Drawn {
  where: string;
  report: PosterDrawReport<NeonPassportLayout>;
  copy: PosterCopy;
  png: string;
}

/** Renders the Neon template in the page for each case and returns reports. */
async function renderCases(
  page: Page,
  flights: unknown[],
  cases: Array<{
    where: string;
    language: string;
    unit: "miles" | "kilometers";
    name: string;
    theme?: string;
    disableWebfont?: boolean;
    png?: boolean;
  }>,
): Promise<Drawn[]> {
  return page.evaluate(
    async ({ flights, cases }) => {
      const load = (path: string) => import(/* @vite-ignore */ path);
      const [data, copyModule, exporter, text, i18n] = await Promise.all([
        load("/src/share/poster-data.ts"),
        load("/src/share/poster-copy.ts"),
        load("/src/share/poster-export.ts"),
        load("/src/share/poster-fonts.ts"),
        load("/src/i18n.ts"),
      ]);
      const out = [];
      for (const item of cases) {
        await i18n.changeUiLanguage(item.language);
        const copy = copyModule.buildPosterCopy(
          data.buildPosterModel(flights),
          i18n.i18n.t.bind(i18n.i18n),
          item.language,
          item.unit,
          { number: "123ABC456" },
          { native: item.name },
        );
        const fonts = await text.preparePosterFonts(copy.locale, {
          disableWebfont: item.disableWebfont,
          copy,
          timeoutMs: 15_000,
        });
        const input = exporter.posterRenderInput(
          "neon",
          item.theme,
          copy,
          fonts,
        );
        const canvas = document.createElement("canvas");
        const report = exporter.renderPosterToCanvas(
          canvas,
          input,
          input.layout.width,
        );
        const png = item.png ? canvas.toDataURL("image/png") : "";
        canvas.width = 0;
        out.push({ where: item.where, report, copy, png });
      }
      return out;
    },
    { flights, cases },
  );
}

function expectClean({ where, report, copy }: Drawn) {
  const { layout, texts } = report;
  expect(report.outside, where).toEqual([]);
  expect(report.paperOutside, where).toEqual([]);
  expect(report.truncated, where).toEqual([]);
  // Nothing drawn on top of anything else, in any language.
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
  // Every statistic keeps its figure inside its own grid cell.
  const stats = [
    copy.distance,
    copy.flights,
    copy.duration,
    ...copy.secondary,
    copy.routes,
  ];
  for (const [index, stat] of stats.entries()) {
    const cell = layout.stats[index]!;
    const value = texts.find(
      (box) =>
        box.text === stat.value &&
        box.baseline === cell.baseline &&
        Math.abs(box.x - cell.x) < 1,
    );
    expect(value, `${where}: ${stat.label} value`).toBeTruthy();
    expect(value!.x, where).toBeGreaterThanOrEqual(cell.x - 0.5);
    expect(value!.x + value!.width, where).toBeLessThanOrEqual(
      cell.x + cell.width + 0.5,
    );
  }
  // The machine-readable zone is two 44-cell rows spanning the sheet.
  const mrz = texts.filter((box) => copy.mrz.includes(box.text));
  expect(mrz, where).toHaveLength(2);
  for (const row of mrz) {
    expect(row.text).toMatch(/^[A-Z0-9<]{44}$/);
    expect(row.width, where).toBeGreaterThan(layout.width * 0.88);
  }
  expect(texts.map((box) => box.text)).toContain(
    copy.title.toLocaleUpperCase(),
  );
}

test("Neon is the default layout: real totals, 2× PNG, local only @cross-browser", async ({
  page,
}) => {
  await recordText(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, await loadArchive());
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") writes.push(request.url());
  });
  await openShare(page);
  await expect(dialog(page)).toHaveAttribute("data-template", "neon");
  await expect(dialog(page)).toHaveAttribute("data-map-theme", "neon-aviation");
  await expect(dialog(page)).toHaveAccessibleName("Flight Passport");
  await expect(image(page)).toHaveAttribute("data-map-routes", "49");
  await expect(image(page)).toHaveAttribute("data-map-airports", "19");
  await expect(image(page)).toHaveAttribute("data-truncated", "0");
  const decoded = await decode(page);
  expect(decoded.src).toMatch(/^blob:/);
  expect(decoded.type).toBe("image/png");
  expect(decoded.ihdr).toEqual(PNG);
  expect(decoded.natural).toEqual(PNG);
  expect(decoded.opaque).toBe(true);
  expect(decoded.colors).toBeGreaterThan(40);
  expect(decoded.cornerLuma).toBeLessThan(60);
  await keep("neon-default.png", decoded.bytes);
  const drawn = await page.evaluate(
    () => (window as unknown as { __neonText: string[] }).__neonText,
  );
  expect(drawn).toEqual(
    expect.arrayContaining([
      "FLIGHT PASSPORT",
      "HOLDER NAME",
      "PASSPORT NO.",
      "FIRST FLIGHT",
      "RECORD PERIOD",
      "571474",
      "91",
      "768",
      "19",
      "8",
      "12",
      "50",
    ]),
  );
  // Privacy: no airport code, flight number or ISO date is ever drawn.
  const archive = await loadArchive();
  const codes = new Set<string>(
    archive.flights.flatMap(
      (flight: { origin: { iata: string }; destination: { iata: string } }) => [
        flight.origin.iata,
        flight.destination.iata,
      ],
    ),
  );
  const text = drawn.join("\n");
  for (const code of codes)
    expect(text).not.toMatch(new RegExp(`\\b${code}\\b`));
  expect(text).not.toMatch(/\b[A-Z]{2}\d{3,4}\b/);
  expect(text).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
  // Canvas 2D only: the share path never asks for WebGL.
  const contexts = await page.evaluate(
    () => (window as unknown as { __neonContexts: string[] }).__neonContexts,
  );
  expect(contexts.filter((type) => /webgl/i.test(type))).toEqual([]);
  expect(writes).toEqual([]);
});

test("the passport follows the map theme, and the layout is a separate setting", async ({
  page,
}) => {
  // Two full-resolution renders plus a reload: ~30 s on a CI runner.
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await seed(page, await loadArchive(), { mapTheme: "daylight-chart" });
  await openShare(page);
  await expect(dialog(page)).toHaveAttribute("data-template", "neon");
  await expect(dialog(page)).toHaveAttribute(
    "data-map-theme",
    "daylight-chart",
  );
  const daylight = await decode(page);
  expect(daylight.ihdr).toEqual(PNG);
  expect(daylight.cornerLuma).toBeGreaterThan(150);
  await keep("neon-daylight.png", daylight.bytes);
  await page.keyboard.press("Escape");

  // Same theme, other layout: chosen in Settings and remembered.
  await page.goto("/#settings");
  const select = page.locator("#settings-passport-layout");
  await expect(select).toHaveValue("neon");
  await select.selectOption("book");
  await page.reload();
  await expect(page.locator("#settings-passport-layout")).toHaveValue("book");
  await page.goto("/#passport");
  await openShare(page);
  await expect(dialog(page)).toHaveAttribute("data-template", "book");
  await expect(dialog(page)).not.toHaveAttribute("data-map-theme", /.+/);
  expect((await decode(page)).ihdr).not.toEqual(PNG);
});

test("an unknown stored layout falls back to Neon", async ({ page }) => {
  await seed(page, await loadArchive(), { passportTemplate: "retired-layout" });
  await page.goto("/#settings");
  await expect(page.locator("#settings-passport-layout")).toHaveValue("neon");
  await page.goto("/#passport");
  await openShare(page);
  await expect(dialog(page)).toHaveAttribute("data-template", "neon");
});

test("every language, unit and theme fits without overlap, overflow or lost text", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto("/");
  await expect(
    page.locator(".site-header, input[type=file]").first(),
  ).toBeAttached();
  const cases = LANGUAGES.flatMap((language) =>
    (["kilometers", "miles"] as const).flatMap((unit) =>
      [false, true].map((disableWebfont) => ({
        where: `${language} ${unit} ${disableWebfont ? "system" : "webfont"}`,
        language,
        unit,
        disableWebfont,
        theme: unit === "miles" ? "daylight-chart" : "neon-aviation",
        // Short CJK names, long accented Latin ones and mixed scripts.
        name: language.startsWith("zh")
          ? "云间漫游者"
          : language === "ja-JP"
            ? "空野 翔太郎"
            : language === "ko-KR"
              ? "김하늘"
              : language === "fr-FR"
                ? "Élodie Žluťoučká São Luís 東京 김하늘"
                : "Maximiliane Wolfeschlegelsteinhausen-Bergerdorff",
        png: !disableWebfont && unit === "kilometers",
      })),
    ),
  );
  const drawn = await renderCases(page, (await loadArchive()).flights, cases);
  expect(drawn).toHaveLength(LANGUAGES.length * 4);
  for (const item of drawn) {
    expectClean(item);
    expect(item.report.map.routes, item.where).toBe(49);
    if (item.png)
      await keep(
        `neon-${item.where.split(" ")[0]}.png`,
        Buffer.from(item.png.split(",")[1]!, "base64"),
      );
  }
  // Labels differ in length per language yet share one grid: the same
  // statistic sits on the same baseline in every language.
  const baselines = drawn.map(
    ({ report, copy }) =>
      report.texts.find((box) => box.text === copy.flights.value)!.baseline,
  );
  expect(new Set(baselines).size).toBe(1);
});

test("very long names wrap or shrink before anything is cut", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator(".site-header, input[type=file]").first(),
  ).toBeAttached();
  const names = [
    "云间漫游者".repeat(6) + "飞行",
    "W".repeat(40),
    "Wolfeschlegelsteinhausenbergerdorff ".repeat(3).trim(),
    "👩🏽‍✈️ e\u0301 東京 김하늘 São Luís",
    // Leading glyphs whose ink overhangs the left edge of their advance.
    "jane jörg",
    "ĵ fjord",
  ];
  const drawn = await renderCases(
    page,
    (await loadArchive()).flights,
    names.map((name, index) => ({
      where: `name ${index}`,
      language: index === 0 ? "zh-CN" : "de-DE",
      unit: "kilometers" as const,
      name,
    })),
  );
  for (const item of drawn) {
    expectClean(item);
    const all = item.report.texts.map((box) => box.text).join("");
    expect(all.replaceAll(" ", ""), item.where).toContain(
      item.copy.holder.name.replaceAll(" ", ""),
    );
  }
});

test("sparse, dense and date-line archives draw their real routes", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.locator(".site-header, input[type=file]").first(),
  ).toBeAttached();
  const base = (await loadArchive()).flights[0];
  const airports: Array<[string, number, number]> = [
    ["NRT", 35.7647, 140.3864],
    ["LAX", 33.9425, -118.4081],
    ["SYD", -33.9461, 151.1772],
    ["HNL", 21.3187, -157.9225],
  ];
  void airports;
  const flight = (id: number, from: string, to: string, date: string) => ({
    ...base,
    id: `neon-${id}`,
    serviceDate: date,
    origin: { ...base.origin, iata: from },
    destination: { ...base.destination, iata: to },
    cancelled: false,
  });
  const hubs = ["NRT", "LAX", "SYD", "HNL", "LHR", "JFK", "SIN", "DXB", "CDG"];
  const world = [
    ...hubs,
    "FRA",
    "AMS",
    "HKG",
    "ICN",
    "BKK",
    "DEL",
    "GRU",
    "EZE",
    "JNB",
    "CAI",
    "IST",
    "MAD",
    "FCO",
    "ZRH",
    "VIE",
    "CPH",
    "ARN",
    "HEL",
    "YVR",
    "YYZ",
    "ORD",
    "DFW",
    "ATL",
    "MIA",
    "SFO",
    "SEA",
    "DEN",
    "MEX",
    "BOG",
    "LIM",
    "SCL",
    "AKL",
    "MEL",
    "PER",
    "KUL",
    "MNL",
    "TPE",
    "PVG",
    "PEK",
    "CAN",
  ];
  const dense = world.flatMap((code, index) =>
    hubs
      .filter((hub) => hub !== code)
      .slice(0, 3)
      .map((hub, at) =>
        flight(index * 10 + at, hub, code, `2024-0${(at % 9) + 1}-1${at}`),
      ),
  );
  const archives = {
    sparse: [flight(1, "NRT", "LAX", "2024-03-02")],
    dateline: [
      flight(1, "NRT", "LAX", "2024-03-02"),
      flight(2, "SYD", "HNL", "2024-04-02"),
      flight(3, "HNL", "NRT", "2024-05-02"),
    ],
    dense,
  };
  for (const [kind, flights] of Object.entries(archives)) {
    const [item] = await renderCases(page, flights, [
      {
        where: kind,
        language: kind === "dense" ? "zh-CN" : "en-US",
        unit: "kilometers",
        name: "Test Traveller",
        png: true,
      },
    ]);
    expectClean(item!);
    await keep(
      `neon-${kind}.png`,
      Buffer.from(item!.png.split(",")[1]!, "base64"),
    );
    const { routes, airports: dots } = item!.report.map;
    if (kind === "sparse") expect([routes, dots]).toEqual([1, 2]);
    if (kind === "dateline") expect([routes, dots]).toEqual([3, 4]);
    if (kind === "dense") {
      // Curated to the busiest 60 pairs; statistics still count them all.
      expect(routes).toBe(60);
      expect(item!.copy.map.routes).toHaveLength(60);
      expect(Number(item!.copy.routes.value)).toBeGreaterThan(60);
    }
  }
});

test("an archive with only cancelled flights explains instead of drawing", async ({
  page,
}) => {
  const archive = await loadArchive();
  archive.flights = archive.flights
    .slice(0, 2)
    .map((flight: object) => ({ ...flight, cancelled: true }));
  await seed(page, archive);
  await page.goto("/#passport");
  const share = page.locator(".passport-share-button");
  if (await share.isEnabled().catch(() => false)) {
    await share.click();
    await expect(dialog(page)).toHaveAttribute("data-status", "empty");
    await expect(image(page)).toHaveCount(0);
  } else await expect(dialog(page)).toHaveCount(0);
});

test("a failed export can be retried, and webfont failure still exports", async ({
  page,
}) => {
  // Two renders, each allowed 30 s below, cannot fit the default 30 s budget.
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    (window as unknown as { failPng: boolean }).failPng = true;
    HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
      if ((window as unknown as { failPng: boolean }).failPng)
        return callback(null);
      return Reflect.apply(toBlob, this, [callback, ...rest]);
    };
  });
  await seed(page, await loadArchive(), { language: "zh-CN" });
  await page.route(/cdn\.jsdelivr\.net|\/share\/fonts\/.*\.woff2/, (route) =>
    route.abort(),
  );
  await page.goto("/#passport");
  await page.locator(".passport-share-button").click();
  await expect(dialog(page)).toHaveAttribute("data-status", "error", {
    timeout: 30_000,
  });
  await page.evaluate(() => {
    (window as unknown as { failPng: boolean }).failPng = false;
  });
  await dialog(page)
    .getByRole("button")
    .filter({ hasText: /重试|再试/ })
    .click();
  await expect(image(page)).toBeVisible({ timeout: 30_000 });
  await expect(image(page)).toHaveAttribute("data-fonts", "fallback");
  await expect(image(page)).toHaveAttribute("data-truncated", "0");
  expect((await decode(page)).ihdr).toEqual(PNG);
});
