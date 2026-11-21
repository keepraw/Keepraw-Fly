import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { worldMapGeneratorVersions } from "./world-map-versions.mjs";

async function temporaryRoot(t) {
  const root = await mkdtemp(join(tmpdir(), "keepraw-map-versions-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function packageFixture(t) {
  const root = await temporaryRoot(t);
  async function install(path, name, version) {
    const directory = join(root, path);
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(
      join(directory, "package.json"),
      JSON.stringify({
        name,
        version,
        type: "module",
        exports: "./src/index.js",
      }),
    );
    await writeFile(join(directory, "src/index.js"), "export {};");
  }
  const geo = "node_modules/d3-geo";
  const array = `${geo}/node_modules/d3-array`;
  const internmap = `${array}/node_modules/internmap`;
  await install(geo, "d3-geo", "3.1.2");
  await install(array, "d3-array", "3.2.4");
  await install(internmap, "internmap", "2.0.3");
  // Decoys: provenance must follow the generator's actual transitive resolution.
  await install("node_modules/d3-array", "d3-array", "0.0.1");
  await install("node_modules/internmap", "internmap", "0.0.2");
  return {
    root,
    from: pathToFileURL(join(root, "generator.mjs")),
    install,
    geo,
    array,
    internmap,
  };
}

test("records the installed direct dependency version, not a declared or hard-coded version", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../node_modules/d3-geo/package.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(worldMapGeneratorVersions().d3Geo, manifest.version);
});

test("follows installed dependency upgrades and their nested dependencies", async (t) => {
  const f = await packageFixture(t);
  assert.deepEqual(worldMapGeneratorVersions(f.from), {
    d3Geo: "3.1.2",
    d3Array: "3.2.4",
    internmap: "2.0.3",
  });
  await f.install(f.geo, "d3-geo", "4.0.0");
  await f.install(f.array, "d3-array", "4.1.0");
  await f.install(f.internmap, "internmap", "3.0.0");
  assert.deepEqual(worldMapGeneratorVersions(f.from), {
    d3Geo: "4.0.0",
    d3Array: "4.1.0",
    internmap: "3.0.0",
  });
});

for (const version of [undefined, "", "not-a-version", 3]) {
  test(`fails explicitly when the installed version cannot be confirmed: ${version}`, async (t) => {
    const f = await packageFixture(t);
    await f.install(f.geo, "d3-geo", version);
    assert.throws(
      () => worldMapGeneratorVersions(f.from),
      /Cannot confirm the installed d3-geo version/,
    );
  });
}

test("fails rather than guessing when the package or manifest is missing", async (t) => {
  const root = await temporaryRoot(t);
  assert.throws(
    () => worldMapGeneratorVersions(pathToFileURL(join(root, "generator.mjs"))),
    /Cannot find module 'd3-geo'/,
  );
  const f = await packageFixture(t);
  await f.install(f.geo, "wrong-package-name", "3.1.2");
  assert.throws(
    () => worldMapGeneratorVersions(f.from),
    /Cannot find the installed d3-geo manifest/,
  );
});

test("the normal generator writes accurate provenance and license versions in an isolated fixture", async (t) => {
  const root = await temporaryRoot(t);
  await mkdir(join(root, "scripts"));
  for (const name of ["update-world-map.mjs", "world-map-versions.mjs"])
    await cp(new URL(name, import.meta.url), join(root, "scripts", name));
  await symlink(
    fileURLToPath(new URL("../node_modules", import.meta.url)),
    join(root, "node_modules"),
    "junction",
  );
  const countries = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { ISO_A2: "US", NAME_EN: "Fixture" },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-120, 30],
              [-120, 40],
              [-110, 40],
              [-110, 30],
              [-120, 30],
            ],
          ],
        },
      },
    ],
  };
  const requests = join(root, "requests.jsonl");
  const preload = join(root, "fetch-fixture.mjs");
  await writeFile(
    preload,
    `
    import { appendFileSync } from "node:fs";
    globalThis.fetch = async (url) => {
      appendFileSync(${JSON.stringify(requests)}, JSON.stringify(url) + "\\n");
      return { ok: true, text: async () => url.endsWith(".geojson") ? ${JSON.stringify(JSON.stringify(countries))} : "Fixture license\\n" };
    };
  `,
  );
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      pathToFileURL(preload).href,
      join(root, "scripts/update-world-map.mjs"),
    ],
    { encoding: "utf8" },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const versions = worldMapGeneratorVersions();
  const metadata = JSON.parse(
    await readFile(
      join(root, "apps/web/src/data/world-map.source.json"),
      "utf8",
    ),
  );
  assert.equal(metadata.d3Geo.version, versions.d3Geo);
  assert.equal(
    metadata.d3Geo.source,
    `https://github.com/d3/d3-geo/tree/v${versions.d3Geo}`,
  );
  assert.deepEqual(
    metadata.d3Geo.bundledDependencies.map(({ version }) => version),
    [versions.d3Array, versions.internmap],
  );
  const urls = (await readFile(requests, "utf8"))
    .trim()
    .split("\n")
    .map(JSON.parse);
  assert.ok(
    urls.includes(
      `https://raw.githubusercontent.com/d3/d3-geo/v${versions.d3Geo}/LICENSE`,
    ),
  );
  assert.ok(
    urls.includes(
      `https://raw.githubusercontent.com/d3/d3-array/v${versions.d3Array}/LICENSE`,
    ),
  );
  assert.ok(
    urls.includes(
      `https://raw.githubusercontent.com/mbostock/internmap/v${versions.internmap}/LICENSE`,
    ),
  );
  assert.match(
    await readFile(
      join(root, "apps/web/src/data/world-map.generated.ts"),
      "utf8",
    ),
    /export const WORLD_LAND_PATH = "M/,
  );
  assert.match(
    result.stdout,
    new RegExp(`using d3-geo ${versions.d3Geo.replaceAll(".", "\\.")}`),
  );
});
