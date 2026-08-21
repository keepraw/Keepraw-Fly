import { describe, expect, it } from "vitest";
import { parseKeeprawFlyJson, validateKeeprawFly } from "../src";
import demoDocument from "../../core/data/demo.keepraw-fly.json";

const validDocument = {
  format: "keepraw-fly",
  formatVersion: "0.1.0",
  profile: {
    name: {
      native: "张鸿川",
      romanized: "Hongchuan Zhang",
      primary: "native",
    },
  },
  flights: [
    {
      id: "demo-ua123-20260819",
      flightNumber: "UA123",
      serviceDate: "2026-08-19",
      airline: { iata: "UA" },
      origin: { iata: "SFO", terminal: "3", gate: "F12" },
      destination: { iata: "LAX" },
      scheduledDeparture: "2026-08-19T10:20:00-07:00",
      scheduledArrival: "2026-08-19T11:52:00-07:00",
      actualDeparture: "2026-08-19T10:57:00-07:00",
      actualArrival: "2026-08-19T12:21:00-07:00",
      extensions: {
        "example.thirdparty": { kept: true, nested: [1, "two"] },
      },
    },
  ],
};

describe("Keepraw Fly validator", () => {
  it("validates the complete 24-flight demo dataset", () => {
    const result = validateKeeprawFly(demoDocument);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.flights).toHaveLength(24);
  });

  it("accepts a valid document and preserves unknown extensions", () => {
    const result = validateKeeprawFly(validDocument);

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.flights[0]?.extensions?.["example.thirdparty"]).toEqual(
        { kept: true, nested: [1, "two"] },
      );
    }
  });

  it("reports the flight and path for a datetime without a timezone", () => {
    const input = structuredClone(validDocument);
    input.flights[0]!.scheduledDeparture = "2026-08-19 10:20";

    const result = validateKeeprawFly(input);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          flightIndex: 0,
          path: "/flights/0/scheduledDeparture",
          received: "2026-08-19 10:20",
          message: expect.stringContaining("explicit timezone"),
        }),
      );
    }
  });

  it("rejects derived statistics stored as flight facts", () => {
    const input = structuredClone(validDocument) as typeof validDocument & {
      flights: Array<(typeof validDocument.flights)[number] & {
        departureDelayMinutes?: number;
      }>;
    };
    input.flights[0]!.departureDelayMinutes = 37;

    const result = validateKeeprawFly(input);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          path: "/flights/0/departureDelayMinutes",
          keyword: "additionalProperties",
        }),
      );
    }
  });

  it("returns a useful issue for malformed JSON", () => {
    const result = parseKeeprawFlyJson('{"format":');

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues[0]).toEqual(
        expect.objectContaining({ keyword: "parse", path: "/" }),
      );
    }
  });
});
