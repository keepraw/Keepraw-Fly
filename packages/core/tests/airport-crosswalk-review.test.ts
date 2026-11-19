import { describe, expect, it } from "vitest";
import airportRows from "../data/airports.iata.json";
import published from "../data/airport-history/formal/airports.json";
import {
  airportById,
  airportByIata,
  airportIdsBySearchCode,
  installAirportDirectory,
  resolveAirportAtDate,
  resolveEndpointIdentity,
  searchAirports,
  searchHistoricalAirports,
  type CompactAirportRow,
} from "../src";

const rows = airportRows as CompactAirportRow[];
installAirportDirectory(rows);

const cases = [
  {
    iata: "PQM",
    icao: "MMPQ",
    publishedId: "apt_ee3b4101-0ecd-4f9e-a574-4e2477735b67",
    oldSiteName: "Palenque Old Airport",
    lastOld: "2014-03-12",
    firstNew: "2014-03-13",
  },
  {
    iata: "MKM",
    icao: "WBGK",
    publishedId: "apt_261f97ee-84c4-4c97-a77a-24dd7db7fedf",
    oldSiteName: "Old Mukah STOLport",
    lastOld: "2021-06-16",
    firstNew: "2021-06-17",
  },
  {
    iata: "DSE",
    icao: "HADC",
    publishedId: "apt_18516e40-15cd-4374-a4fb-9e71ff0e3706",
    oldSiteName: "Old Combolcha Airport",
    lastOld: "2014-06-26",
    uncertainDate: "2014-09-10",
    firstNew: "2015-06-25",
  },
  {
    iata: "BTI",
    icao: "PABA",
    publishedId: "apt_2ab143ee-cd3b-4d44-99e0-5aaa35d55afc",
    oldSiteName: "Barter Island Long Range Radar Station Airport",
    lastOld: "2015-12-31",
    uncertainDate: "2016-10-13",
    firstNew: "2017-04-28",
  },
];

describe("reviewed crosswalk splits", () => {
  it.each(cases)(
    "$iata retains both permanent identities across the move",
    (test) => {
      const [iata, name, city, country, latitude, longitude, timezone, flyId] =
        rows.find((row) => row[0] === test.iata)!;
      const publishedSite = published.airports.find(
        (row) => row.airportId === test.publishedId,
      )!;
      const [former, replacement] =
        iata === "BTI"
          ? [test.publishedId, flyId!]
          : [flyId!, test.publishedId];
      expect(airportById.get(flyId!)).toMatchObject({
        airportId: flyId,
        name: { en: name },
        city: { en: city },
        country,
        latitude,
        longitude,
        timezone,
      });
      expect(airportById.get(test.publishedId)).toMatchObject({
        airportId: test.publishedId,
        ...publishedSite.coordinates.value,
        timezone,
      });
      expect(airportByIata.get(iata)?.airportId).toBe(replacement);
      expect(airportById.get(former)?.currentIata).toBeUndefined();
      const saved = resolveEndpointIdentity(
        iata,
        iata === "BTI" ? test.lastOld : test.firstNew,
        "origin",
        null,
        flyId,
      );
      expect(saved).toMatchObject({
        airportId: flyId,
        identityKey: `airport:${flyId}`,
        point: { latitude, longitude },
        basis: "user",
      });
      expect(
        searchHistoricalAirports(test.oldSiteName).map((row) => row.airportId),
      ).toContain(former);
      for (const [code, scheme] of [
        [iata, "IATA"],
        [test.icao, "ICAO"],
      ] as const) {
        expect(airportIdsBySearchCode.get(code)).toEqual(
          new Set([former, replacement]),
        );
        expect(searchAirports(code, "en").map((row) => row.airportId)).toEqual(
          expect.arrayContaining([former, replacement]),
        );
        expect(resolveAirportAtDate(code, test.lastOld, scheme).airportId).toBe(
          former,
        );
        expect(
          resolveAirportAtDate(code, test.firstNew, scheme).airportId,
        ).toBe(replacement);
        if (test.uncertainDate) {
          const handover = resolveAirportAtDate(
            code,
            test.uncertainDate,
            scheme,
          );
          expect(handover.status).toBe("uncertain");
          expect(handover.airportId).toBeNull();
          expect(handover.uncertainty.possibleAirportIds).toEqual([
            former,
            replacement,
          ]);
        }
      }
    },
  );
});
