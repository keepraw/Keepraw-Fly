import { appendFile, readFile } from "node:fs/promises";

const report = JSON.parse(await readFile(process.argv[2], "utf8"));
const files = {};
const failures = [];
let tests = 0;
let attempts = 0;
let retryMs = 0;
const filesTests = {};
function visit(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      tests += 1;
      attempts += test.results.length;
      retryMs += test.results
        .slice(1)
        .reduce((sum, result) => sum + result.duration, 0);
      filesTests[spec.file] = (filesTests[spec.file] ?? 0) + 1;
      files[spec.file] =
        (files[spec.file] ?? 0) +
        test.results.reduce((sum, result) => sum + result.duration, 0);
      if (test.status !== "expected")
        failures.push({
          file: spec.file,
          title: spec.title,
          project: test.projectName,
          status: test.status,
          errors: test.results.flatMap((result) =>
            (result.errors ?? []).map((error) => error.message),
          ),
        });
    }
  }
  for (const child of suite.suites ?? []) visit(child);
}
for (const suite of report.suites) visit(suite);
const summary = {
  ...report.stats,
  label: process.argv[3] ?? "Playwright",
  shard: report.config?.shard ?? null,
  workers: report.config?.workers ?? null,
  tests,
  attempts,
  retries: attempts - tests,
  retryMs,
  executionMs: Object.values(files).reduce((sum, ms) => sum + ms, 0),
  filesTests,
  filesMs: Object.fromEntries(
    Object.entries(files).sort((a, b) => b[1] - a[1]),
  ),
  failures,
  errors: report.errors ?? [],
};
const text = JSON.stringify(summary);
console.log(text);
if (process.env.GITHUB_ACTIONS) {
  const escaped = text
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
  console.log(`::notice title=Playwright results::${escaped}`);
}
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    `\n### Playwright results\n\n\`\`\`json\n${JSON.stringify(summary, null, 2)}\n\`\`\`\n`,
  );
if (
  report.stats.skipped ||
  report.stats.unexpected ||
  report.errors?.length ||
  !Object.keys(files).length
)
  process.exitCode = 1;
