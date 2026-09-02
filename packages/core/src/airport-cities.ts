import cityGroupRows from "../data/airport-city-groups.json";
import { airportByIata, type LocalizedText, type SupportedLocale } from "./reference-data";

type CompactCityGroupRow = [string, string, string, string[]];

export interface AirportCityGroup {
  code: string;
  name: LocalizedText;
  country: string;
  airportCodes: string[];
}

const localizedCityNames: Record<string, LocalizedText> = {
  BJS: { en: "Beijing", "zh-CN": "北京" },
  CTU: { en: "Chengdu", "zh-CN": "成都" },
  LON: { en: "London", "zh-CN": "伦敦" },
  NYC: { en: "New York", "zh-CN": "纽约" },
  PAR: { en: "Paris", "zh-CN": "巴黎" },
  SEL: { en: "Seoul", "zh-CN": "首尔" },
  SHA: { en: "Shanghai", "zh-CN": "上海" },
  TYO: { en: "Tokyo", "zh-CN": "东京" },
};

const maintainedGroups: CompactCityGroupRow[] = [
  ["CTU", "Chengdu", "CN", ["CTU", "TFU"]],
  ["NYC", "New York", "US", ["EWR", "JFK", "LGA"]],
];

const groupsByCode = new Map<string, AirportCityGroup>();
for (const [code, name, country, airportCodes] of [
  ...(cityGroupRows as CompactCityGroupRow[]),
  ...maintainedGroups,
]) {
  const validAirportCodes = airportCodes.filter((airportCode) => airportByIata.has(airportCode));
  if (validAirportCodes.length < 2) continue;
  groupsByCode.set(code, {
    code,
    name: localizedCityNames[code] ?? { en: name, "zh-CN": name },
    country,
    airportCodes: validAirportCodes,
  });
}

export const airportCityGroups = [...groupsByCode.values()].sort((left, right) => left.code.localeCompare(right.code));
export const airportCityGroupByCode = new Map(airportCityGroups.map((group) => [group.code, group]));

const cityGroupByAirport = new Map<string, AirportCityGroup>();
for (const group of airportCityGroups) {
  for (const airportCode of group.airportCodes) cityGroupByAirport.set(airportCode, group);
}

export function airportCityGroupForAirport(iata: string): AirportCityGroup | undefined {
  return cityGroupByAirport.get(iata);
}

export function airportCityGroupName(group: AirportCityGroup, locale: SupportedLocale): string {
  return group.name[locale];
}
