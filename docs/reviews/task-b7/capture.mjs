import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const repository = new URL("../../../", import.meta.url);
const output =
  process.argv[2] ?? new URL("./screenshots/", import.meta.url).pathname;
await mkdir(output, { recursive: true });
const ca = {
  id: "ca1831",
  flightNumber: "CA1831",
  serviceDate: "2026-09-21",
  airline: { iata: "CA" },
  origin: { iata: "PEK", terminal: "T3", gate: "C21" },
  destination: { iata: "PVG", terminal: "T2" },
  scheduledDeparture: "2026-09-21T10:00:00+08:00",
  scheduledArrival: "2026-09-21T12:15:00+08:00",
  actualDeparture: "2026-09-21T10:11:00+08:00",
  actualArrival: "2026-09-21T12:05:00+08:00",
  baggageCarousel: "8",
  ticketNumber: "9991234567890",
  bookingReference: "AB12CD",
  extensions: {
    "keepraw-fly.aircraft": { type: "Airbus A321", registration: "B-1234" },
    "keepraw-fly.seat": { seat: "12A", cabin: "economy", bookingClass: "Y" },
  },
};
const ua = {
  ...ca,
  id: "international",
  flightNumber: "UA857",
  airline: { iata: "UA" },
  origin: { iata: "SFO" },
  destination: { iata: "PVG" },
  scheduledDeparture: "2026-09-21T11:00:00-07:00",
  actualDeparture: "2026-09-21T11:30:00-07:00",
  scheduledArrival: "2026-09-22T16:00:00+08:00",
  actualArrival: "2026-09-22T15:50:00+08:00",
};
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const results = [];
for (const [flight, width, theme] of [
  [ca, 1440, "light"],
  [ua, 1440, "light"],
  [ca, 1440, "dark"],
  [ua, 1440, "dark"],
  [ca, 1200, "light"],
]) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 1000 },
    locale: "en-US",
    colorScheme: theme,
    reducedMotion: "reduce",
    deviceScaleFactor: 1,
  });
  await context.addInitScript(
    (theme) => localStorage.setItem("keepraw-fly-appearance", theme),
    theme,
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const globeRequests = [];
  page.on("request", (r) => {
    if (
      /DetailGlobe|GlobeMap|globe-renderer|earth-4096|night-4096/.test(r.url())
    )
      globeRequests.push(r.url());
  });
  const archive = JSON.parse(
    await readFile(
      new URL("examples/basic.keepraw-fly.json", repository),
      "utf8",
    ),
  );
  archive.flights = [flight];
  await page.goto("http://127.0.0.1:5173");
  await expect(
    page.getByRole("button", { name: "Create my archive", exact: true }),
  ).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "b7-review.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(archive)),
    });
  await page
    .getByRole("button", { name: "Import this archive", exact: true })
    .click();
  await expect(page.locator(".flight-row")).toHaveCount(1);
  await page.locator(".flight-row").click();
  await page.setViewportSize({ width: 1199, height: 1000 });
  await expect(page.locator(".detail-route-map")).toHaveCount(0);
  expect(globeRequests).toEqual([]);
  await page.setViewportSize({ width, height: 1000 });
  const host = page.locator(".detail-globe-frame .globe-host");
  await expect(host).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".globe-airport-label")).toHaveCount(2);
  for (const label of await page.locator(".globe-airport-label").all())
    await expect(label).toBeVisible();
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  const measurements = await page.evaluate(() => {
    const selectors = [
      ".detail-hero-grid",
      ".detail-hero-information",
      ".detail-route-map",
      ".detail-hero-space",
      ".detail-metadata-shelf",
    ];
    const boxes = Object.fromEntries(
      selectors.map((s) => {
        const e = document.querySelector(s);
        const r = e.getBoundingClientRect();
        return [s, { x: r.x, y: r.y, width: r.width, height: r.height }];
      }),
    );
    const e = document.querySelector(".globe-host"),
      scene = JSON.parse(e.dataset.scene);
    const distance = Math.hypot(...scene.camera);
    const ratio =
      1.026 /
      (Math.sqrt(distance ** 2 - 1.026 ** 2) *
        Math.tan((scene.fov * Math.PI) / 360) *
        Math.min(1, scene.viewport.width / scene.viewport.height));
    return {
      boxes,
      scene,
      atmosphereRatio: ratio,
      overflow: document.documentElement.scrollWidth - innerWidth,
      mask: getComputedStyle(document.querySelector(".detail-globe-space"))
        .maskImage,
      heroColor: getComputedStyle(document.querySelector(".detail-hero-grid"))
        .color,
      informationColor: getComputedStyle(
        document.querySelector(".detail-hero-information"),
      ).color,
      shelfColumns: getComputedStyle(
        document.querySelector(".detail-metadata-shelf"),
      ).gridTemplateColumns,
    };
  });
  expect(measurements.overflow).toBeLessThanOrEqual(0);
  expect(measurements.atmosphereRatio).toBeLessThanOrEqual(0.98);
  expect(errors).toEqual([]);
  const name = `${flight.flightNumber}-${width}-${theme}`;
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  results.push({ name, errors, mobileGlobeRequests: 0, ...measurements });
  console.log(
    name,
    "captured",
    JSON.stringify({
      atmosphereRatio: measurements.atmosphereRatio,
      overflow: measurements.overflow,
    }),
  );
  await context.close();
}
await writeFile(
  `${output}/measurements.json`,
  JSON.stringify(results, null, 2) + "\n",
);
await browser.close();
