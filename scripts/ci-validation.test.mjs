import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

test("flaky retries retain failure diagnostics and annotation text is escaped", () => {
  const report = fixture("flaky");
  report.stats.flaky = 1;
  report.suites[0].suites[0].specs[0].title = "100%\n::error::literal";
  report.suites[0].suites[0].specs[0].tests[0].results[0].errors = [
    { message: "overlap" },
  ];
  const result = runReport(report, { GITHUB_ACTIONS: "true" });
  assert.equal(result.status, 0, result.stderr);
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
  const keys = ["CHECKS_RESULT", "CHROMIUM_RESULT", "CROSS_BROWSER_RESULT"];
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
  assert.match(gate, /needs: \[checks, chromium, cross-browser\]/);
  assert.match(gate, /if: \$\{\{ always\(\) \}\}/);
  assert.match(workflow.split("  deploy:\n")[1], /if: \$\{\{ false \}\}/);
});
