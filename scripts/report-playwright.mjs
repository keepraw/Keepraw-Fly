import { appendFile, readFile } from "node:fs/promises";

const report = JSON.parse(await readFile(process.argv[2], "utf8"));
const files = {};
const failures = [];
function visit(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
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
