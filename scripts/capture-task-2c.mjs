import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { format } from "prettier";
import {
  passportTypographyBounds,
  waitForTypography,
} from "./passport-typography-evidence.mjs";

const directory = "docs/visual-review/task-2c";
const fixture = "e2e/fixtures/chinese-passport.keepraw-fly.json";
const origin = "http://127.0.0.1:5173";
const sizes = [
  [1646, 928],
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1024, 768],
  [761, 900],
];
const sha = (b) => createHash("sha256").update(b).digest("hex");
await mkdir(directory, { recursive: true });
const records = [],
  resources = [],
  fonts = [],
  shifts = [],
  screenshots = [];
const pending = [];
const cssMetadata = [];
const root = "https://cdn.jsdelivr.net/npm/misans-webfont@4.3.1";
for (const [folder, prefix] of [
  ["misans", "misans"],
  ["misans-tc", "misanstc"],
])
  for (const weight of ["regular", "medium", "semibold"]) {
    const url = `${root}/${folder}/${prefix}-${weight}/result.min.css`;
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const css = await response.text();
    cssMetadata.push({
      url,
      status: response.status,
      bytes: Buffer.byteLength(css),
      sha256: sha(css),
      families: [
        ...new Set([...css.matchAll(/font-family:([^;}]+)/g)].map((m) => m[1])),
      ],
      weights: [
        ...new Set([...css.matchAll(/font-weight:([^;}]+)/g)].map((m) => m[1])),
      ],
      display: [
        ...new Set(
          [...css.matchAll(/font-display:([^;}]+)/g)].map((m) => m[1]),
        ),
      ],
      unicodeRanges: (css.match(/unicode-range:/g) || []).length,
    });
    assert(css.includes("font-display:swap"));
    assert(css.includes("unicode-range:"));
  }

for (const zoom of [1, 1.25]) {
  const profile = resolve(
    `artifacts/task-2c-capture-profile-${zoom}-${Date.now()}`,
  );
  await mkdir(`${profile}/Default`, { recursive: true });
  await writeFile(
    `${profile}/Default/Preferences`,
    JSON.stringify({
      partition: { default_zoom_level: { x: Math.log(zoom) / Math.log(1.2) } },
    }),
  );
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chrome",
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const cdp = await context.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    await cdp.send("CSS.setLocalFontsEnabled", { enabled: false });
    await page.addInitScript(() => {
      window.__fontShifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.__fontShifts.push(entry.value);
      }).observe({ type: "layout-shift", buffered: true });
    });
    page.on("response", (r) => {
      if (r.url().includes("misans-webfont"))
        pending.push(
          (async () => {
            const body = await r.body();
            resources.push({
              url: r.url(),
              status: r.status(),
              bytes: body.length,
              sha256: sha(body),
              type: r.request().resourceType(),
            });
          })(),
        );
    });
    let gate = null;
    await page.route(`${root}/**/result.min.css`, async (route) => {
      if (gate) {
        await new Promise((r) => {
          gate.releases.push(r);
          if (gate.releases.length === 3) gate.ready();
        });
      }
      await route.continue();
    });
    await page.goto(origin);
    await page.locator('input[type="file"]').setInputFiles(fixture);
    await page
      .getByRole("button", { name: "Import this archive", exact: true })
      .click();
    assert.equal(await page.locator("link[data-chinese-webfont]").count(), 0);
    for (const language of ["zh-CN", "zh-TW", "en"])
      for (const theme of ["dark", "light"]) {
        const firstLocaleLoad =
          language !== "en" &&
          (await page
            .locator(`link[data-chinese-webfont^="${language}"]`)
            .count()) === 0;
        let ready;
        if (firstLocaleLoad) {
          ready = new Promise((resolve) => {
            gate = { releases: [], ready: resolve };
          });
        }
        await page.goto(`${origin}/#settings`);
        await page
          .locator(".settings-fields select")
          .nth(0)
          .selectOption(language);
        await page
          .locator(".settings-fields select")
          .nth(1)
          .selectOption(theme);
        await page
          .locator(".settings-fields select")
          .nth(2)
          .selectOption("kilometers");
        await page.goto(`${origin}/#passport`);
        if (firstLocaleLoad) {
          await page.waitForFunction(
            (locale) =>
              document.querySelectorAll(
                `link[data-chinese-webfont^="${locale}"]`,
              ).length === 3,
            language,
          );
          await ready;
          const before = await passportTypographyBounds(page);
          gate.releases.forEach((r) => r());
          gate = null;
          await waitForTypography(page, language);
          const after = await passportTypographyBounds(page);
          shifts.push({
            zoom,
            language,
            theme,
            before,
            after,
            cls: await page.evaluate(() =>
              window.__fontShifts.reduce((a, b) => a + b, 0),
            ),
          });
        } else await waitForTypography(page, language);
        for (const [width, height] of sizes) {
          await page.setViewportSize({ width, height });
          const actual = await page.evaluate(() => ({
            width: innerWidth,
            height: innerHeight,
            dpr: devicePixelRatio,
          }));
          assert.equal(actual.dpr, zoom);
          if (actual.width <= 760) {
            assert.equal(await page.locator(".passport-highlights").count(), 0);
            records.push({
              zoom,
              language,
              theme,
              physicalViewport: [width, height],
              mobile: true,
              viewport: actual,
              documentWidthFits: await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
            });
            continue;
          }
          await waitForTypography(page, language);
          await page.locator(".map-zoom-controls button").last().click();
          await page.mouse.move(0, 0);
          await waitForTypography(page, language);
          const bounds = await passportTypographyBounds(page);
          records.push({
            zoom,
            language,
            theme,
            physicalViewport: [width, height],
            bounds,
          });
          assert(
            bounds.documentFits,
            `${zoom}/${language}/${theme}/${width}: document overflow`,
          );
          assert(
            bounds.singleScreen,
            `${zoom}/${language}/${theme}/${width}: right side requires scrolling`,
          );
          assert.deepEqual(
            bounds.failures,
            [],
            `${zoom}/${language}/${theme}/${width}: text or clipping`,
          );
          assert(bounds.controlsContained);
          assert.equal(bounds.longestHasMap, false);
          assert.equal(bounds.kpis.length, 6);
          if (
            zoom === 1 &&
            ((language !== "en" && [1440, 1646].includes(width)) ||
              (language === "en" && width === 1440))
          ) {
            const file = `passport-${language}-${theme}-${width}x${height}.png`;
            const bytes = await page.screenshot({
              path: `${directory}/${file}`,
            });
            screenshots.push({
              file,
              language,
              theme,
              viewport: [width, height],
              sha256: sha(bytes),
            });
          }
        }
        if (language !== "en" && theme === "light" && zoom === 1) {
          const { root: dom } = await cdp.send("DOM.getDocument");
          for (const selector of [
            ".passport-map-title",
            ".flight-route-cities",
            ".passport-airport-name",
            ".passport-core-stat .statistic-unit",
          ]) {
            const { nodeId } = await cdp.send("DOM.querySelector", {
              nodeId: dom.nodeId,
              selector,
            });
            fonts.push({
              language,
              selector,
              ...(await cdp.send("CSS.getPlatformFontsForNode", { nodeId })),
            });
          }
          fonts.push({
            language,
            loadedFaces: await page.evaluate(() =>
              [...document.fonts]
                .filter((f) => f.status === "loaded")
                .map((f) => ({
                  family: f.family,
                  weight: f.weight,
                  display: f.display,
                })),
            ),
          });
        }
      }
  } finally {
    await context.close();
  }
  console.log(
    `Native browser zoom ${zoom * 100}%: locale/theme/viewport matrix completed.`,
  );
}
await Promise.all(pending);
for (const metadata of cssMetadata) {
  const path = metadata.url.replace("/result.min.css", "/");
  assert(
    resources.some(
      (r) =>
        r.url.startsWith(path) &&
        r.url.endsWith(".woff2") &&
        r.status === 200 &&
        r.bytes > 0,
    ),
    `No actual WOFF2 for ${path}`,
  );
}
for (const language of ["zh-CN", "zh-TW"])
  assert(
    fonts
      .filter((f) => f.language === language && f.fonts)
      .some((f) => f.fonts.some((p) => p.isCustomFont)),
    `${language}: no downloaded font used for glyphs`,
  );
const control = "docs/visual-review/task-1b-7b2/comp-control-fixed-dark.png";
const approved =
  "c17d906dc74bd44d91e80f247bc784f6d41e6a19e083778dc2a54d07e8bf24d5";
assert.equal(sha(await readFile(control)), approved);
const result = {
  task: "Task 2C — MiSans Webfont Integration & Chinese Desktop UI Refinement",
  baseline: "b54f1b04f936bf227f1c3882a4aee58163df2647",
  version: {
    original: "4.003.1",
    originalUrlsStatus: 404,
    ownerApprovedCorrection: "4.3.1",
  },
  source: {
    file: fixture,
    sha256: sha(await readFile(fixture)),
    synthetic: true,
    flights: 12,
  },
  localFontFaceSourcesDisabledForNetworkEvidence: true,
  zoomMethod:
    "Native Chromium partition.default_zoom_level.x = log(factor)/log(1.2); confirmed devicePixelRatio and effective CSS viewport. No CSS zoom or DPR-only emulation.",
  approvedControl: { file: control, sha256: approved },
  cssMetadata,
  resources: [...new Map(resources.map((r) => [r.url, r])).values()],
  fonts,
  shifts,
  records,
  screenshots,
};
await writeFile(
  `${directory}/browser-evidence.json`,
  await format(JSON.stringify(result), { parser: "json" }),
);
console.log(
  `${screenshots.length} final screenshots; ${records.length} layout records; all six CSS/WOFF2 groups verified.`,
);
