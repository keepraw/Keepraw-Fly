#!/usr/bin/env node
// Verifies the pinned MiSans stylesheet SRI hashes against independent sources.
// Default: jsDelivr (the runtime origin) and unpkg must both serve bytes whose
// SHA-384 equals the committed value. With --npm, also download the npm tarball,
// check it against the registry's published integrity and hash the packaged CSS.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../apps/web/src/typography/load-webfonts.ts", import.meta.url),
  "utf8",
);
const version = source.match(/chineseWebfontVersion = "([^"]+)"/)?.[1];
const pins = Object.fromEntries(
  [...source.matchAll(/"(misans(?:-tc)?\/[a-z-]+)":\s*"(sha384-[^"]+)"/g)].map(
    (match) => [match[1], match[2]],
  ),
);
if (!version || Object.keys(pins).length !== 6)
  throw new Error("Could not read the pinned version and six SRI values");

const sri = (bytes) =>
  `sha384-${createHash("sha384").update(bytes).digest("base64")}`;
async function download(url) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

let failures = 0;
for (const [path, expected] of Object.entries(pins)) {
  for (const base of [
    `https://cdn.jsdelivr.net/npm/misans-webfont@${version}`,
    `https://unpkg.com/misans-webfont@${version}`,
  ]) {
    const actual = sri(await download(`${base}/${path}/result.min.css`));
    const ok = actual === expected;
    failures += ok ? 0 : 1;
    console.log(`${ok ? "OK  " : "FAIL"} ${base}/${path} ${actual}`);
  }
}

if (process.argv.includes("--npm")) {
  const meta = JSON.parse(
    (
      await download(`https://registry.npmjs.org/misans-webfont/${version}`)
    ).toString(),
  );
  const tarball = await download(meta.dist.tarball);
  const [algorithm, digest] = meta.dist.integrity.split("-");
  if (createHash(algorithm).update(tarball).digest("base64") !== digest)
    throw new Error("npm tarball does not match the registry integrity");
  const work = mkdtempSync(join(tmpdir(), "misans-"));
  try {
    writeFileSync(join(work, "package.tgz"), tarball);
    execFileSync("tar", ["-xzf", "package.tgz"], { cwd: work });
    for (const [path, expected] of Object.entries(pins)) {
      const actual = sri(
        readFileSync(join(work, "package", path, "result.min.css")),
      );
      const ok = actual === expected;
      failures += ok ? 0 : 1;
      console.log(`${ok ? "OK  " : "FAIL"} npm:${path} ${actual}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (failures) {
  console.error(`${failures} SRI mismatch(es)`);
  process.exit(1);
}
