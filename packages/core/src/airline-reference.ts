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

export const airlines: AirlineReference[] = [...referencesByIdentity.values()].map(
  ([iata, icao, nameEn, nameZh, nameZhTw]) => ({ iata, icao, nameEn, nameZh, nameZhTw }),
);

export const airlineByIata = new Map(airlines.map((airline) => [airline.iata, airline]));
export const airlineByIcao = new Map(airlines.map((airline) => [airline.icao, airline]));

export function resolveAirline(codeOrReference: string | { iata?: string; icao?: string }): AirlineReference | undefined {
  if (typeof codeOrReference === "string") {
    const code = codeOrReference.trim().toUpperCase();
    return airlineByIata.get(code) ?? airlineByIcao.get(code);
  }
  return (codeOrReference.iata ? airlineByIata.get(codeOrReference.iata.toUpperCase()) : undefined)
    ?? (codeOrReference.icao ? airlineByIcao.get(codeOrReference.icao.toUpperCase()) : undefined);
}

export function airlineNames(airline: AirlineReference, locale: SupportedLocale): [string, string] {
  if (locale === "zh-CN") return [airline.nameZh, airline.nameEn];
  if (locale === "zh-TW") return [airline.nameZhTw, airline.nameEn];
  return [airline.nameEn, airline.nameZh];
}

export function airlineSearchText(reference: { iata?: string; icao?: string }): string {
  const airline = resolveAirline(reference);
  return airline
    ? [airline.iata, airline.icao, airline.nameEn, airline.nameZh, airline.nameZhTw].join(" ")
    : [reference.iata, reference.icao].filter(Boolean).join(" ");
}
