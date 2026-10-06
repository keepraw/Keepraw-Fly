import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectCustomProperties,
  parseStylesheet,
  stylesheetFiles,
} from "./lib/css-analysis.mjs";
import { collectRuntimeProperties } from "./lib/runtime-css-properties.mjs";

export function checkCssTokens(root) {
  const definitions = [],
    variables = [],
    runtime = [];
  const stylesheets = stylesheetFiles(root);
  for (const file of stylesheets) {
    const properties = collectCustomProperties(
      parseStylesheet(root, file),
      file,
    );
    definitions.push(...properties.definitions);
    variables.push(...properties.variables);
  }
  function scanSource(directory) {
    for (const entry of readdirSync(resolve(root, directory), {
      withFileTypes: true,
    })) {
      const file = `${directory}/${entry.name}`;
      if (entry.isDirectory() && entry.name !== "generated") scanSource(file);
      else if (
        entry.isFile() &&
        /\.[jt]sx?$/.test(file) &&
        !/\.(test|spec)\.|\.generated\.|\.d\.ts$/.test(file)
      ) {
        runtime.push(
          ...collectRuntimeProperties(
            readFileSync(resolve(root, file), "utf8"),
            file,
          ),
        );
      }
    }
  }
  scanSource("apps/web/src");
  const cssNames = new Set(definitions.map(({ name }) => name));
  const runtimeNames = new Set(runtime.map(({ name }) => name));
  const unresolved = variables.filter(
    ({ name }) => !cssNames.has(name) && !runtimeNames.has(name),
  );
  console.log(
    `CSS tokens: ${stylesheets.length} stylesheets, ${variables.length} var() references (${new Set(variables.map(({ name }) => name)).size} unique tokens), ${cssNames.size} CSS definitions, ${runtimeNames.size} runtime definitions, ${new Set(unresolved.map(({ name }) => name)).size} unresolved tokens.`,
  );
  // Fallbacks do not excuse misspelled or nonexistent tokens.
  for (const use of unresolved) {
    console.error(
      `${use.file}:${use.line}: unresolved ${use.name}\n  ${use.property}: ${use.value};`,
    );
  }
  if (unresolved.length) process.exitCode = 1;

  return { variables, definitions, runtime, unresolved };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  checkCssTokens(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
}
