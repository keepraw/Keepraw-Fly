import { describe, expect, it, vi } from "vitest";
import {
  createEmptyDocument,
  flightFromDraft,
  flightToDraft,
  zonedDateTimeToIso,
} from "./flight-editor";

describe("flight editor data", () => {
  it("creates a valid empty Keepraw Fly archive", () => {
    expect(createEmptyDocument()).toEqual({
      format: "keepraw-fly",
      formatVersion: "0.1.0",
      profile: {},
      flights: [],
    });
  });

  it("stores airport-local times with their timezone offsets", () => {
    expect(zonedDateTimeToIso("2026-08-21", "09:00", "Asia/Shanghai"))
      .toBe("2026-08-21T09:00:00+08:00");
    expect(zonedDateTimeToIso("2026-08-21", "09:00", "America/Los_Angeles"))
      .toBe("2026-08-21T09:00:00-07:00");
  });

  it("round-trips editable flight fields", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "test-id" });
    const flight = flightFromDraft({
      flightNumber: "mu 589",
      airlineIata: "MU",
      serviceDate: "2026-08-21",
      originIata: "PVG",
      destinationIata: "SFO",
      departureTime: "13:00",
      arrivalDate: "2026-08-21",
      arrivalTime: "09:00",
    });

    expect(flight.id).toBe("flight-test-id");
    expect(flight.flightNumber).toBe("MU 589");
    expect(flightToDraft(flight)).toMatchObject({
      serviceDate: "2026-08-21",
      departureTime: "13:00",
      arrivalDate: "2026-08-21",
      arrivalTime: "09:00",
    });
    vi.unstubAllGlobals();
  });

  it("rejects an arrival instant before departure", () => {
    expect(() => flightFromDraft({
      flightNumber: "MU 001",
      airlineIata: "MU",
      serviceDate: "2026-08-21",
      originIata: "PVG",
      destinationIata: "PEK",
      departureTime: "12:00",
      arrivalDate: "2026-08-21",
      arrivalTime: "10:00",
    })).toThrow("arrival-before-departure");
  });
});
