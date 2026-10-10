// Recapture clean B/C unselected + proper selected routes.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const BASE = process.env.GLOBE_LAB_URL ?? "http://127.0.0.1:5173/globe-lab";
const PREFIX = "comp-clean";
const OUT_DIR = path.join(process.cwd(), "docs", "visual-review", "task-1b-7b2");
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;

function spherePoint(lat, lon) {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)];
}
const VIEWS = {
  "B-europe-asia": { direction: spherePoint(30, 85), distance: 2.45, offset: { x: 0, y: -0.5 } },
  "C-close-asia": { direction: spherePoint(24, 112), distance: 1.75, offset: { x: 0, y: -0.45 } },
};
const SELECTED = { "B-europe-asia": "LHR-SIN", "C-close-asia": "PEK-PVG" };

async function shoot(page, name) {
  const lighting = JSON.parse(await page.locator(".globe-host").getAttribute("data-lighting"));
  const sc = JSON.parse(await page.locator(".globe-host").getAttribute("data-scene"));
  const camera = JSON.parse(await page.locator(".globe-host").getAttribute("data-camera"));
  const file = path.join(OUT_DIR, `${PREFIX}-${name}.png`);
  await page.locator(".globe-stage").screenshot({ path: file });
  const bytes = await readFile(file);
  return { file: `${PREFIX}-${name}.png`, sha256: createHash("sha256").update(bytes).digest("hex"), theme: lighting.theme, sunDirection: lighting.sunDirection, lighting: { sunIntensity: lighting.sunIntensity, nightIntensity: lighting.nightIntensity, atmosphereIntensity: lighting.atmosphereIntensity }, camera, atHome: sc.atHome };
}
async function flyTo(page, view) {
  await page.locator(".globe-host").evaluate((h, v) => h.globeReviewView(v), view);
  await page.waitForTimeout(900);
}
const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "en-US" });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  const records = [];
  for (const key of Object.keys(VIEWS)) {
    await page.goto(BASE);
    await page.locator(".globe-host[data-ready=true]").waitFor({ timeout: 25000 });
    await page.waitForTimeout(500);
    await page.getByRole("radio", { name: "Fixed", exact: true }).check();
    await flyTo(page, VIEWS[key]);
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.waitForTimeout(400);
    records.push(await shoot(page, `${key}-fixed-dark`));
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await page.waitForTimeout(400);
    records.push(await shoot(page, `${key}-fixed-light`));
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.getByRole("combobox", { name: "Route", exact: true }).selectOption(SELECTED[key]);
    await page.waitForTimeout(900);
    // For B, keep selectedRouteView (shows Europe-Asia arc); for C, re-assert close framing to show central red.
    if (key === "C-close-asia") { await flyTo(page, VIEWS[key]); await page.waitForTimeout(300); }
    records.push(await shoot(page, `${key}-selected-${SELECTED[key]}-dark`));
  }
  await writeFile(path.join(OUT_DIR, `${PREFIX}-manifest.json`), JSON.stringify({ prefix: PREFIX, records }, null, 2));
  console.log(JSON.stringify(records, null, 2));
} finally { await browser.close(); }
