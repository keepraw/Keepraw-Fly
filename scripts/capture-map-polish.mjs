import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const stage = process.argv[2] ?? "before";
const outputRoot = process.env.MAP_SHOT_DIR
  ?? "C:/Users/Administrator/.codex/visualizations/2026/09/19/01a0b798-8d77-7622-80fb-aef5f4ae32e4/map-polish";
const outputDirectory = resolve(outputRoot, stage);
const baseUrl = process.env.MAP_BASE_URL ?? "http://127.0.0.1:5173/";
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});

await mkdir(outputDirectory, { recursive: true });

try {
  await capturePassportScreens();
  await captureDetailScreen();
} finally {
  await browser.close();
}

async function capturePassportScreens() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "en-US",
  });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.getByRole("button", { name: "Try demo" }).click();
  await setAppearance(page, "light");
  await page.getByRole("link", { name: "Passport" }).click();
  await page.locator(".map-country").first().waitFor();
  await positionMap(page, ".route-map");
  await page.screenshot({ path: resolve(outputDirectory, "passport.png") });

  const map = page.locator(".route-map-canvas");
  const bounds = await map.boundingBox();
  if (!bounds) throw new Error("Passport map bounds were not available");
  await page.mouse.move(bounds.x + bounds.width * 0.76, bounds.y + bounds.height * 0.44);
  await page.mouse.wheel(0, -450);
  await page.waitForTimeout(500);
  await page.mouse.move(bounds.x + bounds.width * 0.5, bounds.y + bounds.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.18, bounds.y + bounds.height * 0.72, { steps: 8 });
  await page.mouse.up();
  await page.mouse.move(20, 80);
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(outputDirectory, "passport-asia.png") });

  await page.getByRole("button", { name: "Show the whole world" }).click();
  await page.waitForTimeout(350);
  await setAppearance(page, "dark");
  await page.getByRole("link", { name: "Passport" }).click();
  await positionMap(page, ".route-map");
  await page.screenshot({ path: resolve(outputDirectory, "passport-dark.png") });

  await setAppearance(page, "light");
  await page.getByRole("link", { name: "Passport" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await positionMap(page, ".route-map");
  await page.screenshot({ path: resolve(outputDirectory, "passport-mobile.png") });
  await context.close();
}

async function captureDetailScreen() {
  const archivePath = resolve("examples/basic.keepraw-fly.json");
  const archive = JSON.parse(await readFile(archivePath, "utf8"));
  archive.flights[0] = {
    ...archive.flights[0],
    id: "example-zh9911-20260917",
    flightNumber: "ZH9911",
    serviceDate: "2026-09-17",
    airline: { iata: "ZH" },
    origin: { iata: "SZX", gate: "338" },
    destination: { iata: "TAO" },
    scheduledDeparture: "2026-09-17T20:45:00+08:00",
    scheduledArrival: "2026-09-18T00:05:00+08:00",
    actualDeparture: "2026-09-17T20:56:00+08:00",
    actualArrival: "2026-09-17T23:30:00+08:00",
    extensions: {},
  };

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "en-US",
  });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.locator('input[type="file"]').setInputFiles({
    name: "szx-tao.keepraw-fly.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("region", { name: "Review before importing" })
    .getByRole("button", { name: "Import this archive" }).click();
  await page.getByRole("button", { name: /Open ZH9911/ }).click();
  await page.locator(".detail-map-route").waitFor();
  await positionMap(page, ".detail-route-map");
  await page.screenshot({ path: resolve(outputDirectory, "flight-detail-szx-tao.png") });
  await context.close();
}

async function setAppearance(page, appearance) {
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByLabel("Appearance").selectOption(appearance);
}

async function positionMap(page, selector) {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  await page.evaluate((target) => {
    const node = document.querySelector(target);
    if (!node) return;
    const y = node.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top: Math.max(0, y) });
  }, selector);
  await page.waitForTimeout(500);
}
