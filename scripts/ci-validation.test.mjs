import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  existsSync,
  readdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function runReport(report, env = {}) {
  const directory = mkdtempSync(join(tmpdir(), "keepraw-ci-report-"));
  try {
    const path = join(directory, "results.json");
    writeFileSync(path, JSON.stringify(report));
    return spawnSync(
      process.execPath,
      ["scripts/report-playwright.mjs", path],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_ACTIONS: "",
          GITHUB_STEP_SUMMARY: "",
          ...env,
        },
      },
    );
  } finally {
    rmSync(directory, { recursive: true });
  }
}

test("browser jobs pin the official runtime matching the installed Playwright version", () => {
  const version = createRequire(import.meta.url)(
    "@playwright/test/package.json",
  ).version;
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  const images = [...workflow.matchAll(/image: (\S+)/g)].map(
    (match) => match[1],
  );
  assert.equal(images.length, 2);
  assert.equal(new Set(images).size, 1);
  assert.ok(
    images[0].startsWith(
      `mcr.microsoft.com/playwright:v${version}-noble@sha256:`,
    ),
  );
  assert.match(images[0], /@sha256:[a-f0-9]{64}$/);
  assert.doesNotMatch(
    workflow,
    /playwright install-deps|--with-deps|prepare-playwright-apt/,
  );
  assert.equal((workflow.match(/options: --user 1001/g) ?? []).length, 2);
  const chromium = workflow
    .split("  chromium:\n")[1]
    .split("  cross-browser:\n")[0];
  assert.match(chromium, /runs-on: ubuntu-24\.04/);
  assert.doesNotMatch(chromium, /container:/);
  assert.match(chromium, /playwright install chromium/);
});

function fixture(status = "expected") {
  return {
    stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0, duration: 30 },
    suites: [
      {
        suites: [
          {
            specs: [
              {
                file: "example.pw.ts",
                title: "geometry",
                tests: [
                  {
                    status,
                    projectName: "chromium",
                    results: [{ duration: 10 }, { duration: 20 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

test("report aggregates nested specs and retry durations without losing counts", () => {
  const result = runReport(fixture());
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.expected, 1);
  assert.deepEqual(summary.filesMs, { "example.pw.ts": 30 });
  assert.deepEqual(summary.failures, []);
  assert.equal(summary.tests, 1);
  assert.equal(summary.attempts, 2);
  assert.equal(summary.retries, 1);
  assert.equal(summary.retryMs, 20);
  assert.equal(summary.executionMs, 30);
  assert.deepEqual(summary.filesTests, { "example.pw.ts": 1 });
});

test("report fails skipped, unexpected, empty and globally errored suites", () => {
  for (const [key, value] of [
    ["skipped", 1],
    ["unexpected", 1],
  ]) {
    const report = fixture();
    report.stats[key] = value;
    assert.equal(runReport(report).status, 1, key);
  }
  assert.equal(runReport({ ...fixture(), suites: [] }).status, 1);
  assert.equal(
    runReport({ ...fixture(), errors: [{ message: "setup failed" }] }).status,
    1,
  );
});

test("flaky retries fail the summary, retain diagnostics and escape annotation text", () => {
  const report = fixture("flaky");
  report.stats.flaky = 1;
  report.suites[0].suites[0].specs[0].title = "100%\n::error::literal";
  report.suites[0].suites[0].specs[0].tests[0].results[0].errors = [
    { message: "overlap" },
  ];
  const result = runReport(report, { GITHUB_ACTIONS: "true" });
  assert.equal(result.status, 1, result.stderr);
  const [json, annotation] = result.stdout.trim().split("\n");
  assert.deepEqual(JSON.parse(json).failures[0].errors, ["overlap"]);
  assert.match(annotation, /100%25/);
  assert.equal(result.stdout.trim().split("\n").length, 2);
});

test("verify gate rejects failure, cancellation, skipping and missing results for every dependency", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  const gate = workflow.split("  verify:\n")[1].split("  deploy:\n")[0];
  const script = gate
    .split("        run: |\n")[1]
    .split("\n")
    .map((line) => line.slice(10))
    .join("\n");
  const keys = [
    "CHECKS_RESULT",
    "CHROMIUM_RESULT",
    "CROSS_BROWSER_RESULT",
    "CSP_RESULT",
    "AIRPORT_HISTORY_RESULT",
  ];
  const success = Object.fromEntries(keys.map((key) => [key, "success"]));
  const run = (env) =>
    spawnSync("bash", ["-e", "-c", script], { env, encoding: "utf8" });
  assert.equal(run(success).status, 0);
  for (const key of keys)
    for (const result of ["failure", "cancelled", "skipped", ""])
      assert.equal(
        run({ ...success, [key]: result }).status,
        1,
        `${key}: ${result}`,
      );
  assert.match(
    gate,
    /needs: \[checks, chromium, cross-browser, csp, airport-history\]/,
  );
  assert.ok(
    gate.includes(
      "if: ${{ always() && github.repository == 'keepraw/Keepraw-Fly' }}",
    ),
  );
  const deploy = workflow.split("  deploy:\n")[1];
  assert.ok(
    deploy.includes(
      "if: ${{ github.repository == 'keepraw/Keepraw-Fly' && github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.verify.result == 'success' }}",
    ),
  );
  assert.ok(
    deploy.includes(
      "needs: [verify, checks, chromium, cross-browser, csp, airport-history]",
    ),
  );
  assert.match(deploy, /uses: actions\/deploy-pages@[0-9a-f]{40} # v5\./);
  assert.match(
    workflow,
    /uses: actions\/upload-pages-artifact@[0-9a-f]{40} # v\d+(\.\d+){0,2}/,
  );
  assert.ok(workflow.includes("path: apps/web/dist"));
  assert.ok(
    workflow.includes(
      "  push:\n    branches: [main, refactor/persist-airport-identities]",
    ),
  );
  assert.ok(workflow.includes("group: ci-${{ github.ref }}"));
  assert.equal(existsSync(".github/workflows/pages.yml"), false);
  for (const job of ["checks", "chromium", "cross-browser", "csp"]) {
    assert.ok(
      workflow.includes(
        `  ${job}:\n    if: github.repository == 'keepraw/Keepraw-Fly'`,
      ),
    );
  }
  const fork = readFileSync(".github/workflows/fork-pages.yml", "utf8");
  assert.equal(
    (
      fork.match(
        /github.event.repository.fork && github.repository != 'keepraw\/Keepraw-Fly'/g,
      ) ?? []
    ).length,
    2,
  );
  assert.doesNotMatch(fork, /pnpm|setup-node|pull_request:|push:/);
});

test("Fork Pages refuses an incomplete modern publication before extracting it", () => {
  const workflow = readFileSync(".github/workflows/fork-pages.yml", "utf8");
  // Exercise the actual shell gate with already checksum-verified inputs.
  // No extraction, signing or deployment is performed.
  const legacy = workflow.match(/^\s*(legacy_unattested=.*)$/m)[1];
  const gate = workflow
    .split("sha256sum -c selected.sha256\n")[1]
    .split("          tar -xzf")[0];
  const dir = mkdtempSync(join(tmpdir(), "keepraw-fork-gate-"));
  try {
    const run = (version) =>
      spawnSync("bash", ["-ec", `${legacy}\n${gate}\necho extract`], {
        cwd: dir,
        env: { ...process.env, VERSION: version },
        encoding: "utf8",
      });
    for (const missing of ["attestation.sigstore.json", "provenance.json"]) {
      const other =
        missing === "provenance.json"
          ? "attestation.sigstore.json"
          : "provenance.json";
      writeFileSync(join(dir, other), "fixture");
      const result = run("v99.0.0");
      assert.equal(result.status, 1);
      assert.match(result.stdout, /Required release provenance is missing/);
      assert.doesNotMatch(result.stdout, /extract/);
      rmSync(join(dir, other));
    }
    assert.equal(run("v0.1.0").stdout.trim(), "extract");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Fork Pages strictly validates the provenance checksum in the release manifest", async (t) => {
  const workflow = readFileSync(".github/workflows/fork-pages.yml", "utf8");
  // Run the workflow's pre-verification block, stopping before it reads the
  // revision or calls the attestation verifier. Only the gh version is mocked.
  const gate = workflow
    .split("sha256sum -c selected.sha256\n")[1]
    .split("            revision=$(jq")[0];
  const version = "v99.0.0";
  const dir = mkdtempSync(join(tmpdir(), "keepraw-fork-checksum-"));
  try {
    const body = '{"fixture":true}';
    writeFileSync(join(dir, "provenance.json"), body);
    writeFileSync(join(dir, "attestation.sigstore.json"), "fixture");
    const hash = createHash("sha256").update(body).digest("hex");
    const record = `${hash}  ./provenance.json`;
    // SHA256SUMS is shared by all release attachments, even ones Pages does not download.
    const archive = `${"0".repeat(64)}  ./keepraw-fly-${version}.tar.gz`;
    for (const [label, lines, valid] of [
      [
        "one provenance record among official attachments",
        [archive, record, `${hash}  ./compose.yaml`, ""],
        true,
      ],
      ["plain filename", [archive, `${hash}  provenance.json`], true],
      [
        "valid plus malformed provenance record",
        [archive, record, "invalid  provenance.json"],
        false,
      ],
      [
        "two valid records for the same normalized name",
        [archive, record, `${hash}  provenance.json`],
        false,
      ],
      ["short digest", [archive, `${hash.slice(1)}  provenance.json`], false],
      [
        "non-hex digest",
        [archive, `z${hash.slice(1)}  provenance.json`],
        false,
      ],
      [
        "unexpected filename alongside valid record",
        [archive, record, `${hash}  other.json`],
        false,
      ],
      ["extra field", [archive, `${record} unexpected`], false],
      ["unrelated malformed line", [archive, record, "extra line"], false],
      ["missing provenance record", [archive], false],
      [
        "well-formed but incorrect digest",
        [archive, `${"0".repeat(64)}  provenance.json`],
        false,
      ],
    ]) {
      await t.test(label, () => {
        writeFileSync(join(dir, "SHA256SUMS"), lines.join("\n") + "\n");
        const result = spawnSync(
          "bash",
          [
            "-euc",
            `set -o pipefail\nlegacy_unattested=' v0.1.0 '\ngh() { [[ $1 == --version ]] && echo 'gh version 2.102.0'; }\n${gate}\nfi`,
          ],
          {
            cwd: dir,
            env: { ...process.env, VERSION: version },
            encoding: "utf8",
          },
        );
        assert.equal(
          result.status,
          valid ? 0 : 1,
          result.stderr + result.stdout,
        );
      });
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("every workflow action is pinned to a full commit SHA with a version comment", () => {
  for (const file of readdirSync(".github/workflows").filter((name) =>
    /\.ya?ml$/.test(name),
  )) {
    const workflow = readFileSync(`.github/workflows/${file}`, "utf8");
    const uses = [...workflow.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)(.*)$/gm)];
    assert.ok(uses.length > 0 || !/uses:/.test(workflow), file);
    for (const [, reference, rest] of uses) {
      if (reference.startsWith("./")) continue;
      assert.match(
        reference,
        /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/,
        `${file}: ${reference} must be pinned to a commit SHA`,
      );
      assert.match(
        rest,
        /^\s+# v\d+(\.\d+){0,2}$/,
        `${file}: ${reference} needs a readable version comment`,
      );
    }
  }
});

test("release workflow derives the version and attests provenance with least privilege", () => {
  const release = readFileSync(".github/workflows/release.yml", "utf8");
  const code = release
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");
  assert.doesNotMatch(code, /0\.1\.0/, "no hard-coded release version");
  assert.match(release, /bash scripts\/release-version\.sh/);
  assert.match(release, /actions\/attest-build-provenance@[0-9a-f]{40}/);
  assert.match(release, /subject-path: artifacts\/release\/\*/);
  assert.doesNotMatch(release, /subject-checksums:/);
  const image = release.split("  image:\n")[1].split("  attach:\n")[0];
  assert.match(image, /id-token: write/);
  assert.match(image, /attestations: write/);
  const attach = release.split("  attach:\n")[1];
  assert.doesNotMatch(attach, /id-token|attestations: write|packages: write/);
  assert.match(attach, /gh attestation verify/);
  // Source consistency: the event commit is checked before anything else, and
  // an attach run only accepts an image run built from the same commit.
  assert.match(
    image,
    /verify-release-source\.sh \/tmp\/ci\.json "\$GITHUB_SHA"/,
  );
  assert.match(image, /verify-release-provenance\.sh artifacts\/release/);
  assert.match(attach, /\.head_sha == \$sha/);
  assert.match(attach, /gh attestation verify "oci:\/\/\$image"/);
  for (const file of [
    ".github/workflows/ci.yml",
    ".github/workflows/fork-pages.yml",
  ]) {
    const workflow = readFileSync(file, "utf8");
    assert.doesNotMatch(
      workflow,
      /id-token: write[\s\S]*attestations: write/,
      file,
    );
  }
});
