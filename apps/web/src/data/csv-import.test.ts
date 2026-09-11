import { describe, expect, it } from "vitest";
import airportRows from "@keepraw-fly/core/airport-directory";
import { installAirportDirectory, type CompactAirportRow } from "@keepraw-fly/core";
import { buildDocumentFromCsv, detectCsvMapping, parseCsv } from "./csv-import";

installAirportDirectory(airportRows as CompactAirportRow[]);

const csv = `Flight Number,Date,From,To,Departure Time,Arrival Time\nMU589,2026-09-02,PVG,SFO,2026-09-02T13:00:00+08:00,2026-09-02T09:20:00-07:00`;

describe("CSV flight import", () => {
  it("parses quoted cells and detects common header aliases", () => {
    const parsed = parseCsv(csv.replace("MU589", '"MU589"'));
    expect(parsed.rows[0]?.[0]).toBe("MU589");
    expect(detectCsvMapping(parsed.headers)).toEqual({
      flightNumber: 0,
      serviceDate: 1,
      originIata: 2,
      destinationIata: 3,
      scheduledDeparture: 4,
      scheduledArrival: 5,
    });
  });

  it("builds canonical flights and appends without changing the base profile", () => {
    const parsed = parseCsv(csv);
    const document = buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), {
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: { name: { romanized: "Yuan Lin" } },
      flights: [],
    }, () => "csv-id");
    expect(document.profile.name?.romanized).toBe("Yuan Lin");
    expect(document.flights[0]).toMatchObject({
      id: "flight-csv-id",
      flightNumber: "MU589",
      origin: { iata: "PVG" },
      destination: { iata: "SFO" },
    });
  });

  it("requires explicit timezone offsets", () => {
    const parsed = parseCsv(csv.replace("2026-09-02T13:00:00+08:00", "2026-09-02T13:00:00"));
    expect(() => buildDocumentFromCsv(parsed, detectCsvMapping(parsed.headers), null))
      .toThrow("line-2:timezone-required");
  });
});
