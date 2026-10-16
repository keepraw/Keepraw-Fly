// Run from the repository root. Uses source modules, not a production build.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import { chromium } from "@playwright/test";

const requireWeb = createRequire(
  new URL("../apps/web/package.json", import.meta.url),
);
const { createServer } = await import(requireWeb.resolve("vite"));
const server = await createServer({
  root: "apps/web",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
let browser;
try {
  await server.listen();
  const csv = await server.ssrLoadModule("/src/data/csv-import.ts");
  const core = await server.ssrLoadModule(
    "/@fs" + process.cwd() + "/packages/core/src/index.ts",
  );
  const { default: airports } = await server.ssrLoadModule(
    "/@fs" + process.cwd() + "/packages/core/data/airports.iata.json",
  );
  core.installAirportDirectory(airports);
  const fixtures = [100, 500].map((count) => ({
    count,
    // Unique dates and flight numbers avoid benefiting from repeated input times.
    text: [
      "flightNumber,serviceDate,originIata,destinationIata,scheduledDeparture,scheduledArrival",
      ...Array.from({ length: count }, (_, i) => {
        const date = new Date(Date.UTC(2024, 0, i + 1))
          .toISOString()
          .slice(0, 10);
        return `UA${i + 1},${date},JFK,LAX,${date}T09:00,${date}T12:00`;
      }),
    ].join("\n"),
  }));
  function measure(api, fixture) {
    const parsed = api.parseCsv(fixture.text);
    const mapping = api.detectCsvMapping(parsed.headers);
    const samples = [];
    for (let run = 0; run < 4; run++) {
      let id = 0;
      const start = performance.now();
      const result = api.preflightCsvImport(parsed, mapping, null, () =>
        String(++id),
      );
      const elapsed = performance.now() - start;
      assert.equal(result.canImport, true);
      assert.equal(result.newRecords, fixture.count);
      if (run) samples.push(elapsed); // One warm-up, three measured runs.
    }
    return {
      rows: fixture.count,
      samplesMs: samples,
      medianMs: [...samples].sort((a, b) => a - b)[1],
    };
  }
  console.log(
    JSON.stringify({
      node: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      cpu: os.cpus()[0]?.model,
      logicalCpus: os.cpus().length,
    }),
  );
  for (const fixture of fixtures)
    console.log(JSON.stringify({ runtime: "Node", ...measure(csv, fixture) }));
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_EXECUTABLE_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5173");
  console.log(
    JSON.stringify({
      runtime: "Chromium",
      version: browser.version(),
      cpuThrottling: "none",
    }),
  );
  for (const fixture of fixtures) {
    const result = await page.evaluate(
      async ({ fixture, root }) => {
        const api = await import("/src/data/csv-import.ts");
        const core = await import(`/@fs${root}/packages/core/src/index.ts`);
        const { default: airports } = await import(
          `/@fs${root}/packages/core/data/airports.iata.json`
        );
        core.installAirportDirectory(airports);
        const parsed = api.parseCsv(fixture.text);
        const mapping = api.detectCsvMapping(parsed.headers);
        const samples = [];
        for (let run = 0; run < 4; run++) {
          let id = 0;
          const start = performance.now();
          const result = api.preflightCsvImport(parsed, mapping, null, () =>
            String(++id),
          );
          const elapsed = performance.now() - start;
          if (!result.canImport || result.newRecords !== fixture.count)
            throw new Error("Invalid benchmark fixture");
          if (run) samples.push(elapsed);
        }
        const batched = [];
        if (api.preflightCsvImportWork) {
          const { runImportPreflight } =
            await import("/src/data/import-preflight-work.ts");
          for (let run = 0; run < 4; run++) {
            let id = 0;
            let beats = 0;
            let maxTimerGapMs = 0;
            let previous = performance.now();
            const timer = setInterval(() => {
              const now = performance.now();
              maxTimerGapMs = Math.max(maxTimerGapMs, now - previous);
              previous = now;
              beats++;
            }, 0);
            const start = performance.now();
            const result = await runImportPreflight(
              api.preflightCsvImportWork(parsed, mapping, null, () =>
                String(++id),
              ),
            );
            const elapsed = performance.now() - start;
            clearInterval(timer);
            if (!result.canImport || result.newRecords !== fixture.count)
              throw new Error("Invalid batched fixture");
            if (run) batched.push({ elapsedMs: elapsed, maxTimerGapMs, beats });
          }
        }
        return {
          rows: fixture.count,
          samplesMs: samples,
          medianMs: [...samples].sort((a, b) => a - b)[1],
          batched,
        };
      },
      { fixture, root: process.cwd() },
    );
    console.log(JSON.stringify({ runtime: "Chromium", ...result }));
  }
} finally {
  await browser?.close();
  await server.close();
}
