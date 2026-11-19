import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const requireWeb = createRequire(new URL("apps/web/package.json", root));
const vitePath = requireWeb.resolve("vite");
const { createServer, normalizePath } = await import(vitePath);
const server = await createServer({
  root: fileURLToPath(new URL("apps/web", root)),
  server: { middlewareMode: true, watch: null },
});

function sample(work, iterations) {
  const results = [];
  work(0);
  for (let run = 0; run < 5; run++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) work(i);
    results.push((performance.now() - start) / iterations);
  }
  return results.sort((a, b) => a - b)[2];
}

try {
  const started = performance.now();
  const source = new URL("packages/core/src/index.ts", root);
  const core = await server.ssrLoadModule(
    "/@fs/" + normalizePath(fileURLToPath(source)).replace(/^\//, ""),
  );
  const coreLoaded = performance.now();
  const data = new URL("packages/core/data/", root);
  const directory = JSON.parse(
    await readFile(new URL("airports.iata.json", data), "utf8"),
  );
  core.installAirportDirectory(directory);
  const directoryReady = performance.now();
  core.searchAirports("青島膠東", "ja-JP");
  const indexReady = performance.now();
  const queries = [
    "TAO",
    "VHHH",
    "frankfurt",
    "청주",
    "成田",
    "Lianyungang",
    "aeroporto",
    "san francisco",
  ];
  const codes = core.formalAssignments;
  const searchMs = sample(
    (i) => core.searchAirports(queries[i % queries.length], "en-US"),
    500,
  );
  const resolveMs = sample((i) => {
    const { code, scheme } = codes[i % codes.length];
    core.resolveAirportAtDate(code, "2024-06-15", scheme);
  }, 20000);
  const bytes = async (path) => (await stat(new URL(path, data))).size;

  console.log(
    JSON.stringify({
      node: process.version,
      formalBytes: await bytes("airport-history/formal/airports.json"),
      directoryBytes: await bytes("airport-history/formal/directory.json"),
      localizationBytes: await bytes("airport-names.json"),
      coreLoadMs: coreLoaded - started,
      directoryInstallMs: directoryReady - coreLoaded,
      firstSearchMs: indexReady - directoryReady,
      medianWarmSearchMs: searchMs,
      medianResolveMicroseconds: 1000 * resolveMs,
    }),
  );
} finally {
  await server.close();
}
