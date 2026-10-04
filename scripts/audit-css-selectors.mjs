// Read-only investigation input. A missing literal reference is NOT proof of unused CSS.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRequire = createRequire(resolve(root, "apps/web/package.json"));
// Reuse Vite's existing parser; do not add a dependency or depend on a pnpm store path.
const postcss = createRequire(webRequire.resolve("vite"))("postcss");
const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" })
  .split("\0").filter(Boolean).sort();
const styles = files.filter((file) => /^apps\/web\/src\/styles\/[^/]+\.css$/.test(file));
const sourceFiles = files.filter((file) => /^(apps|packages|examples|e2e)\//.test(file)
  && /\.(tsx?|jsx?|html|svg|json)$/.test(file));
const source = sourceFiles.map((file) => ({ file, lines: readFileSync(resolve(root, file), "utf8").split(/\r?\n/) }));
const testFile = (file) => /^e2e\//.test(file) || /\.(test|spec)\./.test(file);
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function references(token) {
  const pattern = new RegExp(`(?<![\\w-])${escape(token)}(?![\\w-])`);
  return source.flatMap(({ file, lines }) => lines.flatMap((line, i) => pattern.test(line)
    ? [{ file, line: i + 1, text: line.trim() }] : []));
}
function context(node) {
  const parts = [];
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (parent.type === "atrule") parts.unshift(`@${parent.name} ${parent.params}`);
  }
  return parts.join(" > ") || "base";
}
const rules = [], media = [], definitions = [], variables = [];
for (const file of [...styles, "apps/web/src/design-system.css"]) {
  const ast = postcss.parse(readFileSync(resolve(root, file), "utf8"), { from: file });
  ast.walkAtRules("media", (node) => {
    if (styles.includes(file)) media.push({ file, line: node.source.start.line, query: node.params,
      selectors: [...(node.nodes ?? [])].filter((child) => child.type === "rule").map((child) => child.selector) });
  });
  ast.walkRules((node) => {
    if (!styles.includes(file) || /@(?:-webkit-)?keyframes/.test(context(node))) return;
    for (const selector of postcss.list.comma(node.selector)) rules.push({ file,
      line: node.source.start.line, context: context(node), selector,
      declarations: (node.nodes ?? []).filter((child) => child.type === "decl")
        .map((decl) => ({ property: decl.prop, value: decl.value, important: Boolean(decl.important) })) });
  });
  ast.walkDecls((node) => {
    const location = { file, line: node.source.start.line, context: context(node), selector: node.parent.selector ?? "" };
    if (node.prop.startsWith("--")) definitions.push({ name: node.prop, value: node.value, ...location });
    for (const match of node.value.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) variables.push({ name: match[1],
      hasFallback: match[2] === ",", property: node.prop, value: node.value, ...location });
  });
}
const names = [...new Set(rules.flatMap(({ selector }) => [...selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => match[1])))].sort();
const classes = names.map((name) => {
  const refs = references(name);
  return { name, occurrences: rules.filter(({ selector }) => new RegExp(`\\.${escape(name)}(?![\\w-])`).test(selector))
    .map(({ file, line, selector, context }) => ({ file, line, selector, context })),
  sourceReferences: refs.filter(({ file }) => !testFile(file)), testReferences: refs.filter(({ file }) => testFile(file)) };
});
const group = (items, key) => {
  const result = new Map();
  for (const item of items) { const id = key(item); if (!result.has(id)) result.set(id, []); result.get(id).push(item); }
  return [...result.entries()].filter(([, entries]) => entries.length > 1).map(([key, occurrences]) => ({ key, occurrences }));
};
const customProperties = [...new Set(variables.map(({ name }) => name))].sort().map((name) => ({ name,
  definitions: definitions.filter((entry) => entry.name === name),
  // Includes runtime style objects; these references still need manual scope/value review.
  sourceReferences: references(name), uses: variables.filter((entry) => entry.name === name) }));
const report = { warning: "Literal evidence only: review dynamic construction, props, states, SVG, lazy loading and cascade before classifying.",
  summary: { stylesheets: styles.length, selectorBranches: rules.length, uniqueSelectorTexts: new Set(rules.map(({ selector }) => selector)).size,
    classIdentifiers: classes.length, classesWithoutSourceLiteral: classes.filter((entry) => !entry.sourceReferences.length).length },
  classes, duplicates: group(rules, ({ file, selector }) => `${file}: ${selector}`),
  repeatedMedia: group(media, ({ file, query }) => `${file}: ${query}`), customProperties };
if (process.argv.includes("--json")) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
else {
  console.log(report.warning);
  console.log(JSON.stringify(report.summary, null, 2));
  console.log("No source literal (NOT an unused list):", classes.filter((entry) => !entry.sourceReferences.length).map(({ name }) => name).join(", "));
  console.log("Repeated selector texts within a file:", report.duplicates.length);
  console.log("Repeated media groups:", report.repeatedMedia.map(({ key, occurrences }) => `${key} ×${occurrences.length}`).join("; "));
  console.log("Variables without a CSS definition:", customProperties.filter((entry) => !entry.definitions.length)
    .map(({ name, sourceReferences }) => `${name} (${sourceReferences.length ? "source evidence" : "no source evidence"})`).join(", "));
}
