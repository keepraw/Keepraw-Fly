import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(
  new URL("./generate-airline-icons.mjs", import.meta.url),
);

async function fixture(
  t,
  { rows, overrides = [], upstream, assets, pngs = {} },
) {
  const root = await mkdtemp(join(tmpdir(), "keepraw-airline-icons-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function put(path, content) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  await put("scripts/generate-airline-icons.mjs", await readFile(script));
  await put("packages/core/data/airlines.json", JSON.stringify(rows));
  await put(
    "packages/core/data/airline-overrides.json",
    JSON.stringify(overrides),
  );
  await put(
    "apps/web/node_modules/soaring-symbols/dist/airlines.json",
    JSON.stringify(upstream),
  );
  await mkdir(join(root, "apps/web/src/generated"), { recursive: true });
  for (const [path, content] of Object.entries(assets))
    await put(
      `apps/web/node_modules/soaring-symbols/dist/assets/${path}`,
      content,
    );
  for (const [code, content] of Object.entries(pngs))
    await put(`assets/airlines/${code}.png`, content);
  // An absent dataset path keeps the optional external PNG import disabled.
  const env = {
    ...process.env,
    AIRLINES_LOGOS_DATASET_DIR: join(root, "no-png-dataset"),
  };
  return {
    root,
    run: () =>
      spawnSync(
        process.execPath,
        [join(root, "scripts/generate-airline-icons.mjs")],
        { env, encoding: "utf8" },
      ),
    read: (path) => readFile(join(root, path), "utf8"),
  };
}

test("generates unique SVG-preferred mappings for exact effective IATA/ICAO matches", async (t) => {
  const f = await fixture(t, {
    rows: [
      ["AA", "OLD"],
      ["DY", "NOZ"],
      ["ZZ", "ZZZ"],
      ["BB", "BBB"],
    ],
    overrides: [["AA", "AAL"]],
    upstream: [
      { iata: "aa", icao: "aal", slug: "american" },
      { iata: "DY", icao: "NOZ", slug: "norwegian" },
      { iata: "ZZ", icao: "BAD", slug: "mismatch" },
      { iata: "CC", icao: "CCC", slug: "unknown" },
    ],
    assets: {
      "american/icon.svg": "<svg><title>American</title></svg>",
      "american/logo.svg": "<svg><title>Unused variant</title></svg>",
      "norwegian/logo-mono.svg": "<svg><title>Norwegian</title></svg>",
      "mismatch/icon.svg": "<svg/>",
      "unknown/icon.svg": "<svg/>",
    },
    pngs: { AA: "existing American PNG", BB: "existing supplement" },
  });
  const result = f.run();
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /4 local airline assets and 3 IATA mappings/);
  const index = await f.read("apps/web/src/generated/airline-icons.ts");
  assert.deepEqual(
    [...index.matchAll(/^  "(\w+)":/gm)].map((m) => m[1]),
    ["AA", "BB", "DY"],
  );
  assert.match(index, /"AA": \{ src: "\.\/assets\/airlines\/AA\.svg" \}/);
  assert.match(index, /"BB": \{ src: "\.\/assets\/airlines\/BB\.png" \}/);
  const files = await readdir(join(f.root, "assets/airlines"));
  assert.deepEqual(files.sort(), ["AA.png", "AA.svg", "BB.png", "DY.svg"]);
  for (const file of files)
    assert.equal(
      await f.read(`assets/airlines/${file}`),
      await f.read(`apps/web/public/assets/airlines/${file}`),
    );
  assert.equal(await f.read("assets/airlines/AA.png"), "existing American PNG");
  assert.match(await f.read("assets/airlines/AA.svg"), /American/);
  assert.match(await f.read("assets/airlines/DY.svg"), /Norwegian/);
  const repeated = f.run();
  assert.ifError(repeated.error);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.equal(await f.read("apps/web/src/generated/airline-icons.ts"), index);
});

test("rejects duplicate matching upstream designators instead of overwriting artwork", async (t) => {
  const f = await fixture(t, {
    rows: [["AA", "AAL"]],
    upstream: [
      { iata: "AA", icao: "AAL", slug: "first" },
      { iata: "AA", icao: "AAL", slug: "second" },
    ],
    assets: { "first/icon.svg": "first", "second/icon.svg": "second" },
  });
  const result = f.run();
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Duplicate matching Soaring Symbols IATA code: AA/,
  );
  assert.equal(await f.read("assets/airlines/AA.svg"), "first");
});
