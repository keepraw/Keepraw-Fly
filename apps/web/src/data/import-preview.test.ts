import { describe, expect, it } from "vitest";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import { summarizeImport } from "./import-preview";

describe("import preview", () => {
  it("summarizes the owner, flight count and service-date range", () => {
    expect(summarizeImport(documentWithFlights)).toEqual({
      flightCount: 2,
      firstServiceDate: "2024-01-03",
      lastServiceDate: "2026-08-19",
      profileName: "Fang Chen",
    });
  });

  it("handles an empty archive without inventing dates or an owner", () => {
    expect(summarizeImport({
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: {},
      flights: [],
    })).toEqual({ flightCount: 0 });
  });
});

const documentWithFlights: KeeprawFlyDocument = {
  format: "keepraw-fly",
  formatVersion: "0.1.0",
  profile: {
    name: {
      native: "陈芳",
      romanized: "Fang Chen",
      primary: "romanized",
    },
  },
  flights: [
    {
      id: "newer",
      flightNumber: "UA123",
      serviceDate: "2026-08-19",
      airline: { iata: "UA" },
      origin: { iata: "SFO" },
      destination: { iata: "LAX" },
      scheduledDeparture: "2026-08-19T10:20:00-07:00",
      scheduledArrival: "2026-08-19T11:52:00-07:00",
    },
    {
      id: "older",
      flightNumber: "MU5101",
      serviceDate: "2024-01-03",
      airline: { iata: "MU" },
      origin: { iata: "PVG" },
      destination: { iata: "PEK" },
      scheduledDeparture: "2024-01-03T08:00:00+08:00",
      scheduledArrival: "2024-01-03T10:20:00+08:00",
    },
  ],
};
