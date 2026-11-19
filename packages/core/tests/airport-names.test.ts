import { describe, expect, it } from "vitest";
import airportRows from "../data/airports.iata.json";
import formal from "../data/airport-history/formal/airports.json";
import manifest from "../data/airport-history/formal/manifest.json";
import {
  airportById,
  airportByIata,
  airportIdsBySearchCode,
  airportHistoryDataVersion,
  airportHistoryQueryHorizon,
  formalAssignments,
  formalHistoricalNames,
  installAirportDirectory,
  localizedAirportName,
  resolveAirportAtDate,
  resolveEndpointIdentity,
  searchAirports,
  searchHistoricalAirports,
  type CompactAirportRow,
} from "../src";

const rows = airportRows as CompactAirportRow[];
installAirportDirectory(rows);

const liuting = "apt_f470ecb5-c6dc-4516-a233-37302da2115b";
const jiaodong = "apt_6729d2b2-4b79-48c8-9c42-0d4eeba121b8";
const taoLabels = [
  [
    "en-US",
    "Qingdao Liuting International Airport",
    "Qingdao Jiaodong International Airport",
  ],
  [
    "en-GB",
    "Qingdao Liuting International Airport",
    "Qingdao Jiaodong International Airport",
  ],
  ["zh-CN", "青岛流亭国际机场", "青岛胶东国际机场"],
  ["zh-TW", "青島流亭國際機場", "青島膠東國際機場"],
  ["ja-JP", "青島流亭国際空港", "青島膠東国際空港"],
  ["ko-KR", "칭다오 류팅 국제공항", "칭다오 자오둥 국제공항"],
] as const;

describe("formal data and Fly directory", () => {
  it("installs all published airport identities, names and assignments", () => {
    expect(airportHistoryDataVersion).toBe(manifest.dataVersion);
    expect(formal.schemaVersion).toBe(manifest.schemaVersion);
    expect(airportHistoryQueryHorizon).toEqual(manifest.queryHorizon);
    const formalIds = new Set(
      formal.airports.map((airport) => airport.airportId),
    );
    expect(formalIds.size).toBe(formal.airports.length);
    expect(formalHistoricalNames).toHaveLength(formal.names.length);
    if (["0.13.0", "0.14.0"].includes(manifest.dataVersion)) {
      expect(formalIds.size).toBe(6510);
      expect(
        formal.assignments.filter((row) => row.scheme === "IATA"),
      ).toHaveLength(6370);
      expect(
        formal.assignments.filter((row) => row.scheme === "ICAO"),
      ).toHaveLength(6214);
      expect(formalHistoricalNames).toHaveLength(3);
      expect(formalAssignments).toHaveLength(formal.assignments.length + 8);
    }
    expect(
      formal.airports.every(({ airportId }) => airportById.has(airportId)),
    ).toBe(true);
    expect(rows.every((row) => airportById.has(row[7]!))).toBe(true);
  });

  it("retains an existing confirmed ID and the same physical site after aliasing", () => {
    const legacy = rows.find((row) => row[0] === "SFO")![7]!;
    const current = resolveEndpointIdentity("SFO", "2024-06-15", "origin");
    const stored = resolveEndpointIdentity(
      "SFO",
      "2024-06-15",
      "origin",
      null,
      legacy,
    );
    expect(current.airportId).not.toBe(legacy);
    expect(stored.airportId).toBe(legacy);
    expect(stored.basis).toBe("user");
    expect(stored.point).toEqual(current.point);
    expect(stored.identityKey).toBe(current.identityKey);
    expect(localizedAirportName(legacy, "ja-JP")).toBe(
      localizedAirportName(current.airportId, "ja-JP"),
    );
  });

  it("indexes an ICAO-only airport without assigning it a synthetic IATA code", () => {
    const airport = [...airportById.values()].find(
      (row) => row.icao && !row.iata,
    )!;
    expect(airport).toBeDefined();
    expect(
      searchAirports(airport.icao!, "fr-FR").map((row) => row.airportId),
    ).toContain(airport.airportId);
  });

  it.each([
    ["PBI", "DJT", "apt_eb176a20-e0e3-438d-a330-a7b81185232d"],
    ["FRU", "BSZ", "apt_82a9b73d-530e-4f4a-9456-7f53c88246bc"],
  ])("indexes %s as history and %s as current", (oldCode, newCode, id) => {
    expect(airportById.get(id)?.currentIata).toBe(newCode);
    expect(airportByIata.get(newCode)).toMatchObject({
      airportId: id,
      currentIata: newCode,
    });
    expect(airportByIata.has(oldCode)).toBe(false);
    expect(airportIdsBySearchCode.get(oldCode)).toContain(id);
    expect(
      searchHistoricalAirports(oldCode).map((row) => row.airportId),
    ).toContain(id);
    expect(resolveAirportAtDate(oldCode, "2024-06-15").airportId).toBe(id);
  });

  it("keeps the closed PNH airport searchable without registering it as current", () => {
    const closed = resolveAirportAtDate("PNH", "2024-06-15").airport!;
    expect(closed.status).toBe("closed");
    expect(closed.currentIata).toBeUndefined();
    expect(airportByIata.has("PNH")).toBe(false);
    expect(airportIdsBySearchCode.get("PNH")).toContain(closed.airportId);
    expect(
      searchHistoricalAirports("PNH").map((row) => row.airportId),
    ).toContain(closed.airportId);
  });
});

describe("airport names by physical identity", () => {
  it.each([
    ["2010-06-15", liuting],
    ["2021-08-11", liuting],
    ["2021-08-12", jiaodong],
    ["2024-06-15", jiaodong],
  ])(
    "resolves TAO on %s and keeps the site across languages",
    (date, expectedId) => {
      const result = resolveAirportAtDate("TAO", date);
      expect(result).toMatchObject({
        status: "resolved",
        airportId: expectedId,
      });
      for (const [locale, oldLabel, newLabel] of taoLabels) {
        expect(localizedAirportName(result.airportId, locale, date)).toBe(
          expectedId === liuting ? oldLabel : newLabel,
        );
        expect(resolveAirportAtDate("TAO", date).airportId).toBe(expectedId);
      }
    },
  );

  it.each(taoLabels)(
    "finds both TAO sites by their %s names",
    (locale, oldLabel, newLabel) => {
      expect(
        searchAirports(oldLabel, locale).map((airport) => airport.airportId),
      ).toContain(liuting);
      expect(
        searchAirports(newLabel, locale).map((airport) => airport.airportId),
      ).toContain(jiaodong);
    },
  );

  it.each(["fr-FR", "de-DE", "es", "pt-BR"])(
    "supports %s labels and English fallback",
    (locale) => {
      const frankfurt = airportByIata.get("FRA")!;
      const translated = localizedAirportName(frankfurt.airportId, locale)!;
      expect(translated).not.toBe(frankfurt.name.en);
      expect(
        searchAirports(translated, "en-US").map((row) => row.airportId),
      ).toContain(frankfurt.airportId);
      const missing = [...airportById.values()].find(
        (row) => !row.name[locale.split("-")[0]!],
      )!;
      expect(localizedAirportName(missing.airportId, locale)).toBe(
        missing.name.en,
      );
    },
  );

  it.each([
    ["2016-01-01", "Международный аэропорт Астана"],
    ["2018-01-01", "Международный аэропорт Нурсултан Назарбаев"],
  ])(
    "uses the requested language for Astana on %s and indexes the original",
    (date, official) => {
      const astana = resolveAirportAtDate("NQZ", "2024-01-01").airportId;
      expect(localizedAirportName(astana, "ru", date)).toBe(official);
      expect(localizedAirportName(astana, "ru-RU", date)).toBe(official);
      expect(localizedAirportName(astana, "en", date)).toBe(
        "Nursultan Nazarbayev International Airport",
      );
      expect(localizedAirportName(astana, "zh-CN", date)).toBe(
        "努尔苏丹·纳扎尔巴耶夫国际机场",
      );
      expect(localizedAirportName(astana, "ja-JP", date)).toBe(
        "アスタナ国際空港",
      );
      expect(localizedAirportName(astana, "it-IT", date)).toBe(
        "Nursultan Nazarbayev International Airport",
      );
      expect(
        searchHistoricalAirports(official).map((row) => row.airportId),
      ).toContain(astana);
    },
  );

  it("falls back on the uncertain boundary between Astana's official names", () => {
    const astana = resolveAirportAtDate("NQZ", "2024-01-01").airportId;
    expect(localizedAirportName(astana, "ru", "2017-06-21")).toBe(
      localizedAirportName(astana, "en"),
    );
  });

  it.each([
    ["HKG", "1997-06-15", "HKG", "2024-06-15", "Kai Tak", "Chek Lap Kok"],
    ["IST", "2010-06-15", "IST", "2024-06-15", "Ataturk", "Istanbul"],
    ["BLR", "2005-06-15", "BLR", "2024-06-15", "HAL", "Kempegowda"],
    ["PNH", "2024-06-15", "KTI", "2026-06-15", "Phnom Penh", "Techo"],
    ["LYG", "2010-06-15", "LYG", "2024-06-15", "Baitabu", "Huaguoshan"],
    ["LZO", "2010-06-15", "LZO", "2024-06-15", "Lantian", "Yunlong"],
    ["YBP", "2010-06-15", "YBP", "2024-06-15", "Caiba", "Wuliangye"],
    [
      "PBI",
      "2024-06-15",
      "DJT",
      "2026-09-01",
      "International Airport",
      "International Airport",
    ],
    ["FRU", "2024-06-15", "BSZ", "2026-06-15", "Manas", "Manas"],
  ])(
    "resolves %s on %s and %s on %s",
    (oldCode, oldDate, newCode, newDate, oldName, newName) => {
      const previous = resolveAirportAtDate(oldCode, oldDate);
      const next = resolveAirportAtDate(newCode, newDate);
      expect(previous.status).toBe("resolved");
      expect(next.status).toBe("resolved");
      if (["PBI", "FRU"].includes(oldCode)) {
        expect(previous.airportId).toBe(next.airportId);
      } else {
        expect(previous.airportId).not.toBe(next.airportId);
      }
      expect(
        localizedAirportName(previous.airportId, "en", oldDate)
          ?.normalize("NFC")
          .toLowerCase(),
      ).toContain(oldName.toLowerCase());
      expect(
        localizedAirportName(next.airportId, "en", newDate)
          ?.normalize("NFC")
          .toLowerCase()
          .replaceAll("ı", "i"),
      ).toContain(newName.toLowerCase());
    },
  );
});
