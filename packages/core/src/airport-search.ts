import { normalizeSearchValue } from "./normalization";
import { airportByIata, airports, type AirportReference, type SupportedLocale } from "./reference-data";
import { airportCityGroupByCode, airportCityGroupForAirport } from "./airport-cities";

interface AirportSearchEntry {
  airport: AirportReference;
  code: string;
  cities: string[];
  names: string[];
  cityGroupAliases: string[];
  text: string;
}

const searchIndex: AirportSearchEntry[] = airports.map((airport) => {
  const cities = [...new Set(Object.values(airport.city).map(normalizeSearchValue))];
  const names = [...new Set(Object.values(airport.name).map(normalizeSearchValue))];
  const cityGroup = airportCityGroupForAirport(airport.iata);
  const cityGroupAliases = cityGroup
    ? [cityGroup.code, ...Object.values(cityGroup.name)].map(normalizeSearchValue)
    : [];
  return {
    airport,
    code: normalizeSearchValue(airport.iata),
    cities,
    names,
    cityGroupAliases,
    text: normalizeSearchValue([
      airport.iata,
      ...Object.values(airport.city),
      ...Object.values(airport.name),
      ...Object.values(airport.countryName),
      ...cityGroupAliases,
    ].join(" ")),
  };
});

export function searchAirports(
  query: string,
  locale: SupportedLocale,
  limit = 8,
): AirportReference[] {
  const normalizedQuery = normalizeSearchValue(query.trim());
  if (!normalizedQuery || limit <= 0) return [];
  const exactCityGroup = airportCityGroupByCode.get(query.trim().toUpperCase());
  if (exactCityGroup) {
    return exactCityGroup.airportCodes
      .map((iata) => airportByIata.get(iata))
      .filter((airport): airport is AirportReference => Boolean(airport))
      .sort((left, right) => {
        if (left.iata === exactCityGroup.code) return -1;
        if (right.iata === exactCityGroup.code) return 1;
        return left.iata.localeCompare(right.iata);
      })
      .slice(0, limit);
  }
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return searchIndex
    .filter((entry) => terms.every((term) => entry.text.includes(term)))
    .sort((left, right) => {
      const scoreDifference = scoreAirport(left, normalizedQuery) - scoreAirport(right, normalizedQuery);
      if (scoreDifference) return scoreDifference;
      const cityDifference = left.airport.city[locale].localeCompare(right.airport.city[locale], locale);
      return cityDifference || left.airport.iata.localeCompare(right.airport.iata);
    })
    .slice(0, limit)
    .map((entry) => entry.airport);
}

function scoreAirport(entry: AirportSearchEntry, query: string): number {
  if (entry.code === query) return 0;
  if (entry.code.startsWith(query)) return 1;
  if (entry.cityGroupAliases.some((alias) => alias === query)) return 2;
  if (entry.cities.some((city) => city === query)) return 3;
  if (entry.cities.some((city) => city.startsWith(query))) return 4;
  if (entry.names.some((name) => name.startsWith(query))) return 5;
  return 6;
}
