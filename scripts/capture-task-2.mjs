import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { format } from "prettier";

const directory = "docs/visual-review/task-2";
const origin = "http://127.0.0.1:5173";
const approved = "docs/visual-review/task-1b-7b2/comp-control-fixed-dark.png";
const approvedHash =
  "c17d906dc74bd44d91e80f247bc784f6d41e6a19e083778dc2a54d07e8bf24d5";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const baseline = "fa3e10d457d84df96a47b59b4d1fd403451bc4a9";
const previous = JSON.parse(
  execFileSync("git", ["show", `${baseline}:${directory}/screenshots.json`], {
    encoding: "utf8",
  }),
);
const source = "packages/core/data/demo.keepraw-fly.json";
const sourceBytes = await readFile(source);
const demo = JSON.parse(sourceBytes);
const flown = demo.flights.filter((flight) => !flight.cancelled);
const arrivalDelay = (flight) =>
  flight.divertedTo || !flight.actualArrival
    ? null
    : Math.max(
        0,
        Math.round(
          (Date.parse(flight.actualArrival) -
            Date.parse(flight.scheduledArrival)) /
            60000,
        ),
      );
const sourceEvidence = {
  file: source,
  sha256: hash(sourceBytes),
  annualArrivals: [
    ...new Set(flown.map((flight) => flight.serviceDate.slice(0, 4))),
  ]
    .sort()
    .map((year) => ({
      year,
      records: flown
        .filter((flight) => flight.serviceDate.startsWith(year))
        .map((flight) => ({
          id: flight.id,
          scheduledArrival: flight.scheduledArrival,
          actualArrival: flight.actualArrival ?? null,
          minutes: arrivalDelay(flight),
        })),
    })),
  flownEndpoints: flown.map((flight) => ({
    id: flight.id,
    origin: flight.origin.iata,
    destination: (flight.divertedTo ?? flight.destination).iata,
  })),
  durationRecords: flown.map((flight) => ({
    id: flight.id,
    scheduledDeparture: flight.scheduledDeparture,
    scheduledArrival: flight.scheduledArrival,
    actualDeparture: flight.actualDeparture ?? null,
    actualArrival: flight.actualArrival ?? null,
  })),
};
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
          const visibleTextFits = [
            ...element.querySelectorAll(".passport-highlights *"),
          ]
            .filter((el) => !el.closest(".sr-only"))
            .every((el) =>
              [...el.childNodes]
                .filter(
                  (node) =>
                    node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
                )
                .every((node) => {
                  const range = document.createRange();
                  range.selectNodeContents(node);
                  return [...range.getClientRects()].every(
                    (rect) =>
                      rect.left >= highlights.left - 1 &&
                      rect.right <= highlights.right + 1 &&
                      rect.top >= highlights.top - 1 &&
                      rect.bottom <= highlights.bottom + 1,
                  );
                }),
            );
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
            controlsFit: [
              ...element.querySelectorAll(".map-zoom-controls button"),
            ].every((control) => {
              const rect = control.getBoundingClientRect();
              return (
                rect.left >= map.left &&
                rect.right <= map.right &&
                rect.top >= map.top &&
                rect.bottom <= map.bottom
              );
            }),
            highlightsFit: highlights.bottom <= box.bottom + 1,
            visibleTextFits,
            highlightData: {
              annualDelays: [
                ...element.querySelectorAll(".passport-delay-chart li"),
              ].map((el) => ({
                year: Number(el.dataset.year),
                minutes:
                  el.dataset.minutes === "unknown"
                    ? null
                    : Number(el.dataset.minutes),
                recordedArrivals: Number(el.dataset.recordedArrivals),
                barHeight:
                  el
                    .querySelector(".passport-delay-bar")
                    ?.style.getPropertyValue("--delay-height") ?? null,
              })),
              airports: [
                ...element.querySelectorAll(".passport-airport-rank"),
              ].map((el) => ({
                code: el.dataset.airport,
                visits: Number(el.dataset.visits),
                barWidth: el.querySelector(".passport-airport-track > span")
                  .style.width,
              })),
              longest: {
                endpoints: [
                  ...element.querySelectorAll(".passport-longest-endpoint"),
                ].map((el) => ({
                  iata: el.querySelector("strong").textContent,
                  city: el.querySelector("span").textContent,
                })),
                facts: [
                  ...element.querySelectorAll(".passport-longest-facts strong"),
                ].map((el) => el.textContent),
                containsMap: Boolean(
                  element.querySelector(
                    ".passport-longest-flight svg, .passport-longest-flight canvas, .passport-longest-flight img",
                  ),
                ),
              },
            },
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
      assert.ok(
        geometry.visibleTextFits,
        `Clipped highlight text at ${width}x${height}`,
      );
      assert.equal(geometry.highlightData.longest.containsMap, false);
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
        previousGeometry: (() => {
          const record = previous.records.find(
            (record) => record.file === file,
          );
          return {
            mapHeight: record.mapHeight,
            statsHeight: record.statsHeight,
            highlightsHeight: record.highlightsHeight,
          };
        })(),
        ...geometry,
      });
    }
  }
  assert.deepEqual(errors, []);
  assert.equal(hash(await readFile(approved)), approvedHash);
  await writeFile(
    `${directory}/screenshots.json`,
    await format(
      JSON.stringify(
        {
          method:
            "Unedited real-browser screenshots; repository Demo; Lifetime; en; kilometers; DPR1; reduced motion",
          browser: await browser.version(),
          task: "Task 2B — Statistics Visual Fidelity Pass",
          baseline,
          sourceEvidence,
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
      ),
      { parser: "json" },
    ),
  );
  console.log(
    `Captured ${records.length} screenshots; all geometry checks and approved reference hash passed.`,
  );
} finally {
  await browser.close();
}
