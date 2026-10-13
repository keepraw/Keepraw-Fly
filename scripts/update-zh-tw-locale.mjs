import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenCC from "opencc-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "apps/web/src/locales/zh-CN.json");
const targetPath = path.join(root, "apps/web/src/locales/zh-TW.json");
const traditionalizeChinese = OpenCC.Converter({ from: "cn", to: "tw" });

function convert(value) {
  if (typeof value === "string") return traditionalizeChinese(value);
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, convert(child)]),
  );
}

// Never overwrite reviewed Taiwanese wording. Existing keys, even ones removed
// from zh-CN, remain visible for manual review and resource completeness checks.
export function addMissing(target, candidate, prefix = "", added = []) {
  for (const [key, value] of Object.entries(candidate)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (!(key in target)) {
      target[key] = value;
      added.push(name);
    } else if (typeof value === "object" && typeof target[key] === "object") {
      addMissing(target[key], value, name, added);
    }
  }
  return added;
}

async function main() {
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  const candidate = convert(source);
  const candidateFlag = process.argv.indexOf("--candidate");
  if (candidateFlag !== -1) {
    const destination = process.argv[candidateFlag + 1];
    if (!destination) throw new Error("--candidate requires an output path");
    const output = path.resolve(destination);
    if ([sourcePath, targetPath].includes(output))
      throw new Error("Candidate output must not overwrite maintained locales");
    await writeFile(output, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    console.log(
      `Wrote OpenCC review candidate to ${output}. Taiwan terminology needs manual review.`,
    );
  } else {
    const reviewed = JSON.parse(await readFile(targetPath, "utf8"));
    const added = addMissing(reviewed, candidate);
    if (added.length)
      await writeFile(
        targetPath,
        `${JSON.stringify(reviewed, null, 2)}\n`,
        "utf8",
      );
    console.log(
      `Preserved existing zh-TW translations. Added ${added.length} missing keys: ${added.join(", ") || "none"}. Review Taiwan terminology manually; source edits need manual reconciliation.`,
    );
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
