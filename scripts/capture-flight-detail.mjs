import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputDirectory = resolve("artifacts/visual-review");
const baseUrl = process.env.KEEPRAW_BASE_URL ?? "http://127.0.0.1:5173/";
const archive = JSON.parse(await readFile(resolve("examples/basic.keepraw-fly.json"), "utf8"));

archive.flights = [{
  id: "visual-review-zh9911-20260917",
  flightNumber: "ZH9911",
  serviceDate: "2026-09-17",
  airline: { iata: "ZH" },
  origin: { iata: "SZX", terminal: "T3", gate: "338" },
  destination: { iata: "TAO" },
  scheduledDeparture: "2026-09-17T20:45:00+08:00",
  scheduledArrival: "2026-09-18T00:05:00+08:00",
  actualDeparture: "2026-09-17T20:33:00+08:00",
  actualArrival: "2026-09-17T23:37:00+08:00",
  extensions: {
    "keepraw-fly.aircraft": { type: "Airbus A320neo", registration: "B-1234" },
    "keepraw-fly.seat": { seat: "2A", cabin: "business", bookingClass: "J" },
    "keepraw-fly.baggage": { checkedBaggage: true, carousel: "10" },
    "keepraw-fly.ticket": { number: "4792401988421" },
    "keepraw-fly.frequent-flyer": {
      programName: "PhoenixMiles",
      memberNumber: "ZH-88301924",
      tier: "Gold",
    },
  },
}];

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "en-US",
  });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.locator('input[type="file"]').setInputFiles({
    name: "flight-detail-visual-review.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("region", { name: "Review before importing" })
    .getByRole("button", { name: "Import this archive" }).click();
  await page.getByRole("button", { name: /Open ZH9911/ }).click();
  await page.locator(".detail-map-route").waitFor();
  await page.screenshot({
    path: resolve(outputDirectory, "flight-detail-i18n-en-desktop-1440.png"),
    fullPage: true,
  });

  async function setLanguage(language) {
    await page.goto(`${baseUrl}#settings`);
    await page.locator(".settings-fields select").first().selectOption(language);
    await page.locator("html").waitFor();
    await page.waitForFunction((expected) => document.documentElement.lang === expected, language);
    await page.waitForTimeout(100);
    await page.goto(`${baseUrl}#flights`);
    await page.locator(".flight-row").first().click();
    await page.locator(".detail-map-route").waitFor();
    await page.waitForTimeout(800);
  }

  await setLanguage("zh-CN");
  await page.screenshot({
    path: resolve(outputDirectory, "flight-detail-i18n-zh-CN-desktop-1440.png"),
    fullPage: true,
  });

  await setLanguage("zh-TW");
  await page.screenshot({
    path: resolve(outputDirectory, "flight-detail-i18n-zh-TW-desktop-1440.png"),
    fullPage: true,
  });

  await setLanguage("zh-CN");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: resolve(outputDirectory, "flight-detail-i18n-zh-CN-mobile-390.png"),
    fullPage: true,
  });
  await context.close();
} finally {
  await browser.close();
}
