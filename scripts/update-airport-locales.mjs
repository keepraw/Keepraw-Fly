import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenCC from "opencc-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const endpoint = "https://query.wikidata.org/sparql";
const localesPath = path.join(root, "packages/core/data/airport-locales.json");
const sourcePath = path.join(root, "packages/core/data/airport-locales.source.json");
const simplifyChinese = OpenCC.Converter({ from: "t", to: "cn" });
const normalizeZhCn = (value) => simplifyChinese(value.normalize("NFC")).trim();
const languageRank = (language) => language === "zh-hans" ? 3 : language === "zh-cn" ? 2 : language === "zh" ? 1 : 0;

const maintainedOverrides = [
  ["BOM", "贾特拉帕蒂·希瓦吉·马哈拉杰国际机场", "孟买"],
  ["HKG", "香港国际机场", "香港"],
  ["LAX", "洛杉矶国际机场", "洛杉矶"],
  ["SZX", "深圳宝安国际机场", "深圳"],
  ["TAO", "青岛胶东国际机场", "青岛"],
  ["TPE", "台湾桃园国际机场", "桃园"],
];

const localized = new Map();
const normalizeExisting = process.argv.includes("--normalize-existing");

if (normalizeExisting) {
  const existingRows = JSON.parse(await readFile(localesPath, "utf8"));
  for (const [iata, nameZh, cityZh] of existingRows) {
    localized.set(iata, { score: 1, row: [iata, normalizeZhCn(nameZh), normalizeZhCn(cityZh)] });
  }
} else {
  const airports = JSON.parse(await readFile(path.join(root, "packages/core/data/airports.iata.json"), "utf8"));
  const codes = airports.map((row) => row[0]);

  for (let offset = 0; offset < codes.length; offset += 200) {
    const values = codes.slice(offset, offset + 200).map((code) => JSON.stringify(code)).join(" ");
    const query = `SELECT DISTINCT ?iata ?nameZh ?cityZh WHERE {
      VALUES ?iata { ${values} }
      ?airport wdt:P238 ?iata; rdfs:label ?nameZh.
      FILTER(LANG(?nameZh) IN ("zh-hans", "zh-cn", "zh"))
      OPTIONAL { ?airport wdt:P931 ?served. ?served rdfs:label ?servedZh. FILTER(LANG(?servedZh) IN ("zh-hans", "zh-cn", "zh")) }
      OPTIONAL { ?airport wdt:P131 ?area. ?area rdfs:label ?areaZh. FILTER(LANG(?areaZh) IN ("zh-hans", "zh-cn", "zh")) }
      BIND(COALESCE(?servedZh, ?areaZh) AS ?cityZh)
    }`;
    let body;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(`${endpoint}?query=${encodeURIComponent(query)}&format=json`, {
          headers: { Accept: "application/sparql-results+json", "User-Agent": "Keepraw-Fly-reference-updater/0.1" },
          signal: AbortSignal.timeout(60_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        body = await response.json();
        break;
      } catch (error) {
        if (attempt === 3) throw new Error(`Wikidata query failed at offset ${offset}`, { cause: error });
        console.warn(`Retrying airport locale batch at offset ${offset} (${attempt}/3)…`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    }
    for (const binding of body.results.bindings) {
      const iata = binding.iata?.value?.toUpperCase();
      const nameZh = binding.nameZh?.value;
      const cityZh = binding.cityZh?.value;
      const score = languageRank(binding.nameZh?.["xml:lang"]) * 10 + languageRank(binding.cityZh?.["xml:lang"]);
      if (iata && nameZh && cityZh && score >= (localized.get(iata)?.score ?? -1)) {
        localized.set(iata, { score, row: [iata, normalizeZhCn(nameZh), normalizeZhCn(cityZh)] });
      }
    }
    console.log(`Localized ${Math.min(offset + 200, codes.length)} / ${codes.length} airport codes…`);
  }
}

for (const row of maintainedOverrides) localized.set(row[0], { score: 999, row });
const rows = [...localized.values()].map((value) => value.row).sort((left, right) => left[0].localeCompare(right[0]));
const previousSource = normalizeExisting ? JSON.parse(await readFile(sourcePath, "utf8")) : {};

await writeFile(localesPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
await writeFile(sourcePath, `${JSON.stringify({
  ...previousSource,
  source: "Wikidata",
  endpoint,
  retrievedAt: normalizeExisting ? previousSource.retrievedAt : new Date().toISOString(),
  normalizedAt: new Date().toISOString(),
  languagePriority: ["zh-hans", "zh-cn", "zh", "en"],
  normalization: "OpenCC Traditional Chinese to Mainland Simplified Chinese at update time",
  license: "CC0-1.0",
  count: rows.length,
}, null, 2)}\n`, "utf8");
console.log(`${normalizeExisting ? "Normalized" : "Generated"} ${rows.length} zh-CN airport localizations.`);
