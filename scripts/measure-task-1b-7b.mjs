// Measures Task 1B-7B before/after PNGs in a real browser canvas (no mockups).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const DIR = path.join(process.cwd(), "docs", "visual-review", "task-1b-7b");
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;
const pairs = [
  ["before-fixed-dark.png", "after-fixed-dark.png"],
  ["before-fixed-light.png", "after-fixed-light.png"],
  ["before-passport-dark.png", "after-passport-dark.png"],
  ["before-passport-light.png", "after-passport-light.png"],
  ["before-realtime-dark.png", "after-realtime-dark.png"],
  ["before-realtime-light.png", "after-realtime-light.png"],
];

const browser = await chromium.launch(executablePath ? { executablePath } : {});
try {
  const page = await browser.newPage();
  await page.goto("about:blank");
  const results = {};
  for (const [a, b] of pairs) {
    const [ba, bb] = await Promise.all([
      readFile(path.join(DIR, a)).then((v) => v.toString("base64")),
      readFile(path.join(DIR, b)).then((v) => v.toString("base64")),
    ]);
    const stats = await page.evaluate(
      async ({ ba, bb }) => {
        async function load(data) {
          const img = new Image();
          img.src = `data:image/png;base64,${data}`;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0);
          return {
            img,
            data: ctx.getImageData(0, 0, c.width, c.height).data,
            w: c.width,
            h: c.height,
          };
        }
        const A = await load(ba);
        const B = await load(bb);
        const n = A.w * A.h;
        let changed = 0;
        let sumA = 0,
          sumB = 0,
          sumBlueA = 0,
          sumBlueB = 0;
        let sumR_A = 0,
          sumG_A = 0,
          sumB_A = 0,
          sumR_B = 0,
          sumG_B = 0,
          sumB_B = 0;
        for (let i = 0; i < A.data.length; i += 4) {
          const rA = A.data[i],
            gA = A.data[i + 1],
            bA = A.data[i + 2];
          const rB = B.data[i],
            gB = B.data[i + 1],
            bB = B.data[i + 2];
          if (
            Math.max(Math.abs(rA - rB), Math.abs(gA - gB), Math.abs(bA - bB)) >
            2
          )
            changed++;
          sumA += 0.2126 * rA + 0.7152 * gA + 0.0722 * bA;
          sumB += 0.2126 * rB + 0.7152 * gB + 0.0722 * bB;
          sumBlueA += bA - Math.max(rA, gA);
          sumBlueB += bB - Math.max(rB, gB);
          sumR_A += rA;
          sumG_A += gA;
          sumB_A += bA;
          sumR_B += rB;
          sumG_B += gB;
          sumB_B += bB;
        }
        return {
          width: A.w,
          height: A.h,
          pixels: n,
          changed,
          changedPct: changed / n,
          meanLumA: sumA / n,
          meanLumB: sumB / n,
          meanBlueExcessA: sumBlueA / n,
          meanBlueExcessB: sumBlueB / n,
          meanRGB_A: [sumR_A / n, sumG_A / n, sumB_A / n],
          meanRGB_B: [sumR_B / n, sumG_B / n, sumB_B / n],
        };
      },
      { ba, bb },
    );
    results[`${a} vs ${b}`] = stats;
    console.log(
      `${a} vs ${b}: changed ${(stats.changedPct * 100).toFixed(2)}% (${stats.changed}/${stats.pixels}), lum ${stats.meanLumA.toFixed(2)}→${stats.meanLumB.toFixed(2)} (Δ${(stats.meanLumB - stats.meanLumA).toFixed(2)}), blueExcess ${stats.meanBlueExcessA.toFixed(2)}→${stats.meanBlueExcessB.toFixed(2)} (Δ${(stats.meanBlueExcessB - stats.meanBlueExcessA).toFixed(2)}), RGB ${stats.meanRGB_A.map((v) => v.toFixed(1)).join(",")}→${stats.meanRGB_B.map((v) => v.toFixed(1)).join(",")}`,
    );
  }
  await writeFile(
    path.join(DIR, "pixel-comparison.json"),
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
