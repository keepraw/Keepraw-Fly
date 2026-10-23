#!/usr/bin/env node
// Local WOFF2 checks always run. --remote checks SRI against two independent
// pinned package distributors; it does not change the runtime security policy.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const root = new URL("../apps/web/src/share/fonts/", import.meta.url);
const sources = JSON.parse(
  await readFile(new URL("sources.json", root), "utf8"),
);
for (const source of sources.latin) {
  const bytes = await readFile(new URL(source.file, root));
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    source.sha256,
    source.file,
  );
  assert.equal(bytes.length, source.bytes);
  assert.equal(bytes.subarray(0, 4).toString(), "wOF2");
}
assert.equal(sources.cjk.length, 8);
for (const source of sources.cjk) {
  assert.match(source.version, /^\d+\.\d+\.\d+$/);
  assert.match(source.integrity, /^sha384-[A-Za-z\d+/]{64}$/);
  if (!process.argv.includes("--remote")) continue;
  for (const cdn of ["https://cdn.jsdelivr.net/npm", "https://unpkg.com"]) {
    const url = `${cdn}/${source.package}@${source.version}/${source.stylesheet}`;
    const response = await fetch(url);
    assert.ok(response.ok, `${url}: ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(
      `sha384-${createHash("sha384").update(bytes).digest("base64")}`,
      source.integrity,
      url,
    );
    console.log(`PASS ${url}`);
  }
}
console.log(
  `PASS ${sources.latin.length} bundled fonts; ${sources.cjk.length} pinned CJK stylesheets`,
);
