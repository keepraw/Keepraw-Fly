import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenCC from "opencc-js";

const base = new URL("../packages/core/data/", import.meta.url);
const read = async (name) =>
  JSON.parse(await readFile(new URL(name, base), "utf8"));
const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const labels = await read("airport-names.json");
const dataset = await read("airport-history/formal/airports.json");
const crosswalk = await read("airport-history/formal/directory.json");
const fly = await read("airports.iata.json");
const legacyIds = new Map(
  Object.entries(crosswalk).flatMap(([id, row]) =>
    (row.legacyIds ?? []).map((legacy) => [legacy, id]),
  ),
);
const airportIds = new Map();
const sites = new Map();
const flyByCode = new Map();
function associate(code, id) {
  if (!/^[A-Z]{3,4}$/.test(code ?? "")) return;
  const ids = airportIds.get(code) ?? new Set();
  ids.add(id);
  airportIds.set(code, ids);
}
for (const [iata, name, city, , lat, lon, , legacyId, icao, status] of fly) {
  const id = legacyIds.get(legacyId) ?? legacyId;
  if (status !== "closed" && status !== "unknown") flyByCode.set(iata, id);
  sites.set(id, { lat, lon, city, name });
  associate(iata, id);
  associate(icao, id);
}
for (const airport of dataset.airports) {
  const id = airport.airportId;
  const point = airport.coordinates.value;
  sites.set(id, {
    lat: point.latitude,
    lon: point.longitude,
    city: crosswalk[id].city,
    name: airport.name.value,
  });
}
for (const { code, airportId } of dataset.assignments)
  associate(code, airportId);

const legacyPath = argument("legacy");
if (legacyPath) {
  for (const [iata, nameZhCn, cityZhCn, nameZhTw, cityZhTw] of JSON.parse(
    await readFile(legacyPath, "utf8"),
  )) {
    const id = flyByCode.get(iata);
    if (!id) continue;
    const entry = (labels[id] ??= {});
    entry.names ??= {};
    entry.names["zh-CN"] ??= [nameZhCn, "legacy-zh-CN"];
    entry.names["zh-TW"] ??= [nameZhTw, "legacy-zh-TW"];
    entry.cities ??= { "zh-CN": cityZhCn, "zh-TW": cityZhTw };
  }
}

// Withdraw inherited labels documented as different physical airports.
for (const code of ["OKS", "NFO"]) {
  const row = labels[flyByCode.get(code)];
  if (row?.names?.["zh-CN"]?.[1] === "legacy-zh-CN") delete row.names["zh-CN"];
  if (row?.names?.["zh-TW"]?.[1] === "legacy-zh-TW") delete row.names["zh-TW"];
  if (row) delete row.cities;
}

// Reviewed display labels for the two independently identified TAO sites.
const tao = [
  [
    "apt_f470ecb5-c6dc-4516-a233-37302da2115b",
    "青岛流亭国际机场",
    "青島流亭國際機場",
    "青島流亭国際空港",
    "칭다오 류팅 국제공항",
  ],
  [
    "apt_6729d2b2-4b79-48c8-9c42-0d4eeba121b8",
    "青岛胶东国际机场",
    "青島膠東國際機場",
    "青島膠東国際空港",
    "칭다오 자오둥 국제공항",
  ],
];
for (const [id, zhCN, zhTW, ja, ko] of tao) {
  const names = ((labels[id] ??= {}).names ??= {});
  for (const [locale, name] of Object.entries({
    "zh-CN": zhCN,
    "zh-TW": zhTW,
    ja,
    ko,
  })) {
    names[locale] = [name, "reviewed-tao"];
  }
}

// Keep the names of the old and new Lianyungang sites independent.
const displayLabels = {
  "apt_86460159-a072-4a18-afcc-ab376cda7047": {
    "zh-CN": "香港启德机场",
    "zh-TW": "香港啟德機場",
    ja: "啓徳空港",
    ko: "카이탁 공항",
  },
  "apt_64b5eaa6-a984-4816-86d9-d8eb71c91451": {
    en: "Lianyungang Huaguoshan International Airport",
    "zh-CN": "连云港花果山国际机场",
    "zh-TW": "連雲港花果山國際機場",
  },
  "apt_6f1a6ff3-98db-4e58-95fc-cc78bd5aa836": {
    "zh-CN": "连云港白塔埠机场",
    "zh-TW": "連雲港白塔埠機場",
    ja: "連雲港白塔埠空港",
  },
  "apt_f11bdf7d-d81d-46fc-a94f-8c8c42d4e245": { en: "Luzhou Yunlong Airport" },
  "apt_56b57bca-08d5-4b5e-944e-1e9cce968a0a": {
    "zh-CN": "泸州蓝田机场",
    "zh-TW": "瀘州藍田機場",
    ja: "瀘州藍田空港",
  },
  "apt_bbf9f2c1-fc01-4ed7-a4aa-74e6ed8ca45f": {
    "zh-CN": "宜宾菜坝机场",
    "zh-TW": "宜賓菜壩機場",
    ja: "宜賓菜壩空港",
  },
  "apt_bf9260e8-2d9b-413b-81d9-c6842d53cbf7": {
    en: "Kempegowda International Airport Bengaluru",
  },
  "apt_eb176a20-e0e3-438d-a330-a7b81185232d": {
    "zh-CN": "棕榈滩国际机场",
    "zh-TW": "棕櫚灘國際機場",
  },
};
for (const [id, row] of Object.entries(displayLabels)) {
  const names = ((labels[id] ??= {}).names ??= {});
  for (const [locale, name] of Object.entries(row)) {
    names[locale] = [name, "historical-site-display"];
  }
}

const date = argument("retrieved-on") ?? new Date().toISOString().slice(0, 10);
const languages = [
  "ja",
  "ko",
  "fr",
  "de",
  "es",
  "pt",
  "zh-hans",
  "zh-cn",
  "zh-hant",
  "zh-tw",
  "zh",
];
const languageMap = {
  "zh-hans": ["zh-CN", 3],
  "zh-cn": ["zh-CN", 2],
  "zh-hant": ["zh-TW", 3],
  "zh-tw": ["zh-TW", 2],
  zh: ["zh-CN", 1],
};
const airportTerms = {
  ja: /空港|飛行場|基地|ヘリポート/,
  ko: /공항|비행장|기지|헬리포트/,
  fr: /aéroport|aérodrome|héliport|base aérienne/i,
  de: /flughafen|flugplatz|fliegerhorst|heliport|flugbasis/i,
  es: /aeropuerto|aeródromo|helipuerto|base aérea/i,
  pt: /aeroporto|aeródromo|heliporto|base aérea/i,
  "zh-CN": /机场|機場|航空站|飛行場|飞行场|基地/,
  "zh-TW": /机场|機場|航空站|飛行場|飞行场|基地/,
};
const toCn = OpenCC.Converter({ from: "t", to: "cn" });
const toTw = OpenCC.Converter({ from: "cn", to: "tw" });
const best = new Map();
const disputed = new Set();

function distance(lat, lon, point) {
  const rad = Math.PI / 180;
  const delta =
    Math.sin(((lat - point.lat) * rad) / 2) ** 2 +
    Math.cos(lat * rad) *
      Math.cos(point.lat * rad) *
      Math.sin(((lon - point.lon) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(delta)));
}

function useLabels(rows) {
  for (const [code, entity, coordinates, language, label] of rows) {
    if (!/^Q[1-9][0-9]*$/.test(entity) || !languages.includes(language))
      continue;
    const point = /^Point\((-?[\d.]+) (-?[\d.]+)\)$/.exec(coordinates);
    if (!point) continue;
    const [, lon, lat] = point;
    const candidates = [...(airportIds.get(code) ?? [])].filter(
      (id) => distance(Number(lat), Number(lon), sites.get(id)) <= 3,
    );
    if (candidates.length !== 1) continue;
    const [id] = candidates;
    const [locale, priority] = languageMap[language] ?? [language, 1];
    if (labels[id]?.names?.[locale] || !airportTerms[locale]?.test(label))
      continue;
    const trimmed = label.normalize("NFC").trim();
    if (!trimmed || trimmed === sites.get(id).city) continue;
    const key = `${id}:${locale}`;
    const current = best.get(key);
    if (current && current.entity !== entity) {
      disputed.add(key);
      continue;
    }
    if (
      !current ||
      priority > current.priority ||
      (priority === current.priority && trimmed < current.label)
    ) {
      best.set(key, { id, locale, priority, entity, label: trimmed });
    }
  }
}

const cache = argument("wikidata-directory");
if (cache) {
  for (const name of (await readdir(cache))
    .filter((name) => /^P23[89]-.*\.json$/.test(name))
    .sort()) {
    useLabels(JSON.parse(await readFile(path.join(cache, name), "utf8")));
  }
}
if (process.argv.includes("--wikidata")) {
  for (const [property, size] of [
    ["P238", 3],
    ["P239", 4],
  ]) {
    const codes = [...airportIds.keys()]
      .filter((code) => code.length === size)
      .sort();
    for (let offset = 0; offset < codes.length; offset += 100) {
      const values = codes
        .slice(offset, offset + 100)
        .map((code) => JSON.stringify(code))
        .join(" ");
      const query = `SELECT ?code ?entity ?coords ?label WHERE {
        VALUES ?code { ${values} }
        ?entity wdt:${property} ?code; wdt:P625 ?coords; rdfs:label ?label .
        FILTER(LANG(?label) IN (${languages.map((code) => JSON.stringify(code)).join(",")}))
      }`;
      const params = new URLSearchParams({ query, format: "json" });
      const response = await fetch(
        `https://query.wikidata.org/sparql?${params}`,
        {
          headers: {
            "User-Agent":
              "Keepraw-Fly-reference-updater/0.2 (https://github.com/keepraw/Keepraw-Fly)",
          },
          signal: AbortSignal.timeout(60_000),
        },
      );
      if (!response.ok)
        throw new Error(
          `Wikidata batch ${property} ${offset} failed (${response.status})`,
        );
      const data = await response.json();
      useLabels(
        data.results.bindings.map(({ code, entity, coords, label }) => [
          code.value,
          entity.value.split("/").at(-1),
          coords.value,
          label["xml:lang"],
          label.value,
        ]),
      );
    }
  }
}
for (const [key, { id, locale, entity, label }] of best) {
  if (disputed.has(key)) continue;
  const names = ((labels[id] ??= {}).names ??= {});
  names[locale] = [
    locale === "zh-CN" ? toCn(label) : locale === "zh-TW" ? toTw(label) : label,
    `wikidata:${date}:${entity}`,
  ];
}
for (const id of sites.keys()) {
  const names = labels[id]?.names;
  if (!names?.["zh-CN"] || names["zh-TW"]) continue;
  const [label, source] = names["zh-CN"];
  names["zh-TW"] = [toTw(label), `opencc:${source}`];
}
const rows = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
await writeFile(
  new URL("airport-names.json", base),
  `{\n${rows.map(([id, row]) => `  ${JSON.stringify(id)}: ${JSON.stringify(row)}`).join(",\n")}\n}\n`,
  "utf8",
);
console.log(`Saved airport-name records for ${rows.length} physical IDs.`);
