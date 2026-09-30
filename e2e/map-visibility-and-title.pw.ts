import { expect, test, type Page } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import type { KeeprawFlight } from "@keepraw-fly/schema";

// Layout fixtures use airport identities from the bundled offline directory.
function flight(origin: string, destination: string, index: number): KeeprawFlight {
  return {
    id: `layout-${index}`, flightNumber: `CX${100 + index}`, serviceDate: "2026-09-22",
    airline: { iata: "CX" }, origin: { iata: origin }, destination: { iata: destination },
    scheduledDeparture: "2026-09-22T02:00:00Z", scheduledArrival: "2026-09-22T12:00:00Z",
    actualDeparture: "2026-09-22T02:00:00Z", actualArrival: "2026-09-22T12:00:00Z",
  };
}

async function importFlights(page: Page, flights: KeeprawFlight[]) {
  const archive = JSON.parse(await readFile(new URL("../examples/basic.keepraw-fly.json", import.meta.url), "utf8"));
  archive.flights = flights;
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "route-layout.keepraw-fly.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(archive)),
  });
  await page.getByRole("button", { name: "Import this archive" }).click();
  await expect(page.locator(".flight-row")).toHaveCount(flights.length);
}

test("shows all twelve offline routes with visible frequency encoding in both themes", async ({ page, context }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  const pairs = [
    ["SZX", "TAO"], ["SHA", "PEK"], ["PEK", "CTU"], ["CTU", "KMG"],
    ["KMG", "BKK"], ["BKK", "SIN"], ["SIN", "HKG"], ["HKG", "BOM"],
    ["BOM", "DEL"], ["DEL", "DXB"], ["DXB", "DOH"], ["DOH", "LHR"],
  ];
  const flights = pairs.flatMap(([origin, destination], route) =>
    Array.from({ length: route === 0 ? 8 : 1 }, (_, visit) => flight(origin!, destination!, route * 10 + visit)),
  );
  await importFlights(page, flights);
  await mkdir("test-results/map-visibility", { recursive: true });

  for (const theme of ["light", "dark"]) {
    await context.setOffline(false);
    await page.goto("/#settings");
    await page.locator(".settings-display-fields select").nth(1).selectOption(theme);
    await page.goto("/#passport");
    await expect(page.locator(".map-route-line")).toHaveCount(12);
    await context.setOffline(true);
    await expect(page.locator(".passport-map-frequency-legend")).toBeVisible();
    await expect(page.locator(".passport-map-frequency-legend")).toContainText("Flights per route");
    await expect(page.locator(".passport-map-frequency-sample")).toHaveText(["1", "4", "8"]);

    const routes = await page.locator(".map-route-line").evaluateAll(elements => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      const luminance = (color: string) => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const rgb = Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722;
      };
      const map = document.querySelector(".route-map-canvas")!;
      const bounds = map.getBoundingClientRect();
      const backgrounds = ["ocean", "land", "visited-low", "visited-medium", "visited-high"]
        .map(key => luminance(getComputedStyle(map).getPropertyValue(`--color-map-${key}`)));
      return elements.map(element => {
        const style = getComputedStyle(element);
        const line = element.getBoundingClientRect();
        const foreground = luminance(style.stroke);
        return {
          label: element.parentElement!.getAttribute("aria-label"),
          width: parseFloat(style.strokeWidth), opacity: Number(style.opacity), color: style.stroke,
          vectorEffect: style.vectorEffect,
          contrast: Math.min(...backgrounds.map(background =>
            (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05))),
          inside: line.left >= bounds.left - 1 && line.right <= bounds.right + 1
            && line.top >= bounds.top - 1 && line.bottom <= bounds.bottom + 1,
        };
      });
    });
    for (const route of routes) {
      expect(route.width).toBeGreaterThanOrEqual(2.2);
      expect(route.opacity).toBe(1);
      expect(route.vectorEffect).toBe("non-scaling-stroke");
      expect(route.inside).toBe(true);
      expect(route.contrast).toBeGreaterThanOrEqual(3);
    }
    const frequent = routes.find(route => route.label?.startsWith("SZX to TAO"))!;
    const single = routes.find(route => route.label?.startsWith("HKG to BOM"))!;
    expect(frequent.width / single.width).toBeGreaterThan(1.7);
    expect(frequent.contrast).toBeGreaterThan(single.contrast);
    expect(frequent.color).not.toBe(single.color);
    await page.locator("#passport-flight-search").focus();
    await page.locator(".route-map").screenshot({ path: `test-results/map-visibility/routes-${theme}.png` });
    await page.screenshot({ path: `test-results/map-visibility/passport-${theme}-1440.png` });

    // Row hover retains a clear network, including routes flown just once.
    await page.locator('.flight-record[data-flight-id="layout-0"] .flight-row').hover();
    await expect(page.locator(".map-route.is-highlighted")).toHaveCount(1);
    const highlightWidth = await page.locator(".map-route.is-highlighted .map-route-line")
      .evaluate(element => parseFloat(getComputedStyle(element).strokeWidth));
    expect(highlightWidth).toBeGreaterThan(frequent.width);
    expect(await page.locator(".map-route.is-highlighted .map-route-underlay")
      .evaluate(element => parseFloat(getComputedStyle(element).strokeWidth))).toBeGreaterThan(highlightWidth);
    expect(await page.locator(".map-route-line").evaluateAll(elements =>
      Math.min(...elements.map(element => Number(getComputedStyle(element).opacity))),
    )).toBeGreaterThanOrEqual(0.8);
    await page.locator(".map-zoom-controls").getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.locator(".map-zoom-controls").getByRole("button", { name: "Fit recorded routes", exact: true }).click();
    await expect(page.locator(".map-route-line")).toHaveCount(12);
  }
});

test("keeps international title words whole at 390px across locales without changing desktop typography", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  const pairs = [["HKG", "BOM"], ["SHA", "TAO"], ["SFO", "LAX"], ["DEL", "HKG"], ["HKG", "JNB"], ["KUL", "BWN"], ["HKG", "TRV"]];
  await importFlights(page, pairs.map(([origin, destination], index) => flight(origin!, destination!, index)));
  await mkdir("test-results/title-wrapping", { recursive: true });

  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    await page.goto("/#settings");
    await page.locator(".settings-display-fields select").nth(0).selectOption(locale);
    await page.goto("/#passport");
    for (let index = 0; index < pairs.length; index++) {
      await page.locator(`.flight-record[data-flight-id="layout-${index}"] .flight-row`).click();
      const title = page.locator("#flight-detail-title");
      await expect(title).toBeVisible();
      await expect(title).toHaveCSS("text-wrap", "balance");
      const layout = await title.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const words: { text: string; lines: number; fits: boolean }[] = [];
        while (walker.nextNode()) {
          const node = walker.currentNode;
          // Latin words must occupy one line; CJK characters may wrap individually.
          for (const match of node.textContent!.matchAll(/[A-Za-z]+|[\u3400-\u9fff]/g)) {
            const range = document.createRange();
            range.setStart(node, match.index!);
            range.setEnd(node, match.index! + match[0].length);
            const rects = Array.from(range.getClientRects());
            words.push({ text: match[0], lines: new Set(rects.map(rect => Math.round(rect.top))).size,
              fits: rects.every(rect => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1),
            });
          }
        }
        const style = getComputedStyle(element);
        return { words, lineCount: Math.round(bounds.height / parseFloat(style.lineHeight)), textWrap: style.textWrap,
          fits: element.scrollWidth <= element.clientWidth && document.documentElement.scrollWidth <= innerWidth,
        };
      });
      expect(layout.fits).toBe(true);
      expect(layout.words.length).toBeGreaterThan(0);
      for (const word of layout.words) {
        expect(word.lines, `${locale} ${pairs[index]!.join(" → ")}: ${word.text}`).toBe(1);
        expect(word.fits, word.text).toBe(true);
      }
      expect(layout.textWrap).toBe("balance");
      if (locale === "en" && pairs[index]![0] === "KUL") expect(layout.lineCount).toBeGreaterThan(1);
      await page.screenshot({ path: `test-results/title-wrapping/${locale}-${pairs[index]!.join("-")}-390.png` });
      if (index === 0) {
        await page.setViewportSize({ width: 1440, height: 900 });
        await expect(title).toHaveCSS("font-size", "38px");
        const desktop = await title.evaluate(element => ({ fontSize: parseFloat(getComputedStyle(element).fontSize),
          lineHeight: parseFloat(getComputedStyle(element).lineHeight), textWrap: getComputedStyle(element).textWrap,
          fits: element.scrollWidth <= element.clientWidth,
        }));
        expect(desktop.fontSize).toBe(38);
        expect(desktop.lineHeight).toBeCloseTo(38 * 1.08);
        expect(desktop.textWrap).toBe("wrap");
        expect(desktop.fits).toBe(true);
        await page.screenshot({ path: `test-results/title-wrapping/${locale}-HKG-BOM-1440.png` });
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(title).toHaveCSS("text-wrap", "balance");
      }
      await page.locator(".detail-header-back").click();
    }
  }
});
