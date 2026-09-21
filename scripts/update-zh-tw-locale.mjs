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
  if (Array.isArray(value)) return value.map(convert);
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, convert(child)]));
}

const source = JSON.parse(await readFile(sourcePath, "utf8"));
const translated = convert(source);
translated.settings.languages = {
  en: "English",
  zhCN: "简体中文",
  zhTW: "繁體中文",
};

await writeFile(targetPath, `${JSON.stringify(translated, null, 2)}\n`, "utf8");
console.log("Generated apps/web/src/locales/zh-TW.json from the reviewed zh-CN source.");
