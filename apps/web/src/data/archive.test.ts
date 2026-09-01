import { describe, expect, it } from "vitest";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { documentWithoutFlight, flightById } from "./archive";

describe("archive selection safety", () => {
  it("returns no selected record after that flight is removed", () => {
    const nextDocument = documentWithoutFlight(document, "selected");

    expect(flightById(nextDocument, "selected")).toBeUndefined();
    expect(nextDocument.flights.map((flight) => flight.id)).toEqual(["kept"]);
  });

  it("treats a stale selection as absent instead of asserting it exists", () => {
    expect(flightById(document, "missing")).toBeUndefined();
    expect(flightById(null, "selected")).toBeUndefined();
    expect(flightById(document, null)).toBeUndefined();
  });
});

const document: KeeprawFlyDocument = {
  format: "keepraw-fly",
  formatVersion: "0.1.0",
  profile: {},
  flights: [
    {
      id: "selected",
      flightNumber: "MU589",
      serviceDate: "2026-08-21",
      airline: { iata: "MU" },
      origin: { iata: "PVG" },
      destination: { iata: "SFO" },
      scheduledDeparture: "2026-08-21T13:00:00+08:00",
      scheduledArrival: "2026-08-21T09:00:00-07:00",
    },
    {
      id: "kept",
      flightNumber: "UA123",
      serviceDate: "2026-08-19",
      airline: { iata: "UA" },
      origin: { iata: "SFO" },
      destination: { iata: "LAX" },
      scheduledDeparture: "2026-08-19T10:20:00-07:00",
      scheduledArrival: "2026-08-19T11:52:00-07:00",
    },
  ],
};
