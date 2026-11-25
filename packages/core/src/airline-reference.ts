import airlineRows from "../data/airlines.json";
import airlineOverrideRows from "../data/airline-overrides.json";
import type { SupportedLocale } from "./reference-data";

type AirlineRow = [string, string, string, string, string];

export interface AirlineReference {
  iata: string;
  icao: string;
  nameEn: string;
  nameZh: string;
  nameZhTw: string;
}

const referencesByIdentity = new Map<string, AirlineRow>();
for (const row of airlineRows as AirlineRow[]) {
  referencesByIdentity.set(`${row[0]}/${row[1]}`, row);
}
for (const row of airlineOverrideRows as AirlineRow[]) {
  const key = `${row[0]}/${row[1]}`;
  referencesByIdentity.delete(key);
  referencesByIdentity.set(key, row);
}

export const airlines: AirlineReference[] = [
  ...referencesByIdentity.values(),
].map(([iata, icao, nameEn, nameZh, nameZhTw]) => ({
  iata,
  icao,
  nameEn,
  nameZh,
  nameZhTw,
}));

const airlineByPair = new Map(
  airlines.map((airline) => [`${airline.iata}/${airline.icao}`, airline]),
);
// A single code is usable only when unique or covered by an explicit curated
// default. A complete pair always outranks such a default.
function codeIndex(field: "iata" | "icao") {
  const matches = new Map<string, AirlineReference>();
  const seen = new Set<string>();
  for (const airline of airlines) {
    const code = airline[field];
    if (seen.has(code)) matches.delete(code);
    else matches.set(code, airline);
    seen.add(code);
  }
  for (const [iata, icao] of airlineOverrideRows as AirlineRow[]) {
    const airline = airlineByPair.get(`${iata}/${icao}`)!;
    matches.set(airline[field], airline);
  }
  return matches;
}
export const airlineByIata = codeIndex("iata");
export const airlineByIcao = codeIndex("icao");

export function resolveAirline(
  codeOrReference: string | { iata?: string; icao?: string },
): AirlineReference | undefined {
  if (typeof codeOrReference === "string") {
    const code = codeOrReference.trim().toUpperCase();
    return airlineByIata.get(code) ?? airlineByIcao.get(code);
  }
  const iata = codeOrReference.iata?.trim().toUpperCase();
  const icao = codeOrReference.icao?.trim().toUpperCase();
  if (iata && icao) return airlineByPair.get(`${iata}/${icao}`);
  return iata
    ? airlineByIata.get(iata)
    : icao
      ? airlineByIcao.get(icao)
      : undefined;
}

export function airlineNames(
  airline: AirlineReference,
  locale: SupportedLocale,
): [string, string] {
  if (locale === "zh-CN")
    return [airline.nameZh || airline.nameEn, airline.nameEn];
  if (locale === "zh-TW")
    return [airline.nameZhTw || airline.nameEn, airline.nameEn];
  return [airline.nameEn, airline.nameZh];
}

export function airlineSearchText(reference: {
  iata?: string;
  icao?: string;
}): string {
  const airline = resolveAirline(reference);
  return airline
    ? [
        airline.iata,
        airline.icao,
        airline.nameEn,
        airline.nameZh,
        airline.nameZhTw,
      ].join(" ")
    : [reference.iata, reference.icao].filter(Boolean).join(" ");
}

export function canonicalAirlineCode(
  codeOrReference: string | { iata?: string; icao?: string },
): string {
  const airline = resolveAirline(codeOrReference);
  if (airline)
    return airlineByIata.get(airline.iata) === airline
      ? airline.iata
      : airline.icao;
  return typeof codeOrReference === "string"
    ? codeOrReference.trim().toUpperCase()
    : codeOrReference.iata || codeOrReference.icao || "";
}

export function searchAirlines(query: string): AirlineReference[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const seen = new Set<string>();
  return airlines
    .filter((airline) =>
      airlineSearchText(airline).toLocaleLowerCase().includes(normalized),
    )
    .sort(
      (left, right) =>
        airlineSearchRank(left, normalized) -
          airlineSearchRank(right, normalized) ||
        canonicalAirlineCode(left).localeCompare(canonicalAirlineCode(right)),
    )
    .filter((airline) => {
      const code = canonicalAirlineCode(airline);
      if (!code || seen.has(code)) return false;
      seen.add(code);
      return true;
    });
}

function airlineSearchRank(airline: AirlineReference, query: string): number {
  if (airline.iata.toLocaleLowerCase() === query)
    return airlineByIata.get(airline.iata) === airline ? 0 : 1;
  if (airline.icao.toLocaleLowerCase() === query) return 1;
  if (
    [airline.nameEn, airline.nameZh, airline.nameZhTw].some((name) =>
      name.toLocaleLowerCase().startsWith(query),
    )
  )
    return 2;
  return 3;
}
