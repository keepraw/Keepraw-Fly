import { readFile } from "node:fs/promises";

const documents = Object.fromEntries(
  await Promise.all(
    ["README.md", "README.zh-CN.md", "docs/architecture.md", "docs/not-implemented.md"].map(
      async (path) => [path, await readFile(path, "utf8")],
    ),
  ),
);

const requiredCsvDescriptions = [
  ["README.md", "CSV bulk import"],
  ["README.zh-CN.md", "CSV 批量导入"],
  ["docs/architecture.md", "mapped CSV import"],
];

const problems = requiredCsvDescriptions
  .filter(([path, text]) => !documents[path].includes(text))
  .map(([path, text]) => `${path} must describe the implemented ${text} workflow.`);

if (/\bCSV\b/i.test(documents["docs/not-implemented.md"])) {
  problems.push("docs/not-implemented.md must not list the implemented CSV importer as deferred.");
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Documentation capability descriptions are consistent.");
}
