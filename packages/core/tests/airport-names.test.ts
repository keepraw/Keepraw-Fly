import { describe, expect, it } from "vitest";
import airportRows from "../data/airports.iata.json";
import formal from "../data/airport-history/formal/airports.json";
import manifest from "../data/airport-history/formal/manifest.json";
import {
  airportById,
  airportByIata,
  airportHistoryDataVersion,
  airportHistoryQueryHorizon,
  formalAssignments,
  formalHistoricalNames,
  formalSources,
  installAirportDirectory,
  localizedAirportName,
  resolveAirportAtDate,
  resolveEndpointIdentity,
  searchAirports,
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
  it("installs all the Airport History 0.13.0 identities, names and claims", () => {
    expect(airportHistoryDataVersion).toBe(manifest.dataVersion);
    expect(formal.schemaVersion).toBe(manifest.schemaVersion);
    expect(airportHistoryQueryHorizon).toEqual(manifest.queryHorizon);
    const formalIds = new Set(
      formal.airports.map((airport) => airport.airportId),
    );
    expect(formalIds.size).toBe(formal.airports.length);
    expect(formalHistoricalNames).toHaveLength(formal.names.length);
    expect(formalSources.size).toBe(formal.sources.length);
    if (manifest.dataVersion === "0.13.0") {
      expect(formalIds.size).toBe(6510);
      expect(
        formalAssignments.filter((row) => row.scheme === "IATA"),
      ).toHaveLength(6370);
      expect(
        formalAssignments.filter((row) => row.scheme === "ICAO"),
      ).toHaveLength(6214);
      expect(formalHistoricalNames).toHaveLength(3);
      expect(formalSources.size).toBe(214);
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

  it("selects verified date-effective official names and falls back on the uncertain boundary", () => {
    const astana = resolveAirportAtDate("NQZ", "2024-01-01").airportId;
    const old = localizedAirportName(astana, "ru", "2016-01-01");
    const recent = localizedAirportName(astana, "ru", "2018-01-01");
    expect(old).toBe("Международный аэропорт Астана");
    expect(recent).toBe("Международный аэропорт Нурсултан Назарбаев");
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
