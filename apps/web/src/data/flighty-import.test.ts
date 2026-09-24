import { describe, expect, it } from "vitest";
import { validateKeeprawFly } from "@keepraw-fly/validator";
import airportRows from "@keepraw-fly/core/airport-directory";
import { installAirportDirectory, type CompactAirportRow } from "@keepraw-fly/core";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  buildDocumentFromFlightyPreflight,
  flightyIgnoredFields,
  isFlightyCsv,
  parseFlightyCsv,
  preflightFlightyImport,
} from "./flighty-import";

installAirportDirectory(airportRows as CompactAirportRow[]);

const headers = [
  "Date", "Airline", "Flight", "From", "To", "Dep Terminal", "Dep Gate", "Arr Terminal", "Arr Gate",
  "Canceled", "Diverted To", "Gate Departure (Scheduled)", "Gate Departure (Actual)",
  "Gate Arrival (Scheduled)", "Gate Arrival (Actual)", "Aircraft Type Name", "Tail Number", "PNR", "Seat", "Cabin Class",
];

function flightyCsv(rows: string[]): string {
  return [headers.join(","), ...rows].join("\n");
}

function ids(prefix: string): () => string {
  let count = 0;
  return () => `${prefix}-${++count}`;
}

describe("Flighty CSV import", () => {
  it("recognizes the real Flighty header shape and ignores unknown columns", () => {
    const parsed = parseFlightyCsv(`${flightyCsv(["2026-09-23,CES,5243,TAO,SHA,1,12,2,33,false,,2026-09-23T14:30,,2026-09-23T16:20,,Airbus A321,,,12A,ECONOMY"])}\nUnknown Flighty Column`);
    expect(isFlightyCsv(parsed)).toBe(true);
    expect(flightyIgnoredFields([...headers, "Flight Flighty ID"])).toEqual(["Flight Flighty ID"]);
  });

  it("maps ICAO airlines, endpoint facts, cabin and optional fields", () => {
    const parsed = parseFlightyCsv(flightyCsv([
      "2026-09-23,CES,5243,TAO,SHA,1,12,2,33,false,,2026-09-23T14:30,2026-09-23T14:40,2026-09-23T16:20,2026-09-23T16:35,Airbus A321,,DEMO01,12A,ECONOMY",
    ]));
    const preflight = preflightFlightyImport(parsed, null, () => "ces");
    const document = buildDocumentFromFlightyPreflight(preflight, null);

    expect(document.flights[0]).toMatchObject({
      flightNumber: "MU5243",
      airline: { iata: "MU", icao: "CES" },
      origin: { iata: "TAO", terminal: "1", gate: "12" },
      destination: { iata: "SHA", terminal: "2", gate: "33" },
      bookingReference: "DEMO01",
    });
    expect(document.flights[0]?.extensions).toMatchObject({
      "keepraw-fly.aircraft": { type: "Airbus A321" },
      "keepraw-fly.seat": { seat: "12A", cabin: "economy" },
    });
    expect(validateKeeprawFly(document).valid).toBe(true);
  });

  it("preserves memberships and existing references when appending Flighty flights", () => {
    const membership = {
      id: "ff-1",
      programId: "mileageplus",
      memberNumber: "UA001",
      tier: "gold",
      associatedAirlines: ["UA"],
      defaultAirline: "UA",
    };
    const existing: KeeprawFlyDocument = {
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: { name: { romanized: "Existing traveler" } },
      extensions: { "keepraw-fly.test": { preserved: true } },
      frequentFlyerMemberships: [membership],
      flights: [{
        id: "existing-flight",
        flightNumber: "UA123",
        serviceDate: "2026-08-19",
        airline: { iata: "UA", icao: "UAL" },
        origin: { iata: "SFO" },
        destination: { iata: "LAX" },
        scheduledDeparture: "2026-08-19T10:20:00-07:00",
        scheduledArrival: "2026-08-19T11:50:00-07:00",
        frequentFlyer: { membershipId: "ff-1", tierAtFlight: "gold" },
      }],
    };
    const membershipBefore = structuredClone(existing.frequentFlyerMemberships);
    const parsed = parseFlightyCsv(flightyCsv([
      "2026-09-23,CES,5243,TAO,SHA,1,12,2,33,false,,2026-09-23T14:30,2026-09-23T14:40,2026-09-23T16:20,2026-09-23T16:35,Airbus A321,,,12A,ECONOMY",
    ]));
    const preflight = preflightFlightyImport(parsed, existing, ids("flighty-append"));
    const appended = buildDocumentFromFlightyPreflight(preflight, existing);

    expect(appended.frequentFlyerMemberships).toEqual(membershipBefore);
    expect(appended.flights[0]?.frequentFlyer).toEqual({ membershipId: "ff-1", tierAtFlight: "gold" });
    expect(appended.flights[1]?.frequentFlyer).toBeUndefined();
    expect(appended.extensions).toEqual(existing.extensions);
    expect(validateKeeprawFly(appended).valid).toBe(true);
  });

  it("resolves all sample ICAO codes through the shared airline database", () => {
    const parsed = parseFlightyCsv(flightyCsv([
      "2026-09-23,CES,5243,TAO,SHA,,,,,false,,2026-09-23T14:30,,2026-09-23T16:20,,,,,,",
      "2026-09-24,CSN,2005,HKG,BOM,,,,,false,,2026-09-24T20:15,,2026-09-25T00:20,,,,,,",
      "2026-09-25,CSZ,9911,HKG,HND,,,,,false,,2026-09-25T10:15,,2026-09-25T14:30,,,,,,",
      "2026-09-26,CPA,951,HKG,TAO,,,,,false,,2026-09-26T14:45,,2026-09-26T18:00,,,,,,",
    ]));
    const preflight = preflightFlightyImport(parsed, null, () => "airline");
    expect(preflight.issues).toEqual([]);
    expect(preflight.flights.map((flight) => flight.flightNumber)).toEqual(["MU5243", "CZ2005", "ZH9911", "CX951"]);
  });

  it("uses airport-local times and the diverted airport for actual arrival", () => {
    const parsed = parseFlightyCsv(flightyCsv([
      "2026-04-27,CPA,663,HKG,BOM,1,24,2,,false,,2026-04-27T20:15,2026-04-27T20:23,2026-04-28T00:20,2026-04-28T00:18,Boeing 777-300 ER,,,3C,BUSINESS",
      "2026-09-25,CSZ,9911,HKG,HND,1,24,2,33,false,KIX,2026-09-25T10:15,2026-09-25T10:20,2026-09-25T14:30,2026-09-25T15:05,Boeing 737-800,,,9D,BUSINESS",
    ]));
    const preflight = preflightFlightyImport(parsed, null, ids("time"));
    const document = buildDocumentFromFlightyPreflight(preflight, null);

    expect(document.flights[0]).toMatchObject({
      scheduledDeparture: "2026-04-27T20:15:00+08:00",
      scheduledArrival: "2026-04-28T00:20:00+05:30",
    });
    expect(document.flights[1]).toMatchObject({
      destination: { iata: "HND" },
      divertedTo: { iata: "KIX" },
      actualArrival: "2026-09-25T15:05:00+09:00",
    });
  });

  it("imports cancelled flights without actual times and delegates conflicts to validation", () => {
    const parsed = parseFlightyCsv(flightyCsv([
      "2026-09-23,CES,5243,TAO,SHA,1,12,2,33,true,,2026-09-23T14:30,,2026-09-23T16:20,,,,,,",
      "2026-09-24,CES,5244,TAO,SHA,1,12,2,33,true,KIX,2026-09-24T14:30,,2026-09-24T16:20,,,,,,",
    ]));
    const preflight = preflightFlightyImport(parsed, null, ids("cancelled"));
    expect(preflight.issues).toEqual([]);
    const document = buildDocumentFromFlightyPreflight(preflight, null);
    expect(document.flights[0]).toMatchObject({ cancelled: true });
    expect(document.flights[0]).not.toHaveProperty("actualDeparture");
    expect(document.flights[0]).not.toHaveProperty("actualArrival");
    expect(validateKeeprawFly(document).valid).toBe(false);
  });

  it("reports unknown ICAO per row without dropping valid rows", () => {
    const parsed = parseFlightyCsv(flightyCsv([
      "2026-09-23,ABC,5243,TAO,SHA,1,12,2,33,false,,2026-09-23T14:30,,2026-09-23T16:20,,,,,,",
      "2026-09-24,CES,5244,TAO,SHA,1,12,2,33,false,,2026-09-24T14:30,,2026-09-24T16:20,,,,,,",
    ]));
    const preflight = preflightFlightyImport(parsed, null, () => "unknown");

    expect(preflight.canImport).toBe(false);
    expect(preflight.validRecords).toBe(1);
    expect(preflight.flights[0]?.flightNumber).toBe("MU5244");
    expect(preflight.issues).toContainEqual(expect.objectContaining({ code: "unknown-airline", lineNumber: 2, value: "ABC" }));
  });

  it("warns and clears an unsupported cabin without blocking the row", () => {
    const parsed = parseFlightyCsv(flightyCsv([
      "2026-09-23,CES,5243,TAO,SHA,1,12,2,33,false,,2026-09-23T14:30,,2026-09-23T16:20,,,,,,PREMIUM FIRST",
    ]));
    const preflight = preflightFlightyImport(parsed, null, () => "cabin");

    expect(preflight.canImport).toBe(true);
    expect(preflight.warnings).toContainEqual(expect.objectContaining({ code: "unknown-cabin", lineNumber: 2, value: "PREMIUM FIRST" }));
    const document = buildDocumentFromFlightyPreflight(preflight, null);
    expect(document.flights[0]?.extensions?.["keepraw-fly.seat"]).toBeUndefined();
  });

  it("rejects unsupported Canceled values instead of treating arbitrary text as true", () => {
    const parsed = parseFlightyCsv(flightyCsv([
      "2026-09-23,CES,5243,TAO,SHA,1,12,2,33,maybe,,2026-09-23T14:30,,2026-09-23T16:20,,,,,,",
    ]));
    const preflight = preflightFlightyImport(parsed, null);
    expect(preflight.issues).toContainEqual(expect.objectContaining({ code: "invalid-cancelled", value: "maybe" }));
  });
});
