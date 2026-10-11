import cityGroupRows from "../data/airport-city-groups.json";
import {
  localizedText,
  type LocalizedText,
  type SupportedLocale,
} from "./reference-data";

type CompactCityGroupRow = [string, string, string, string[]];

export interface AirportCityGroup {
  code: string;
  name: LocalizedText;
  country: string;
  airportCodes: string[];
}

const localizedCityNames: Record<string, LocalizedText> = {
  ANK: { en: "Ankara", "zh-CN": "安卡拉", "zh-TW": "安卡拉" },
  BFS: { en: "Belfast", "zh-CN": "贝尔法斯特", "zh-TW": "貝爾法斯特" },
  BHZ: {
    en: "Belo Horizonte",
    "zh-CN": "贝洛奥里藏特",
    "zh-TW": "貝洛奧裡藏特",
  },
  BJS: { en: "Beijing", "zh-CN": "北京", "zh-TW": "北京" },
  BKK: { en: "Bangkok", "zh-CN": "曼谷", "zh-TW": "曼谷" },
  BRU: { en: "Brussels", "zh-CN": "布鲁塞尔", "zh-TW": "布魯塞爾" },
  BUE: {
    en: "Buenos Aires",
    "zh-CN": "布宜诺斯艾利斯",
    "zh-TW": "布宜諾斯艾利斯",
  },
  CHI: { en: "Chicago", "zh-CN": "芝加哥", "zh-TW": "芝加哥" },
  CTU: { en: "Chengdu", "zh-CN": "成都", "zh-TW": "成都" },
  DFW: { en: "Dallas", "zh-CN": "达拉斯", "zh-TW": "達拉斯" },
  DKR: { en: "Dakar", "zh-CN": "达喀尔", "zh-TW": "達喀爾" },
  DXB: { en: "Dubai", "zh-CN": "迪拜", "zh-TW": "迪拜" },
  HOU: { en: "Houston", "zh-CN": "休斯敦", "zh-TW": "休斯敦" },
  IEV: { en: "Kyiv", "zh-CN": "基辅", "zh-TW": "基輔" },
  IST: { en: "Istanbul", "zh-CN": "伊斯坦布尔", "zh-TW": "伊斯坦布爾" },
  JKT: { en: "Jakarta", "zh-CN": "雅加达", "zh-TW": "雅加達" },
  JOG: { en: "Yogyakarta", "zh-CN": "日惹", "zh-TW": "日惹" },
  LON: { en: "London", "zh-CN": "伦敦", "zh-TW": "倫敦" },
  MEL: { en: "Melbourne", "zh-CN": "墨尔本", "zh-TW": "墨爾本" },
  MIL: { en: "Milan", "zh-CN": "米兰", "zh-TW": "米蘭" },
  MOW: { en: "Moscow", "zh-CN": "莫斯科", "zh-TW": "莫斯科" },
  NGO: { en: "Nagoya", "zh-CN": "名古屋", "zh-TW": "名古屋" },
  NYC: { en: "New York", "zh-CN": "纽约", "zh-TW": "紐約" },
  OSA: { en: "Osaka", "zh-CN": "大阪", "zh-TW": "大阪" },
  OSL: { en: "Oslo", "zh-CN": "奥斯陆", "zh-TW": "奧斯陸" },
  PAR: { en: "Paris", "zh-CN": "巴黎", "zh-TW": "巴黎" },
  REK: { en: "Reykjavik", "zh-CN": "雷克雅未克", "zh-TW": "雷克雅未克" },
  RIO: { en: "Rio de Janeiro", "zh-CN": "里约热内卢", "zh-TW": "里約熱內盧" },
  ROM: { en: "Rome", "zh-CN": "罗马", "zh-TW": "羅馬" },
  SAO: { en: "Sao Paulo", "zh-CN": "圣保罗", "zh-TW": "聖保羅" },
  SEL: { en: "Seoul", "zh-CN": "首尔", "zh-TW": "首爾" },
  SHA: { en: "Shanghai", "zh-CN": "上海", "zh-TW": "上海" },
  SLU: { en: "St Lucia", "zh-CN": "圣卢西亚", "zh-TW": "聖露西亞" },
  SPK: { en: "Sapporo", "zh-CN": "札幌", "zh-TW": "札幌" },
  STO: { en: "Stockholm", "zh-CN": "斯德哥尔摩", "zh-TW": "斯德哥爾摩" },
  TCI: { en: "Tenerife", "zh-CN": "特内里费", "zh-TW": "特內里費" },
  THR: { en: "Tehran", "zh-CN": "德黑兰", "zh-TW": "德黑蘭" },
  TPE: { en: "Taipei", "zh-CN": "台北", "zh-TW": "臺北" },
  TYO: { en: "Tokyo", "zh-CN": "东京", "zh-TW": "東京" },
  WAS: { en: "Washington", "zh-CN": "华盛顿", "zh-TW": "華盛頓" },
  YTO: { en: "Toronto", "zh-CN": "多伦多", "zh-TW": "多倫多" },
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
  if (airportCodes.length < 2) continue;
  groupsByCode.set(code, {
    code,
    name: localizedCityNames[code] ?? { en: name, "zh-CN": name },
    country,
    airportCodes,
  });
}

export const airportCityGroups = [...groupsByCode.values()].sort(
  (left, right) => left.code.localeCompare(right.code),
);
export const airportCityGroupByCode = new Map(
  airportCityGroups.map((group) => [group.code, group]),
);

const cityGroupByAirport = new Map<string, AirportCityGroup>();
for (const group of airportCityGroups) {
  for (const airportCode of group.airportCodes)
    cityGroupByAirport.set(airportCode, group);
}

export function airportCityGroupForAirport(
  iata: string,
): AirportCityGroup | undefined {
  return cityGroupByAirport.get(iata);
}

export function airportCityGroupName(
  group: AirportCityGroup,
  locale: SupportedLocale,
): string {
  return localizedText(group.name, locale);
}

/**
 * Compact *display-only* city labels, audited against the complete Chinese airport
 * locale directory. Airport reference data and search names stay unchanged.
 */
const preservedCitySuffixCountries = new Set(["BZ", "DJ", "LU", "TN"]);
const preservedCitySuffixNames = new Set([
  "胡志明市",
  "魁北克市",
  "马六甲市",
  "馬六甲市",
  "三联市",
  "三聯市",
  "凯山丰威汉市",
  "凱山豐威漢市",
  "坎特伯雷-班克斯镇市",
  "坎特伯雷-班克斯鎮市",
]);

export function formatCityDisplayName(
  name: string,
  country: string,
  locale: SupportedLocale,
): string {
  if (locale === "en" || !name.endsWith("市")) return name;
  // Korean 'metropolitan city' is an administrative suffix, not part of the label.
  if (country === "KR" && /(?:广域|廣域)市$/.test(name) && name.length > 3)
    return name.slice(0, -3);
  // Distinctive city names, very short names and municipality terminology
  // need their suffix to stay meaningful. Never strip all names blindly.
  if (
    preservedCitySuffixCountries.has(country) ||
    preservedCitySuffixNames.has(name) ||
    name.endsWith("自治市")
  )
    return name;
  if (country === "JP" && name === "萩市") return "萩";
  return name.length > 2 ? name.slice(0, -1) : name;
}
