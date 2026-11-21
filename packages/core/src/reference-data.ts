import airportNameRows from "../data/airport-names.json";
import bootstrapIds from "../data/airport-bootstrap-ids.json";
import formalDirectory from "../data/airport-history/formal/directory.json";
import {
  assignmentDateRelation,
  assignmentsByAirportId,
  formalAirports,
  formalAssignmentsForCode,
  historicalNamesByAirportId,
  latestFormalCodesByAirportId,
} from "./formal-airport-data";

/** BCP 47 locale accepted by Intl; independent of the released UI languages. */
export type SupportedLocale = string;

export interface LocalizedText {
  en: string;
  [locale: string]: string | undefined;
}

export interface AirportReference {
  airportId: string;
  icao?: string;
  currentIata?: string;
  historicalNames?: string[];
  searchAliases?: string[];
  status?: "operating" | "closed" | "unknown";
  iata?: string;
  name: LocalizedText;
  city: LocalizedText;
  country: string;
  countryName: LocalizedText;
  latitude: number;
  longitude: number;
  timezone: string | null;
}

export type CompactAirportRow = [
  string,
  string,
  string,
  string,
  number,
  number,
  string,
  string?,
  string?,
  string?,
  string[]?,
  string[]?,
];
type CurrentAirportReference = AirportReference & {
  iata: string;
  currentIata: string;
};
interface AirportNameRecord {
  names?: Record<string, [label: string, source: string]>;
  cities?: Record<string, string>;
}
interface FormalDirectoryRow {
  city: string;
  citySource?: "ourAirports";
  country: string;
  countrySource?: "ourAirports";
  status: NonNullable<AirportReference["status"]>;
  legacyIds?: string[];
  iata?: string;
  timezone?: string;
}

const airportNames = airportNameRows as unknown as Record<
  string,
  AirportNameRecord
>;
const referenceMetadata = formalDirectory as Record<string, FormalDirectoryRow>;
const canonicalIds = new Map(
  Object.entries(referenceMetadata).flatMap(([id, row]) =>
    (row.legacyIds ?? []).map((legacy) => [legacy, id] as const),
  ),
);

function namesForAirport(airportId: string, canonical: string): LocalizedText {
  return {
    en: canonical,
    ...Object.fromEntries(
      Object.entries(airportNames[airportId]?.names ?? {}).map(
        ([locale, [label]]) => [locale, label],
      ),
    ),
  };
}

const englishRegions = new Intl.DisplayNames(["en"], { type: "region" });
const chineseRegions = new Intl.DisplayNames(["zh-CN"], { type: "region" });
const traditionalChineseRegions = new Intl.DisplayNames(["zh-TW"], {
  type: "region",
});

const countryNames = new Map<string, LocalizedText>();

function countryName(country: string): LocalizedText {
  const cached = countryNames.get(country);
  if (cached) return cached;
  const names = {
    en: englishRegions.of(country) ?? country,
    "zh-CN": chineseRegions.of(country) ?? country,
    "zh-TW": traditionalChineseRegions.of(country) ?? country,
  };
  countryNames.set(country, names);
  return names;
}

export function localizedText(
  text: LocalizedText,
  locale: SupportedLocale,
): string {
  return text[locale] || text[locale.split("-")[0] ?? "en"] || text.en;
}

const curatedAirports: (Omit<AirportReference, "airportId"> & {
  iata: string;
})[] = [
  {
    iata: "SFO",
    name: {
      en: "San Francisco International Airport",
      "zh-CN": "旧金山国际机场",
    },
    city: { en: "San Francisco", "zh-CN": "旧金山" },
    country: "US",
    countryName: { en: "United States", "zh-CN": "美国" },
    latitude: 37.6213,
    longitude: -122.379,
    timezone: "America/Los_Angeles",
  },
  {
    iata: "LAX",
    name: {
      en: "Los Angeles International Airport",
      "zh-CN": "洛杉矶国际机场",
    },
    city: { en: "Los Angeles", "zh-CN": "洛杉矶" },
    country: "US",
    countryName: { en: "United States", "zh-CN": "美国" },
    latitude: 33.9416,
    longitude: -118.4085,
    timezone: "America/Los_Angeles",
  },
  {
    iata: "JFK",
    name: {
      en: "John F. Kennedy International Airport",
      "zh-CN": "纽约肯尼迪国际机场",
    },
    city: { en: "New York", "zh-CN": "纽约" },
    country: "US",
    countryName: { en: "United States", "zh-CN": "美国" },
    latitude: 40.6413,
    longitude: -73.7781,
    timezone: "America/New_York",
  },
  {
    iata: "LGA",
    name: { en: "LaGuardia Airport", "zh-CN": "纽约拉瓜迪亚机场" },
    city: { en: "New York", "zh-CN": "纽约" },
    country: "US",
    countryName: { en: "United States", "zh-CN": "美国" },
    latitude: 40.777242,
    longitude: -73.872606,
    timezone: "America/New_York",
  },
  {
    iata: "EWR",
    name: {
      en: "Newark Liberty International Airport",
      "zh-CN": "纽瓦克自由国际机场",
    },
    city: { en: "Newark", "zh-CN": "纽瓦克" },
    country: "US",
    countryName: { en: "United States", "zh-CN": "美国" },
    latitude: 40.692481,
    longitude: -74.168688,
    timezone: "America/New_York",
  },
  {
    iata: "BOS",
    name: {
      en: "Boston Logan International Airport",
      "zh-CN": "波士顿洛根国际机场",
    },
    city: { en: "Boston", "zh-CN": "波士顿" },
    country: "US",
    countryName: { en: "United States", "zh-CN": "美国" },
    latitude: 42.3656,
    longitude: -71.0096,
    timezone: "America/New_York",
  },
  {
    iata: "ORD",
    name: {
      en: "Chicago O'Hare International Airport",
      "zh-CN": "芝加哥奥黑尔国际机场",
    },
    city: { en: "Chicago", "zh-CN": "芝加哥" },
    country: "US",
    countryName: { en: "United States", "zh-CN": "美国" },
    latitude: 41.9742,
    longitude: -87.9073,
    timezone: "America/Chicago",
  },
  {
    iata: "DFW",
    name: {
      en: "Dallas Fort Worth International Airport",
      "zh-CN": "达拉斯沃思堡国际机场",
    },
    city: { en: "Dallas", "zh-CN": "达拉斯" },
    country: "US",
    countryName: { en: "United States", "zh-CN": "美国" },
    latitude: 32.8998,
    longitude: -97.0403,
    timezone: "America/Chicago",
  },
  {
    iata: "SEA",
    name: {
      en: "Seattle-Tacoma International Airport",
      "zh-CN": "西雅图塔科马国际机场",
    },
    city: { en: "Seattle", "zh-CN": "西雅图" },
    country: "US",
    countryName: { en: "United States", "zh-CN": "美国" },
    latitude: 47.4502,
    longitude: -122.3088,
    timezone: "America/Los_Angeles",
  },
  {
    iata: "PVG",
    name: {
      en: "Shanghai Pudong International Airport",
      "zh-CN": "上海浦东国际机场",
    },
    city: { en: "Shanghai", "zh-CN": "上海" },
    country: "CN",
    countryName: { en: "China", "zh-CN": "中国" },
    latitude: 31.1443,
    longitude: 121.8083,
    timezone: "Asia/Shanghai",
  },
  {
    iata: "SHA",
    name: {
      en: "Shanghai Hongqiao International Airport",
      "zh-CN": "上海虹桥国际机场",
    },
    city: { en: "Shanghai", "zh-CN": "上海" },
    country: "CN",
    countryName: { en: "China", "zh-CN": "中国" },
    latitude: 31.1979,
    longitude: 121.336,
    timezone: "Asia/Shanghai",
  },
  {
    iata: "PEK",
    name: {
      en: "Beijing Capital International Airport",
      "zh-CN": "北京首都国际机场",
    },
    city: { en: "Beijing", "zh-CN": "北京" },
    country: "CN",
    countryName: { en: "China", "zh-CN": "中国" },
    latitude: 40.0799,
    longitude: 116.6031,
    timezone: "Asia/Shanghai",
  },
  {
    iata: "PKX",
    name: {
      en: "Beijing Daxing International Airport",
      "zh-CN": "北京大兴国际机场",
    },
    city: { en: "Beijing", "zh-CN": "北京" },
    country: "CN",
    countryName: { en: "China", "zh-CN": "中国" },
    latitude: 39.5,
    longitude: 116.4,
    timezone: "Asia/Shanghai",
  },
  {
    iata: "CAN",
    name: {
      en: "Guangzhou Baiyun International Airport",
      "zh-CN": "广州白云国际机场",
    },
    city: { en: "Guangzhou", "zh-CN": "广州" },
    country: "CN",
    countryName: { en: "China", "zh-CN": "中国" },
    latitude: 23.3924,
    longitude: 113.2988,
    timezone: "Asia/Shanghai",
  },
  {
    iata: "SZX",
    name: {
      en: "Shenzhen Bao'an International Airport",
      "zh-CN": "深圳宝安机场",
    },
    city: { en: "Shenzhen", "zh-CN": "深圳" },
    country: "CN",
    countryName: { en: "China", "zh-CN": "中国" },
    latitude: 22.6393,
    longitude: 113.811,
    timezone: "Asia/Shanghai",
  },
  {
    iata: "CTU",
    name: {
      en: "Chengdu Shuangliu International Airport",
      "zh-CN": "成都双流国际机场",
    },
    city: { en: "Chengdu", "zh-CN": "成都" },
    country: "CN",
    countryName: { en: "China", "zh-CN": "中国" },
    latitude: 30.5785,
    longitude: 103.9471,
    timezone: "Asia/Shanghai",
  },
  {
    iata: "TFU",
    name: {
      en: "Chengdu Tianfu International Airport",
      "zh-CN": "成都天府国际机场",
    },
    city: { en: "Chengdu", "zh-CN": "成都" },
    country: "CN",
    countryName: { en: "China", "zh-CN": "中国" },
    latitude: 30.29,
    longitude: 104.44333,
    timezone: "Asia/Shanghai",
  },
  {
    iata: "HKG",
    name: { en: "Hong Kong International Airport", "zh-CN": "香港国际机场" },
    city: { en: "Hong Kong", "zh-CN": "香港" },
    country: "HK",
    countryName: { en: "Hong Kong", "zh-CN": "中国香港" },
    latitude: 22.308,
    longitude: 113.9185,
    timezone: "Asia/Hong_Kong",
  },
  {
    iata: "TAO",
    name: {
      en: "Qingdao Jiaodong International Airport",
      "zh-CN": "青岛胶东机场",
    },
    city: { en: "Qingdao", "zh-CN": "青岛" },
    country: "CN",
    countryName: { en: "China", "zh-CN": "中国" },
    latitude: 36.365,
    longitude: 120.09833,
    timezone: "Asia/Shanghai",
  },
  {
    iata: "HND",
    name: { en: "Tokyo Haneda Airport", "zh-CN": "东京羽田机场" },
    city: { en: "Tokyo", "zh-CN": "东京" },
    country: "JP",
    countryName: { en: "Japan", "zh-CN": "日本" },
    latitude: 35.5494,
    longitude: 139.7798,
    timezone: "Asia/Tokyo",
  },
  {
    iata: "NRT",
    name: { en: "Narita International Airport", "zh-CN": "东京成田国际机场" },
    city: { en: "Tokyo", "zh-CN": "东京" },
    country: "JP",
    countryName: { en: "Japan", "zh-CN": "日本" },
    latitude: 35.772,
    longitude: 140.3929,
    timezone: "Asia/Tokyo",
  },
  {
    iata: "ICN",
    name: { en: "Incheon International Airport", "zh-CN": "首尔仁川国际机场" },
    city: { en: "Seoul", "zh-CN": "首尔" },
    country: "KR",
    countryName: { en: "South Korea", "zh-CN": "韩国" },
    latitude: 37.4602,
    longitude: 126.4407,
    timezone: "Asia/Seoul",
  },
  {
    iata: "GMP",
    name: { en: "Gimpo International Airport", "zh-CN": "首尔金浦国际机场" },
    city: { en: "Seoul", "zh-CN": "首尔" },
    country: "KR",
    countryName: { en: "South Korea", "zh-CN": "韩国" },
    latitude: 37.5583,
    longitude: 126.791,
    timezone: "Asia/Seoul",
  },
  {
    iata: "SIN",
    name: { en: "Singapore Changi Airport", "zh-CN": "新加坡樟宜机场" },
    city: { en: "Singapore", "zh-CN": "新加坡" },
    country: "SG",
    countryName: { en: "Singapore", "zh-CN": "新加坡" },
    latitude: 1.3644,
    longitude: 103.9915,
    timezone: "Asia/Singapore",
  },
  {
    iata: "LHR",
    name: { en: "London Heathrow Airport", "zh-CN": "伦敦希思罗机场" },
    city: { en: "London", "zh-CN": "伦敦" },
    country: "GB",
    countryName: { en: "United Kingdom", "zh-CN": "英国" },
    latitude: 51.47,
    longitude: -0.4543,
    timezone: "Europe/London",
  },
  {
    iata: "LCY",
    name: { en: "London City Airport", "zh-CN": "伦敦城市机场" },
    city: { en: "London", "zh-CN": "伦敦" },
    country: "GB",
    countryName: { en: "United Kingdom", "zh-CN": "英国" },
    latitude: 51.5053,
    longitude: 0.05528,
    timezone: "Europe/London",
  },
  {
    iata: "LGW",
    name: { en: "London Gatwick Airport", "zh-CN": "伦敦盖特威克机场" },
    city: { en: "London", "zh-CN": "伦敦" },
    country: "GB",
    countryName: { en: "United Kingdom", "zh-CN": "英国" },
    latitude: 51.1481,
    longitude: -0.19028,
    timezone: "Europe/London",
  },
  {
    iata: "LTN",
    name: { en: "London Luton Airport", "zh-CN": "伦敦卢顿机场" },
    city: { en: "London", "zh-CN": "伦敦" },
    country: "GB",
    countryName: { en: "United Kingdom", "zh-CN": "英国" },
    latitude: 51.8747,
    longitude: -0.36833,
    timezone: "Europe/London",
  },
  {
    iata: "STN",
    name: { en: "London Stansted Airport", "zh-CN": "伦敦斯坦斯特德机场" },
    city: { en: "London", "zh-CN": "伦敦" },
    country: "GB",
    countryName: { en: "United Kingdom", "zh-CN": "英国" },
    latitude: 51.885,
    longitude: 0.235,
    timezone: "Europe/London",
  },
  {
    iata: "CDG",
    name: { en: "Paris Charles de Gaulle Airport", "zh-CN": "巴黎戴高乐机场" },
    city: { en: "Paris", "zh-CN": "巴黎" },
    country: "FR",
    countryName: { en: "France", "zh-CN": "法国" },
    latitude: 49.0097,
    longitude: 2.5479,
    timezone: "Europe/Paris",
  },
  {
    iata: "ORY",
    name: { en: "Paris Orly Airport", "zh-CN": "巴黎奥利机场" },
    city: { en: "Paris", "zh-CN": "巴黎" },
    country: "FR",
    countryName: { en: "France", "zh-CN": "法国" },
    latitude: 48.7253,
    longitude: 2.35944,
    timezone: "Europe/Paris",
  },
  {
    iata: "FRA",
    name: { en: "Frankfurt Airport", "zh-CN": "法兰克福机场" },
    city: { en: "Frankfurt", "zh-CN": "法兰克福" },
    country: "DE",
    countryName: { en: "Germany", "zh-CN": "德国" },
    latitude: 50.0379,
    longitude: 8.5622,
    timezone: "Europe/Berlin",
  },
  {
    iata: "SYD",
    name: {
      en: "Sydney Kingsford Smith Airport",
      "zh-CN": "悉尼金斯福德·史密斯机场",
    },
    city: { en: "Sydney", "zh-CN": "悉尼" },
    country: "AU",
    countryName: { en: "Australia", "zh-CN": "澳大利亚" },
    latitude: -33.9399,
    longitude: 151.1753,
    timezone: "Australia/Sydney",
  },
  {
    iata: "YVR",
    name: { en: "Vancouver International Airport", "zh-CN": "温哥华国际机场" },
    city: { en: "Vancouver", "zh-CN": "温哥华" },
    country: "CA",
    countryName: { en: "Canada", "zh-CN": "加拿大" },
    latitude: 49.1967,
    longitude: -123.1815,
    timezone: "America/Vancouver",
  },
];

export const airports: CurrentAirportReference[] = [];
export const airportByIata = new Map<string, CurrentAirportReference>();
/** Lookup by canonical physical ID or a preserved Fly ID for the same site. */
export const airportById = new Map<string, AirportReference>();
export const airportIdsBySearchCode = new Map<string, Set<string>>();
const permanentIds = new Map<string, string>(Object.entries(bootstrapIds));
let directoryVersion = 0;

export function localizedAirportName(
  airportId: string | null | undefined,
  locale: SupportedLocale,
  date?: string | null,
): string | undefined {
  if (!airportId) return undefined;
  const airport = airportById.get(airportId);
  if (!airport) return undefined;
  if (date) {
    const language = locale.split("-")[0]?.toLowerCase();
    const names = historicalNamesByAirportId.get(airport.airportId);
    const possible = names?.filter(
      (row) =>
        row.kind === "official" &&
        row.language.split("-")[0]?.toLowerCase() === language &&
        assignmentDateRelation(date, row) !== "excluded",
    );
    if (possible?.length === 1) {
      const [row] = possible;
      if (row && assignmentDateRelation(date, row) === "certain") {
        return row.name;
      }
    }
  }
  return localizedText(airport.name, locale);
}

function storeFlyReference(airport: AirportReference): void {
  const { iata, status } = airport;
  if (status === "operating") {
    const assigned = latestFormalCodesByAirportId.get(airport.airportId)
      ?.IATA[0];
    if (assigned) airport.currentIata = assigned;
    else if (
      iata &&
      /^[A-Z]{3}$/.test(iata) &&
      !formalAssignmentsForCode(iata).length
    )
      airport.currentIata = iata;
  }
  airportById.set(airport.airportId, airport);
}

/** Install static reference rows while preserving the existing exported indexes. */
export function installAirportDirectory(
  rows: readonly CompactAirportRow[],
): void {
  airportByIata.clear();
  airportById.clear();
  airportIdsBySearchCode.clear();

  for (const [
    iata,
    name,
    city,
    country,
    latitude,
    longitude,
    timezone,
    airportId,
    icao,
    status,
    historicalNames,
    searchAliases,
  ] of rows) {
    const id = airportId ?? permanentIds.get(iata);
    if (!id) continue;
    const airport: AirportReference = {
      iata,
      icao,
      airportId: id,
      name: namesForAirport(id, name),
      city: { en: city, ...airportNames[canonicalIds.get(id) ?? id]?.cities },
      country,
      countryName: countryName(country),
      latitude,
      longitude,
      timezone,
      status: (status ?? "operating") as AirportReference["status"],
      historicalNames: historicalNames ?? [],
      searchAliases: searchAliases ?? [],
    };
    storeFlyReference(airport);
  }

  if (!rows.length) {
    for (const row of curatedAirports) {
      const id = permanentIds.get(row.iata);
      if (!id) continue;
      storeFlyReference({
        ...row,
        airportId: id,
        status: "operating",
        name: { ...row.name, ...namesForAirport(id, row.name.en) },
        city: { ...row.city, ...airportNames[id]?.cities },
      });
    }
  }

  const directoryCodeCandidates = new Map<string, string>();
  for (const raw of formalAirports) {
    const metadata = referenceMetadata[raw.airportId]!;
    const entries = [raw.airportId, ...(metadata.legacyIds ?? [])]
      .map((id) => airportById.get(id))
      .filter((entry) => entry !== undefined);
    const assignments = assignmentsByAirportId.get(raw.airportId) ?? [];
    const sameEntity = entries[0];
    const status = metadata.status;
    const codes =
      status === "closed"
        ? undefined
        : latestFormalCodesByAirportId.get(raw.airportId);
    const currentIata = codes?.IATA[0];
    // A formal physical identity can have ICAO evidence without ever having
    // a formal IATA assignment. Retain the same site's actual directory code
    // as a candidate, never a code from formal metadata or a search alias.
    const directoryCode = sameEntity?.currentIata;
    if (
      !currentIata &&
      status === "operating" &&
      directoryCode &&
      directoryCode === sameEntity?.iata &&
      !formalAssignmentsForCode(directoryCode).length &&
      !assignments.some((row) => row.scheme === "IATA")
    )
      directoryCodeCandidates.set(raw.airportId, directoryCode);
    const iata =
      currentIata ??
      sameEntity?.iata ??
      metadata.iata ??
      assignments.find((row) => row.scheme === "IATA")?.code;
    const legacyIcao = sameEntity?.icao;
    const icao =
      codes?.ICAO[0] ??
      (status !== "closed" &&
      legacyIcao &&
      !formalAssignmentsForCode(legacyIcao, "ICAO").length
        ? legacyIcao
        : undefined);
    const canonicalName = sameEntity?.name.en ?? raw.name.value!;
    const city =
      metadata.citySource && metadata.city !== sameEntity?.city.en
        ? { en: metadata.city }
        : (sameEntity?.city ?? {
            en: metadata.city,
            ...airportNames[raw.airportId]?.cities,
          });
    const country = metadata.countrySource
      ? metadata.country
      : (sameEntity?.country ?? metadata.country);
    const airport: AirportReference = {
      airportId: raw.airportId,
      iata,
      currentIata,
      icao,
      status,
      name: {
        ...sameEntity?.name,
        ...namesForAirport(raw.airportId, canonicalName),
      },
      city,
      country,
      countryName:
        country === sameEntity?.country
          ? sameEntity.countryName
          : countryName(country),
      latitude: sameEntity?.latitude ?? raw.coordinates.value!.latitude,
      longitude: sameEntity?.longitude ?? raw.coordinates.value!.longitude,
      timezone:
        raw.timezone.value ?? metadata.timezone ?? sameEntity?.timezone ?? null,
      historicalNames: [
        ...new Set([
          ...entries.flatMap((row) => row.historicalNames ?? []),
          ...(historicalNamesByAirportId.get(raw.airportId) ?? []).map(
            (row) => row.name,
          ),
          ...(raw.name.value && raw.name.value !== canonicalName
            ? [raw.name.value]
            : []),
        ]),
      ],
      searchAliases: [
        ...new Set(
          [
            ...entries.flatMap((row) => [
              row.iata,
              row.icao,
              ...(row.searchAliases ?? []),
            ]),
            metadata.iata,
            ...assignments.map((row) => row.code),
          ].filter((value): value is string => Boolean(value)),
        ),
      ],
    };
    airportById.set(raw.airportId, airport);
    for (const legacyId of metadata.legacyIds ?? [])
      airportById.set(legacyId, airport);
  }

  for (const [id, airport] of airportById) {
    if (airport.airportId !== id) continue;
    if (airport.currentIata) {
      const currentCodes = latestFormalCodesByAirportId.get(id)?.IATA ?? [
        airport.currentIata,
      ];
      for (const code of currentCodes)
        airportByIata.set(code, { ...airport, iata: code, currentIata: code });
    }
    for (const code of [
      airport.iata,
      airport.icao,
      ...(airport.searchAliases ?? []),
    ]) {
      if (!code) continue;
      const ids = airportIdsBySearchCode.get(code);
      if (ids) ids.add(airport.airportId);
      else airportIdsBySearchCode.set(code, new Set([airport.airportId]));
    }
  }
  for (const [id, code] of directoryCodeCandidates) {
    const sites = airportIdsBySearchCode.get(code);
    if (sites?.size !== 1 || !sites.has(id)) continue;
    const airport = airportById.get(id)!;
    airport.currentIata = code;
    airportByIata.set(code, { ...airport, iata: code, currentIata: code });
  }
  airports.splice(
    0,
    airports.length,
    ...[...airportByIata.values()].sort((a, b) => a.iata.localeCompare(b.iata)),
  );
  directoryVersion += 1;
}

export function airportDirectoryVersion(): number {
  return directoryVersion;
}

installAirportDirectory([]);
