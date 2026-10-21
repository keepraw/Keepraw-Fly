#!/usr/bin/env node
// Security-header and cache-policy regression checks.
//
// Static (always): the production build's <meta> CSP equals the policy source,
// contains no unsafe-* sources, and Caddy sends the same policy plus the
// header-only directives. Runtime (when a Caddy binary is available through
// CADDY_BIN or PATH, or with --require-runtime): serve apps/web/dist with the
// real deploy/Caddyfile at the root and under a GitHub-Pages-style subpath,
// over HTTP and HTTPS, and assert every response header and cache rule.
import { execFileSync, spawn } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "apps/web/dist");
const caddyfile = readFileSync(join(root, "deploy/Caddyfile"), "utf8");
const { documentDirectives, documentPolicy, headerPolicy } = await import(
  new URL("../apps/web/security-policy.mjs", import.meta.url).href
);

// ---- Static checks -------------------------------------------------------
const html = readFileSync(join(dist, "index.html"), "utf8");
const metas = [
  ...html.matchAll(
    /<meta http-equiv="Content-Security-Policy" content="([^"]+)"\s*\/?>/g,
  ),
];
assert.equal(
  metas.length,
  1,
  "dist/index.html must carry exactly one CSP <meta>",
);
const metaPolicy = metas[0][1].replaceAll("&#39;", "'");
assert.equal(
  metaPolicy,
  documentPolicy,
  "meta CSP differs from security-policy.mjs",
);
assert.ok(
  html.indexOf("Content-Security-Policy") < html.indexOf("<script"),
  "CSP <meta> must precede every script",
);
assert.doesNotMatch(metaPolicy, /unsafe-(inline|eval|hashes)|\*|http:/);
// Blob-backed Flight Passport previews need img-src permission only.
// Pin the sensitive boundaries so fixing an image cannot enable Blob fetches,
// scripts or workers, or broaden the default policy.
const directives = new Map(documentDirectives);
for (const [name, sources] of [
  ["img-src", ["'self'", "data:", "blob:"]],
  ["default-src", ["'none'"]],
  ["script-src", ["'self'"]],
  ["connect-src", ["'self'"]],
  ["worker-src", ["'none'"]],
]) {
  assert.deepEqual(directives.get(name), sources, `${name}: allowed sources`);
}
for (const [name, sources] of documentDirectives) {
  if (name !== "img-src")
    assert.ok(!sources.includes("blob:"), `${name} must not allow blob:`);
}
assert.doesNotMatch(
  metaPolicy,
  /frame-ancestors|report-uri|sandbox/,
  "meta-ignored directive",
);
assert.doesNotMatch(
  html,
  /<script>(?!<\/script>)|<script(?![^>]*\bsrc=)[^>]*>\s*\S/,
  "inline script in index.html",
);
assert.match(html, /<script src="\.\/theme-init\.js"><\/script>/);
for (const file of readdirSync(join(dist, "assets")).filter((f) =>
  f.endsWith(".js"),
)) {
  const code = readFileSync(join(dist, "assets", file), "utf8");
  assert.doesNotMatch(
    code,
    /[^\w$.]Function\(|[^\w$.]eval\(/,
    `${file} evaluates code at runtime (needs unsafe-eval)`,
  );
}
const caddyCsp = caddyfile.match(/Content-Security-Policy "([^"]+)"/)?.[1];
assert.equal(
  caddyCsp,
  headerPolicy,
  "Caddy CSP differs from security-policy.mjs headerPolicy",
);
console.log("PASS static: meta CSP, no inline/eval, Caddy policy parity");

// ---- Runtime checks with a real Caddy ------------------------------------
function findCaddy() {
  for (const candidate of [process.env.CADDY_BIN, "caddy"].filter(Boolean)) {
    try {
      execFileSync(candidate, ["version"], { stdio: "ignore" });
      return candidate;
    } catch {}
  }
  return undefined;
}
const caddy = findCaddy();
if (!caddy) {
  if (process.argv.includes("--require-runtime"))
    throw new Error("Caddy binary not found");
  console.log(
    "SKIP runtime: no Caddy binary (CI covers it in scripts/test-deployment.sh)",
  );
  process.exit(0);
}

const work = mkdtempSync(join(tmpdir(), "keepraw-headers-"));
const servers = [];
async function serve(siteAddress, srv, healthPort) {
  const config = caddyfile
    .replace("root * /srv", `root * ${srv}`)
    .replace("http://127.0.0.1:8081", `http://127.0.0.1:${healthPort}`)
    .replace(
      "{\n  admin off\n}",
      `{\n  admin off\n  storage file_system ${join(work, "data")}\n  local_certs\n  skip_install_trust\n  auto_https disable_redirects\n}`,
    );
  const file = join(work, `Caddyfile-${healthPort}`);
  writeFileSync(file, config);
  const child = spawn(
    caddy,
    ["run", "--config", file, "--adapter", "caddyfile"],
    {
      env: {
        ...process.env,
        SITE_ADDRESS: siteAddress,
        HOME: work,
        XDG_DATA_HOME: work,
        XDG_CONFIG_HOME: work,
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
  let log = "";
  child.stderr.on("data", (chunk) => (log += chunk));
  servers.push(child);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${healthPort}/health`);
      if (response.ok) return;
    } catch {}
    await delay(200);
  }
  throw new Error(`Caddy did not start:\n${log}`);
}

function headers(url) {
  // curl handles the internal CA (-k) and never follows the cache.
  const out = execFileSync(
    "curl",
    ["-sk", "--noproxy", "*", "-D", "-", "-o", "/dev/null", url],
    { encoding: "utf8" },
  );
  const [status, ...lines] = out.trim().split(/\r?\n/);
  const map = new Map(
    lines.map((line) => {
      const index = line.indexOf(":");
      return [line.slice(0, index).toLowerCase(), line.slice(index + 1).trim()];
    }),
  );
  return { status: Number(status.split(" ")[1]), get: (name) => map.get(name) };
}

try {
  const srv = join(work, "srv");
  cpSync(dist, srv, { recursive: true });
  cpSync(dist, join(srv, "Keepraw-Fly"), { recursive: true });
  const hashedJs = readdirSync(join(dist, "assets")).find((f) =>
    /^index-.+\.js$/.test(f),
  );
  const logo = readdirSync(join(dist, "assets/airlines"))[0];
  await serve(":18091", srv, 18191);
  await serve("https://localhost:18453", srv, 18192);

  const common = (response, label) => {
    assert.equal(
      response.get("content-security-policy"),
      headerPolicy,
      `${label}: CSP`,
    );
    assert.equal(
      response.get("x-content-type-options"),
      "nosniff",
      `${label}: nosniff`,
    );
    assert.equal(response.get("x-frame-options"), "DENY", `${label}: XFO`);
    assert.equal(
      response.get("referrer-policy"),
      "no-referrer",
      `${label}: referrer`,
    );
    assert.match(
      response.get("permissions-policy") ?? "",
      /camera=\(\).*geolocation=\(\).*microphone=\(\)/,
      `${label}: permissions`,
    );
    assert.equal(
      response.get("cross-origin-opener-policy"),
      "same-origin",
      `${label}: COOP`,
    );
    assert.equal(response.get("server"), undefined, `${label}: server banner`);
  };
  for (const prefix of ["", "/Keepraw-Fly"]) {
    for (const [base, https] of [
      ["http://127.0.0.1:18091", false],
      ["https://localhost:18453", true],
    ]) {
      const label = `${https ? "https" : "http"}${prefix || " root"}`;
      for (const path of [
        "/",
        "/index.html",
        "/release.json",
        "/theme-init.js",
        "/site.webmanifest",
        "/icon.svg",
        `/assets/airlines/${logo}`,
      ].filter(
        (p) =>
          p !== "/release.json" || readdirSync(dist).includes("release.json"),
      )) {
        const response = headers(base + prefix + path);
        assert.equal(response.status, 200, `${label}${path}: status`);
        common(response, `${label}${path}`);
        assert.equal(
          response.get("cache-control"),
          "no-cache",
          `${label}${path}: must revalidate`,
        );
        assert.equal(
          response.get("strict-transport-security"),
          https ? "max-age=31536000" : undefined,
          `${label}${path}: HSTS`,
        );
      }
      const asset = headers(`${base}${prefix}/assets/${hashedJs}`);
      assert.equal(asset.status, 200);
      common(asset, `${label} hashed asset`);
      assert.equal(
        asset.get("cache-control"),
        "public, max-age=31536000, immutable",
        `${label}: immutable hashed asset`,
      );
    }
  }
  console.log(
    "PASS runtime: Caddy headers, HSTS only on HTTPS, cache rules at root and subpath",
  );
} finally {
  for (const child of servers) child.kill("SIGTERM");
  await delay(300);
  rmSync(work, { recursive: true, force: true });
}
