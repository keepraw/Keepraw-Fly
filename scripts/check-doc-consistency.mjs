import { access, readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const documentPaths = [
  ...(await readdir(repositoryRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name),
  ...(await markdownFiles("docs")),
];
for (const entry of await readdir(resolve(repositoryRoot, "packages"), { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const path = `packages/${entry.name}/README.md`;
  if (await exists(resolve(repositoryRoot, path))) documentPaths.push(path);
}
const documents = Object.fromEntries(await Promise.all(documentPaths.sort().map(async (path) => [
  path,
  withoutFencedCode(await readFile(resolve(repositoryRoot, path), "utf8")),
])));

const requiredCsvDescriptions = [
  ["README.md", "CSV bulk import"],
  ["README.zh-CN.md", "CSV 批量导入"],
  ["docs/architecture.md", "mapped CSV import"],
];

const problems = requiredCsvDescriptions
  .filter(([path, text]) => !documents[path]?.includes(text))
  .map(([path, text]) => `${path} must describe the implemented ${text} workflow.`);

if (!documents["docs/not-implemented.md"]) {
  problems.push("docs/not-implemented.md is missing or empty.");
} else if (/\bCSV\b/i.test(documents["docs/not-implemented.md"])) {
  problems.push("docs/not-implemented.md must not list the implemented CSV importer as deferred.");
}

for (const [path, description] of [
  ["README.md", "demo provided by the developer"],
  ["README.zh-CN.md", "开发者提供的 Demo"],
  ["docs/deployment.md", "demo provided by the developer"],
]) {
  const content = documents[path] ?? "";
  if (!content.includes("https://fly.keepraw.com") || !content.toLowerCase().includes(description.toLowerCase())) {
    problems.push(`${path} must identify https://fly.keepraw.com with the description: ${description}.`);
  }
}

for (const [path, content] of Object.entries(documents)) {
  for (const destination of new Set(linkDestinations(content))) {
    const relativePath = localPath(destination);
    if (relativePath && !(await exists(resolve(repositoryRoot, dirname(path), relativePath)))) {
      problems.push(`${path} links to a missing local path: ${destination}`);
    }
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Documentation checks passed for ${documentPaths.length} files: capabilities, developer demo and local links.`);
}

async function markdownFiles(directory) {
  const entries = await readdir(resolve(repositoryRoot, directory), { withFileTypes: true });
  const paths = await Promise.all(entries.map((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  }));
  return paths.flat();
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
    throw error;
  }
}

function withoutFencedCode(content) {
  let fence = null;
  return content.split(/\r?\n/).map((line) => {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return "";
    }
    if (marker) {
      fence = marker[1];
      return "";
    }
    return line;
  }).join("\n");
}

function* linkDestinations(content) {
  // Handle ordinary inline links/images, including one level of parentheses in a path.
  const inlineLinks = /!?\[[^\]\n]*\]\(\s*(<[^>\n]*>|(?:\\.|[^\\()\n]|\((?:\\.|[^\\()\n])*\))*)\)/g;
  for (const match of content.matchAll(inlineLinks)) yield markdownDestination(match[1]);
  // Reference-style links and images share the destinations in these definitions.
  for (const match of content.matchAll(/^ {0,3}\[[^\]\n]+\]:\s*(.+)$/gm)) yield markdownDestination(match[1]);
  for (const tag of content.matchAll(/<[a-z][^>]*>/gi)) {
    for (const match of tag[0].matchAll(/\s(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi)) {
      yield match[1] ?? match[2] ?? match[3];
    }
  }
}

function markdownDestination(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("<")) return trimmed.slice(1, trimmed.indexOf(">"));
  return trimmed.replace(/\s+(?:"[^"]*"|'[^']*'|\([^)]*\))\s*$/, "").replace(/\\([\\`*{}\[\]()#+\-.!_<>])/g, "$1");
}

function localPath(destination) {
  const value = destination.trim().replace(/&amp;/g, "&");
  // Site-root URLs are not paths relative to a repository document.
  if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(value)) return null;
  const path = value.split(/[?#]/, 1)[0];
  if (!path) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}
