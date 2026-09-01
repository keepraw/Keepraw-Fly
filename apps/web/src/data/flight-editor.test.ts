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
      actualDepartureDate: "",
      actualDepartureTime: "",
      actualArrivalDate: "",
      actualArrivalTime: "",
      originTerminal: "",
      originGate: "",
      destinationTerminal: "",
      destinationGate: "",
      aircraftType: "",
      aircraftRegistration: "",
      seat: "",
      cabin: "",
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
      actualDepartureDate: "",
      actualDepartureTime: "",
      actualArrivalDate: "",
      actualArrivalTime: "",
      originTerminal: "",
      originGate: "",
      destinationTerminal: "",
      destinationGate: "",
      aircraftType: "",
      aircraftRegistration: "",
      seat: "",
      cabin: "",
    })).toThrow("arrival-before-departure");
  });

  it("writes actual times and optional facts while preserving unknown extensions", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "facts-id" });
    const flight = flightFromDraft({
      ...baseDraft(),
      actualDepartureDate: "2026-08-21",
      actualDepartureTime: "13:17",
      actualArrivalDate: "2026-08-21",
      actualArrivalTime: "09:22",
      originTerminal: "1",
      originGate: "18",
      destinationTerminal: "B",
      destinationGate: "204",
      aircraftType: "B773",
      aircraftRegistration: "B-7883",
      seat: "31L",
      cabin: "economy",
    }, {
      ...flightFromDraft(baseDraft()),
      extensions: {
        "example.unknown": { preserved: true },
        "keepraw-fly.aircraft": { source: "manual" },
      },
    });

    expect(flight.actualDeparture).toBe("2026-08-21T13:17:00+08:00");
    expect(flight.actualArrival).toBe("2026-08-21T09:22:00-07:00");
    expect(flight.origin).toMatchObject({ iata: "PVG", terminal: "1", gate: "18" });
    expect(flight.extensions?.["example.unknown"]).toEqual({ preserved: true });
    expect(flight.extensions?.["keepraw-fly.aircraft"]).toEqual({
      source: "manual",
      type: "B773",
      registration: "B-7883",
    });
    expect(flightToDraft(flight)).toMatchObject({
      actualDepartureTime: "13:17",
      actualArrivalTime: "09:22",
      aircraftType: "B773",
      seat: "31L",
    });
    vi.unstubAllGlobals();
  });

  it("requires both date and time for an actual event", () => {
    expect(() => flightFromDraft({
      ...baseDraft(),
      actualDepartureDate: "2026-08-21",
    })).toThrow("incomplete-actual-time");
  });
});

function baseDraft() {
  return {
    flightNumber: "MU 583",
    airlineIata: "MU",
    serviceDate: "2026-08-21",
    originIata: "PVG",
    destinationIata: "SFO",
    departureTime: "13:00",
    arrivalDate: "2026-08-21",
    arrivalTime: "09:00",
    actualDepartureDate: "",
    actualDepartureTime: "",
    actualArrivalDate: "",
    actualArrivalTime: "",
    originTerminal: "",
    originGate: "",
    destinationTerminal: "",
    destinationGate: "",
    aircraftType: "",
    aircraftRegistration: "",
    seat: "",
    cabin: "",
  };
}
