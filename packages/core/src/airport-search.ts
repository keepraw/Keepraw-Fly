import { normalizeSearchValue } from "./normalization";
import {
  airportById,
  airportByIata,
  airportDirectoryVersion,
  localizedText,
  type AirportReference,
  type SupportedLocale,
} from "./reference-data";
import {
  airportCityGroupByCode,
  airportCityGroupForAirport,
} from "./airport-cities";

interface AirportSearchEntry {
  airport: AirportReference;
  code: string;
  aliases: string[];
  cities: string[];
  names: string[];
  cityGroupAliases: string[];
  text: string;
}

let indexedDirectoryVersion = -1;
const searchIndex = new Map<string, AirportSearchEntry[]>();

function normalizeNames(values: (string | undefined)[]): string[] {
  return [
    ...new Set(
      values
        .filter((value): value is string => Boolean(value))
        .map(normalizeSearchValue),
    ),
  ];
}

function ensureSearchIndex(): void {
  if (indexedDirectoryVersion === airportDirectoryVersion()) return;
  searchIndex.clear();
  for (const [id, airport] of airportById) {
    if (airport.airportId !== id) continue;
    const cities = normalizeNames(Object.values(airport.city));
    const names = normalizeNames([
      ...Object.values(airport.name),
      ...(airport.historicalNames ?? []),
    ]);
    const group = airport.currentIata
      ? airportCityGroupForAirport(airport.currentIata)
      : undefined;
    const cityGroupAliases = group
      ? normalizeNames([group.code, ...Object.values(group.name)])
      : [];
    const aliases = normalizeNames([
      airport.icao,
      ...(airport.searchAliases ?? []),
    ]);
    const code = normalizeSearchValue(
      airport.currentIata ?? airport.iata ?? "",
    );
    const text = [
      code,
      ...aliases,
      ...cities,
      ...names,
      ...cityGroupAliases,
      ...normalizeNames(Object.values(airport.countryName)),
    ].join(" ");
    const entry = {
      airport,
      code,
      aliases,
      cities,
      names,
      cityGroupAliases,
      text,
    };
    const prefixes = new Set<string>();
    for (let offset = 0; offset < text.length; offset++) {
      prefixes.add(text[offset]!);
      if (offset + 1 < text.length)
        prefixes.add(text.slice(offset, offset + 2));
    }
    for (const prefix of prefixes) {
      const matches = searchIndex.get(prefix);
      if (matches) matches.push(entry);
      else searchIndex.set(prefix, [entry]);
    }
  }
  indexedDirectoryVersion = airportDirectoryVersion();
}

export function searchAirports(
  query: string,
  locale: SupportedLocale,
  limit = 8,
  include?: (airport: AirportReference) => boolean,
): AirportReference[] {
  const normalizedQuery = normalizeSearchValue(query.trim());
  if (!normalizedQuery || limit <= 0) return [];
  const exactCityGroup = airportCityGroupByCode.get(query.trim().toUpperCase());
  if (exactCityGroup) {
    return exactCityGroup.airportCodes
      .map((iata) => airportByIata.get(iata))
      .filter((airport) => airport !== undefined)
      .filter((airport) => !include || include(airport))
      .sort((left, right) => {
        if (left.iata === exactCityGroup.code) return -1;
        if (right.iata === exactCityGroup.code) return 1;
        return left.iata.localeCompare(right.iata);
      })
      .slice(0, limit);
  }
  ensureSearchIndex();
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const candidates = terms
    .map((term) => searchIndex.get(term.slice(0, 2)) ?? [])
    .reduce((a, b) => (a.length <= b.length ? a : b));
  const compareCity = new Intl.Collator(locale).compare;
  return candidates
    .filter(
      (entry) =>
        terms.every((term) => entry.text.includes(term)) &&
        (!include || include(entry.airport)),
    )
    .map((entry) => ({ entry, score: scoreAirport(entry, normalizedQuery) }))
    .sort(
      (left, right) =>
        left.score - right.score ||
        compareCity(
          localizedText(left.entry.airport.city, locale),
          localizedText(right.entry.airport.city, locale),
        ) ||
        left.entry.code.localeCompare(right.entry.code) ||
        left.entry.airport.airportId.localeCompare(
          right.entry.airport.airportId,
        ),
    )
    .slice(0, limit)
    .map(({ entry }) => entry.airport);
}

function scoreAirport(entry: AirportSearchEntry, query: string): number {
  if (entry.code === query && entry.airport.currentIata) return 0;
  if (entry.code === query || entry.aliases.includes(query)) return 1;
  if (
    entry.code.startsWith(query) ||
    entry.aliases.some((alias) => alias.startsWith(query))
  )
    return 2;
  if (entry.cityGroupAliases.includes(query)) return 3;
  if (entry.cities.includes(query)) return 4;
  if (entry.cities.some((city) => city.startsWith(query))) return 5;
  if (entry.names.some((name) => name.startsWith(query))) return 6;
  return 7;
}
