import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { documentPolicy } from "../apps/web/security-policy.mjs";

test("reads the real Caddyfile and build through native paths with URL-escaped characters", async (t) => {
  // On Windows this also exercises the drive-letter URL (not C:\\C:\\...).
  // Spaces, %, # and Unicode make .pathname invalid even on POSIX runners.
  const root = await mkdtemp(join(tmpdir(), "keepraw headers %# 地图-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const path of ["scripts", "deploy", "apps/web/dist/assets"])
    await mkdir(join(root, path), { recursive: true });
  for (const path of [
    "scripts/check-security-headers.mjs",
    "deploy/Caddyfile",
    "apps/web/security-policy.mjs",
  ])
    await cp(new URL(`../${path}`, import.meta.url), join(root, path));
  await writeFile(
    join(root, "apps/web/dist/index.html"),
    `<html><head><meta http-equiv="Content-Security-Policy" content="${documentPolicy}"><script src="./theme-init.js"></script></head></html>`,
  );
  await writeFile(
    join(root, "apps/web/dist/assets/index-fixture.js"),
    "export {};",
  );
  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/check-security-headers.mjs")],
    {
      cwd: tmpdir(),
      // This fixture exercises static path resolution, not optional Caddy discovery.
      env: { ...process.env, PATH: "", CADDY_BIN: "" },
      encoding: "utf8",
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    result.stdout,
    /PASS static: meta CSP, no inline\/eval, Caddy policy parity/,
  );
});
