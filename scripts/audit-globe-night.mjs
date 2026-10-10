import { chromium } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { nightRegions } from "./lib/globe-night-regions.mjs";
import { nightResponse } from "../apps/web/src/globe/globe-night-response.ts";
const folder = "docs/visual-review/task-1b-5";
await mkdir(folder, { recursive: true });
const metadata = JSON.parse(
  await readFile("apps/web/src/globe/globe-night-texture.source.json", "utf8"),
);
const sources = [
  {
    name: "NASA source",
    file: "artifacts/task-1b-5/BlackMarble_2016_3km_gray.jpg",
    expected: metadata.sourceSha256,
  },
  ...metadata.assets.map((a) => ({
    name: a.dimensions[0] + "",
    file: "apps/web/src/globe/" + a.file,
    expected: a.sha256,
  })),
];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const records = [];
try {
  const page = await browser.newPage();
  for (const item of sources) {
    const bytes = await readFile(item.file),
      sha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(sha256, item.expected);
    const audit = await page.evaluate(
      async ({ data, regions }) => {
        const image = new Image();
        image.src = `data:image/${data.kind};base64,${data.bytes}`;
        await image.decode();
        const canvas = document.createElement("canvas"),
          ctx = canvas.getContext("2d", { willReadFrequently: true });
        const result = [];
        for (const region of regions) {
          const [west, south, east, north] = region.bounds;
          const left = Math.floor(((west + 180) / 360) * image.width),
            right = Math.ceil(((east + 180) / 360) * image.width);
          const top = Math.floor(((90 - north) / 180) * image.height),
            bottom = Math.ceil(((90 - south) / 180) * image.height);
          canvas.width = right - left;
          canvas.height = bottom - top;
          ctx.drawImage(
            image,
            left,
            top,
            canvas.width,
            canvas.height,
            0,
            0,
            canvas.width,
            canvas.height,
          );
          const pixels = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;
          const histograms = {
            all: Array(256).fill(0),
            core: Array(256).fill(0),
            periphery: Array(256).fill(0),
          };
          let channelMismatch = 0;
          for (let y = 0; y < canvas.height; y++)
            for (let x = 0; x < canvas.width; x++) {
              const i = (y * canvas.width + x) * 4,
                value = pixels[i];
              if (pixels[i + 1] !== value || pixels[i + 2] !== value)
                channelMismatch++;
              const longitude = ((left + x + 0.5) / image.width) * 360 - 180,
                latitude = 90 - ((top + y + 0.5) / image.height) * 180;
              const core = region.cores.some(
                ([lon, lat]) =>
                  Math.abs(longitude - lon) <= 0.25 &&
                  Math.abs(latitude - lat) <= 0.25,
              );
              histograms.all[value]++;
              histograms[core ? "core" : "periphery"][value]++;
            }
          result.push({
            id: region.id,
            pixelBounds: [left, top, right, bottom],
            channelMismatch,
            histograms,
          });
        }
        // Check known city centers against both common mapping mistakes.
        // These are orientation controls; distributions above use neighborhoods.
        const sample = (lon, lat) => {
          canvas.width = 1;
          canvas.height = 1;
          ctx.drawImage(
            image,
            Math.floor(((lon + 180) / 360) * image.width),
            Math.floor(((90 - lat) / 180) * image.height),
            1,
            1,
            0,
            0,
            1,
            1,
          );
          return ctx.getImageData(0, 0, 1, 1).data[0] / 255;
        };
        const orientation = regions
          .filter((r) => !r.dark)
          .map((r) => {
            const [lon, lat] = r.cores[0];
            return {
              id: r.id,
              lon,
              lat,
              correct: sample(lon, lat),
              latitudeFlipped: sample(lon, -lat),
              longitudeFlipped: sample(-lon, lat),
            };
          });
        return {
          dimensions: [image.width, image.height],
          orientation,
          regions: result,
        };
      },
      {
        data: {
          kind: item.file.endsWith("jpg") ? "jpeg" : "webp",
          bytes: bytes.toString("base64"),
        },
        regions: nightRegions,
      },
    );
    records.push({ name: item.name, sha256, bytes: bytes.length, ...audit });
    for (const flip of ["latitudeFlipped", "longitudeFlipped"])
      assert.ok(
        audit.orientation.reduce((s, r) => s + r.correct, 0) >
          audit.orientation.reduce((s, r) => s + r[flip], 0) * 3,
        `Geographic orientation: ${item.name} / ${flip}`,
      );
  }
} finally {
  await browser.close();
}
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const b2 = (r) => 1.6 * Math.max(r - 0.012, 0) ** 0.85;
const b34 = (r) => {
  const s = Math.max(r - 0.012, 0),
    m = s ** 1.25;
  return ((0.13 * m) / (0.24 + m)) * smooth(0, 0.075, s);
};
const quantify = (hist, fn = (x) => x) => {
  const count = hist.reduce((a, b) => a + b, 0);
  if (!count) return { count: 0 };
  const quantile = (p, litOnly = false) => {
    const min = litOnly ? 4 : 0,
      n = hist.slice(min).reduce((a, b) => a + b, 0);
    if (!n) return 0;
    let a = 0;
    for (let i = min; i < 256; i++) {
      a += hist[i];
      if (a >= n * p) return fn(i / 255);
    }
    return fn(1);
  };
  return {
    count,
    zeroPercent: (hist[0] / count) * 100,
    nearZeroPercent:
      (hist.slice(0, 4).reduce((a, b) => a + b, 0) / count) * 100,
    mean: hist.reduce((s, n, i) => s + n * fn(i / 255), 0) / count,
    q50: quantile(0.5),
    q90: quantile(0.9),
    q99: quantile(0.99),
    max: quantile(1),
    litQ10: quantile(0.1, true),
    litQ50: quantile(0.5, true),
    litQ90: quantile(0.9, true),
  };
};
for (const texture of records)
  for (const region of texture.regions) {
    region.statistics = Object.fromEntries(
      Object.entries(region.histograms).map(([key, hist]) => [
        key,
        {
          input: quantify(hist),
          b2Response: quantify(hist, b2),
          b34Response: quantify(hist, b34),
          b5Response: quantify(hist, nightResponse),
        },
      ]),
    );
  }
await writeFile(
  `${folder}/texture-audit.json`,
  JSON.stringify(
    {
      source: metadata.source,
      sourceSha256: metadata.sourceSha256,
      mapping: metadata.projection,
      units:
        "normalized historical grayscale visualization, not calibrated radiance",
      nearZero: "0..3 /255; the existing .012 threshold removes these",
      regions: nightRegions,
      coreHalfWidthDegrees: 0.25,
      textures: records,
    },
    null,
    2,
  ) + "\n",
);
for (const texture of records)
  console.log(
    JSON.stringify({
      name: texture.name,
      regions: texture.regions.map((r) => ({
        id: r.id,
        zero: r.statistics.all.input.nearZeroPercent,
        core: r.statistics.core.input.litQ50,
        periphery: r.statistics.periphery.input.litQ50,
        p90: r.statistics.all.input.q90,
        oldLitMedian: r.statistics.periphery.b34Response.litQ50,
      })),
    }),
  );
