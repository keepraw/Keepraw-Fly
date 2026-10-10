import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const directory = "docs/visual-review/task-2";
const origin = "http://127.0.0.1:5173";
const approved = "docs/visual-review/task-1b-7b2/comp-control-fixed-dark.png";
const approvedHash =
  "c17d906dc74bd44d91e80f247bc784f6d41e6a19e083778dc2a54d07e8bf24d5";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(hash(await readFile(approved)), approvedHash);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : { channel: "chrome" }),
  headless: true,
});
const records = [];
const errors = [];
try {
  const page = await browser.newPage({
    locale: "en-US",
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto(origin);
  await page.getByRole("button", { name: "Try demo", exact: true }).click();
  for (const theme of ["dark", "light"]) {
    await page.goto(`${origin}/#settings`);
    await page
      .getByRole("combobox", { name: "Appearance", exact: true })
      .selectOption(theme);
    await page
      .getByRole("combobox", { name: "Distance", exact: true })
      .selectOption("kilometers");
    await page.goto(`${origin}/#passport`);
    for (const [width, height] of [
      [1440, 900],
      [1366, 768],
      [1280, 720],
      [1024, 768],
      [761, 900],
    ]) {
      await page.setViewportSize({ width, height });
      await page.locator(".map-relief-texture:visible").waitFor();
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((image) => image.decode().catch(() => {})),
        );
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      });
      const geometry = await page
        .locator(".passport-visual-sticky")
        .evaluate((element) => {
          const box = element.getBoundingClientRect();
          const map = element
            .querySelector(".route-map")
            .getBoundingClientRect();
          const stats = element
            .querySelector(".passport-core-stats")
            .getBoundingClientRect();
          const highlights = element
            .querySelector(".passport-highlights")
            .getBoundingClientRect();
          return {
            pageWidth: document.documentElement.scrollWidth,
            pageHeight: document.documentElement.scrollHeight,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
            mapHeight: map.height,
            statsHeight: stats.height,
            highlightsHeight: highlights.height,
            controlsFit:
              element
                .querySelector(".map-zoom-controls")
                .getBoundingClientRect().bottom <= map.bottom,
            highlightsFit: highlights.bottom <= box.bottom + 1,
            metrics: [...element.querySelectorAll(".passport-core-stat")].map(
              (el) => el.textContent,
            ),
            highlights: [
              ...element.querySelector(".passport-spotlight").children,
            ].map((el) => el.textContent),
          };
        });
      assert.ok(geometry.pageWidth <= width && geometry.pageHeight <= height);
      assert.ok(
        geometry.scrollWidth <= geometry.clientWidth + 1 &&
          geometry.scrollHeight <= geometry.clientHeight + 1,
      );
      assert.ok(geometry.controlsFit && geometry.highlightsFit);
      assert.equal(geometry.metrics.length, 6);
      assert.equal(geometry.highlights.length, 3);
      const file = `passport-${theme}-${width}x${height}.png`;
      const bytes = await page.screenshot({ path: `${directory}/${file}` });
      records.push({
        file,
        sha256: hash(bytes),
        bytes: bytes.length,
        theme,
        viewport: { width, height },
        ...geometry,
      });
    }
  }
  assert.deepEqual(errors, []);
  assert.equal(hash(await readFile(approved)), approvedHash);
  await writeFile(
    `${directory}/screenshots.json`,
    JSON.stringify(
      {
        method:
          "Unedited real-browser screenshots; repository Demo; Lifetime; en; kilometers; DPR1; reduced motion",
        browser: await browser.version(),
        approvedReference: {
          file: approved,
          sha256: approvedHash,
          unchanged: true,
        },
        errors,
        records,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Captured ${records.length} screenshots; all geometry checks and approved reference hash passed.`,
  );
} finally {
  await browser.close();
}
