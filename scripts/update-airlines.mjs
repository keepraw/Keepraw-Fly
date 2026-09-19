import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
const rows = [...references.values()].map((value) => value.row).sort((left, right) => left[0].localeCompare(right[0]));
await writeFile(path.join(root, "packages/core/data/airlines.json"), `${JSON.stringify(rows, null, 2)}\n`, "utf8");
await writeFile(path.join(root, "packages/core/data/airlines.source.json"), `${JSON.stringify({ source: "Wikidata", endpoint, retrievedAt: new Date().toISOString(), license: "CC0-1.0", count: rows.length }, null, 2)}\n`, "utf8");
console.log(`Generated ${rows.length} bilingual airline references from Wikidata.`);
