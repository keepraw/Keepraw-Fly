import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repository = "mborsetti/airportsdata";
const apiUrl = `https://api.github.com/repos/${repository}/commits/main`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "packages", "core", "data");

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": "Keepraw-Fly-airport-data-updater",
};

const commitResponse = await fetch(apiUrl, { headers });
if (!commitResponse.ok) throw new Error(`Unable to resolve airport-data revision: ${commitResponse.status}`);
const commit = await commitResponse.json();
const revision = commit.sha;
const rawBase = `https://raw.githubusercontent.com/${repository}/${revision}`;
const csvUrl = `${rawBase}/airportsdata/airports.csv`;
const licenseUrl = `${rawBase}/LICENSE`;

const [csvResponse, licenseResponse] = await Promise.all([
  fetch(csvUrl, { headers }),
  fetch(licenseUrl, { headers }),
]);
if (!csvResponse.ok) throw new Error(`Unable to download airport data: ${csvResponse.status}`);
if (!licenseResponse.ok) throw new Error(`Unable to download airport-data license: ${licenseResponse.status}`);

const rows = parseCsv(await csvResponse.text());
const header = rows.shift();
if (!header) throw new Error("Airport CSV is empty");
const columns = new Map(header.map((name, index) => [name, index]));
const value = (row, name) => row[columns.get(name)] ?? "";
const airportsByIata = new Map();

for (const row of rows) {
  const iata = value(row, "iata").trim().toUpperCase();
  const latitude = Number(value(row, "lat"));
  const longitude = Number(value(row, "lon"));
  const timezone = value(row, "tz").trim();
  if (!/^[A-Z]{3}$/.test(iata) || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !timezone) continue;

  airportsByIata.set(iata, [
    iata,
    value(row, "name").trim() || iata,
    value(row, "city").trim() || value(row, "name").trim() || iata,
    value(row, "country").trim().toUpperCase(),
    latitude,
    longitude,
    timezone,
  ]);
}

const airports = [...airportsByIata.values()].sort((left, right) => left[0].localeCompare(right[0]));
await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDirectory, "airports.iata.json"), `${JSON.stringify(airports)}\n`, "utf8"),
  writeFile(path.join(outputDirectory, "LICENSE.airportsdata"), await licenseResponse.text(), "utf8"),
  writeFile(path.join(outputDirectory, "airports.source.json"), `${JSON.stringify({
    source: `https://github.com/${repository}`,
    revision,
    csv: csvUrl,
    license: "MIT",
    generatedAt: new Date().toISOString(),
    airportCount: airports.length,
  }, null, 2)}\n`, "utf8"),
]);

console.log(`Generated ${airports.length} IATA airports from ${revision.slice(0, 12)}.`);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if (character === "\n" && !quoted) {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
