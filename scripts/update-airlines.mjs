import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenCC from "opencc-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const airlinesPath = path.join(root, "packages/core/data/airlines.json");
const overridesPath = path.join(root, "packages/core/data/airline-overrides.json");
const sourcePath = path.join(root, "packages/core/data/airlines.source.json");
const traditionalizeChinese = OpenCC.Converter({ from: "cn", to: "tw" });
const withTraditionalName = ([iata, icao, nameEn, nameZh]) => [iata, icao, nameEn, nameZh, traditionalizeChinese(nameZh)];
const normalizeExisting = process.argv.includes("--normalize-existing");

if (normalizeExisting) {
  for (const filePath of [airlinesPath, overridesPath]) {
    const existingRows = JSON.parse(await readFile(filePath, "utf8"));
    await writeFile(filePath, `${JSON.stringify(existingRows.map(withTraditionalName), null, 2)}\n`, "utf8");
  }
  const previousSource = JSON.parse(await readFile(sourcePath, "utf8"));
  await writeFile(sourcePath, `${JSON.stringify({
    ...previousSource,
    normalizedAt: new Date().toISOString(),
    normalization: "OpenCC Taiwan Traditional Chinese generated from zh-CN at update time",
  }, null, 2)}\n`, "utf8");
  console.log("Generated zh-TW names for existing airline references and maintained overrides.");
  process.exit(0);
}

const endpoint = "https://query.wikidata.org/sparql";
const query = `SELECT DISTINCT ?iata ?icao ?nameEn ?nameZh WHERE {
  ?airline wdt:P229 ?iata; wdt:P230 ?icao.
  FILTER NOT EXISTS { ?airline wdt:P576 ?dissolved }
  OPTIONAL { ?airline rdfs:label ?nameEn FILTER(LANG(?nameEn) = "en") }
  OPTIONAL { ?airline rdfs:label ?nameZh FILTER(LANG(?nameZh) IN ("zh-hans", "zh-cn", "zh")) }
  FILTER(REGEX(?iata, "^[A-Z0-9]{2}$"))
  FILTER(REGEX(?icao, "^[A-Z]{3}$"))
}`;
const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}&format=json`, {
  headers: { Accept: "application/sparql-results+json", "User-Agent": "Keepraw-Fly-reference-updater/0.1" },
  signal: AbortSignal.timeout(45_000),
});
if (!response.ok) throw new Error(`Wikidata query failed: ${response.status}`);
const body = await response.json();
const references = new Map();
for (const binding of body.results.bindings) {
  const iata = binding.iata?.value?.toUpperCase();
  const icao = binding.icao?.value?.toUpperCase();
  const nameEn = binding.nameEn?.value;
  const nameZh = binding.nameZh?.value;
  const language = binding.nameZh?.["xml:lang"];
  const score = language === "zh-hans" ? 2 : language === "zh-cn" ? 1 : 0;
  const key = `${iata}/${icao}`;
  if (iata && icao && nameEn && nameZh && score >= (references.get(key)?.score ?? -1)) {
    references.set(key, { score, row: [iata, icao, nameEn, nameZh] });
  }
}
const rows = [...references.values()].map((value) => withTraditionalName(value.row)).sort((left, right) => left[0].localeCompare(right[0]));
await writeFile(airlinesPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
await writeFile(sourcePath, `${JSON.stringify({ source: "Wikidata", endpoint, retrievedAt: new Date().toISOString(), license: "CC0-1.0", count: rows.length, normalization: "OpenCC Taiwan Traditional Chinese generated from zh-CN at update time" }, null, 2)}\n`, "utf8");
console.log(`Generated ${rows.length} English, zh-CN and zh-TW airline references from Wikidata.`);
