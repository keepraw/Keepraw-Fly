import { describe, expect, it, vi } from "vitest";
import {
  createEmptyDocument,
  flightFromDraft,
  flightToDraft,
  splitFlightNumberInput,
  type FlightDraft,
  zonedDateTimeToIso,
} from "./flight-editor";

describe("flight editor data", () => {
  it.each(["ZH9911", "zh9911", "ZH 9911", "ZH-9911"])("normalizes %s as one flight-number field", (value) => {
    expect(splitFlightNumberInput(value)).toMatchObject({
      canonical: "ZH9911",
      airline: { iata: "ZH", icao: "CSZ" },
    });
  });

  it.each(["3U8633", "6E203", "9C8835"])("accepts numeric IATA designators in %s", (value) => {
    expect(splitFlightNumberInput(value)?.canonical).toBe(value);
  });

  it("resolves a known ICAO designator while preserving the entered flight identity", () => {
    expect(splitFlightNumberInput("CCA123")).toMatchObject({
      canonical: "CCA123",
      airline: { iata: "CA", icao: "CCA" },
    });
  });
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
    expect(zonedDateTimeToIso("2026-12-20", "09:00", "America/Los_Angeles"))
      .toBe("2026-12-20T09:00:00-08:00");
  });

  it("creates a HKG to TAO flight from the offline airport directory", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "cx954-id" });
    const flight = flightFromDraft({
      ...baseDraft(),
      flightNumber: "CX954",
      originIata: "HKG",
      destinationIata: "TAO",
      departureTime: "09:00",
      arrivalTime: "13:00",
    });

    expect(flight).toMatchObject({
      id: "flight-cx954-id",
      flightNumber: "CX954",
      origin: { iata: "HKG" },
      destination: { iata: "TAO" },
      scheduledDeparture: "2026-08-21T09:00:00+08:00",
      scheduledArrival: "2026-08-21T13:00:00+08:00",
    });
    vi.unstubAllGlobals();
  });

  it("rejects a metropolitan city code as a flight endpoint", () => {
    expect(() => flightFromDraft({
      ...baseDraft(),
      originIata: "TYO",
      destinationIata: "SFO",
    })).toThrow("unknown-airport");
  });

  it("round-trips editable flight fields", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "test-id" });
    const flight = flightFromDraft({
      flightNumber: "MU589",
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
      aircraftType: "",
      aircraftRegistration: "",
      seat: "",
      cabin: "",
      bookingClass: "",
      baggageCarousel: "",
      ticketNumber: "",
      bookingReference: "",
      frequentFlyerMembershipId: "",
      frequentFlyerTierAtFlight: "",
    });

    expect(flight.id).toBe("flight-test-id");
    expect(flight.flightNumber).toBe("MU589");
    expect(flightToDraft(flight)).toMatchObject({
      flightNumber: "MU589",
      serviceDate: "2026-08-21",
      departureTime: "13:00",
      arrivalDate: "2026-08-21",
      arrivalTime: "09:00",
    });
    vi.unstubAllGlobals();
  });

  it("rejects an arrival instant before departure", () => {
    expect(() => flightFromDraft({
      flightNumber: "MU001",
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
      aircraftType: "",
      aircraftRegistration: "",
      seat: "",
      cabin: "",
      bookingClass: "",
      baggageCarousel: "",
      ticketNumber: "",
      bookingReference: "",
      frequentFlyerMembershipId: "",
      frequentFlyerTierAtFlight: "",
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
      aircraftType: "B773",
      aircraftRegistration: "B-7883",
      seat: "31L",
      cabin: "economy",
      bookingClass: "P",
      baggageCarousel: "8",
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
    expect(flight.extensions?.["keepraw-fly.seat"]).toEqual({
      seat: "31L",
      cabin: "economy",
      bookingClass: "P",
    });
    expect(flight.baggageCarousel).toBe("8");
    expect(flight.extensions).not.toHaveProperty("keepraw-fly.baggage");
    expect(flightToDraft(flight)).toMatchObject({
      actualDepartureTime: "13:17",
      actualArrivalTime: "09:22",
      aircraftType: "B773",
      seat: "31L",
      bookingClass: "P",
      baggageCarousel: "8",
    });
    vi.unstubAllGlobals();
  });

  it("round-trips ticket metadata and a membership reference with a historical tier", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "travel-id" });
    const flight = flightFromDraft({
      ...baseDraft(),
      ticketNumber: "781-1234567890",
      bookingReference: "KY78M9",
      frequentFlyerMembershipId: "membership-zh",
      frequentFlyerTierAtFlight: "金卡",
    });
    expect(flight.ticketNumber).toBe("7811234567890");
    expect(flight.bookingReference).toBe("KY78M9");
    expect(flight.frequentFlyer).toEqual({
      membershipId: "membership-zh",
      tierAtFlight: "金卡",
    });
    expect(flightToDraft(flight)).toMatchObject({ ticketNumber: "7811234567890", bookingReference: "KY78M9", frequentFlyerTierAtFlight: "金卡" });
    vi.unstubAllGlobals();
  });

  it("duplicates membership intent with the current profile tier but clears journey-specific facts", () => {
    const original = flightFromDraft({
      ...baseDraft(),
      actualDepartureDate: "2026-08-21",
      actualDepartureTime: "13:10",
      actualArrivalDate: "2026-08-21",
      actualArrivalTime: "09:15",
      ticketNumber: "7811234567890",
      originGate: "18",
      aircraftRegistration: "B-1234",
      seat: "12A",
      frequentFlyerMembershipId: "membership-zh",
      frequentFlyerTierAtFlight: "银卡",
    });
    const duplicate = flightToDraft(original, {
      duplicate: true,
      memberships: [{
        id: "membership-zh",
        programId: "phoenixmiles",
        programName: "尊鹏俱乐部",
        memberNumber: "ZH123456",
        tier: "金卡",
        associatedAirlines: ["ZH"],
      }],
    });
    expect(duplicate).toMatchObject({
      ticketNumber: "",
      actualDepartureDate: "",
      actualArrivalDate: "",
      originGate: "",
      aircraftRegistration: "",
      seat: "",
      frequentFlyerMembershipId: "membership-zh",
      frequentFlyerTierAtFlight: "金卡",
    });
  });

  it("requires both date and time for an actual event", () => {
    expect(() => flightFromDraft({
      ...baseDraft(),
      actualDepartureDate: "2026-08-21",
    })).toThrow("incomplete-actual-time");
  });

  it("stores an alphanumeric carousel independently and uses null when unknown", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "carousel-id" });
    const flight = flightFromDraft({
      ...baseDraft(),
      baggageCarousel: "D05",
    });

    expect(flight.baggageCarousel).toBe("D05");
    expect(flightToDraft(flight).baggageCarousel).toBe("D05");
    expect(flightFromDraft(baseDraft()).baggageCarousel).toBeNull();
    vi.unstubAllGlobals();
  });

  it("accepts one-letter booking classes and rejects ambiguous values", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "booking-class-id" });
    const flight = flightFromDraft({ ...baseDraft(), bookingClass: "p" });

    expect(flight.extensions?.["keepraw-fly.seat"]).toEqual({ bookingClass: "P" });
    expect(() => flightFromDraft({ ...baseDraft(), bookingClass: "PP" }))
      .toThrow("invalid-booking-class");
    vi.unstubAllGlobals();
  });

  it("does not expose a legacy destination gate while preserving imported data", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "legacy-gate-id" });
    const existing = {
      ...flightFromDraft(baseDraft()),
      destination: { iata: "SFO", terminal: "I", gate: "72A" },
    };
    const draft = flightToDraft(existing);
    const edited = flightFromDraft(draft, existing);

    expect(draft).not.toHaveProperty("destinationGate");
    expect(edited.destination).toEqual({ iata: "SFO", terminal: "I", gate: "72A" });
    vi.unstubAllGlobals();
  });

  it("accepts an unlisted airline code and builds the complete flight number", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "small-airline-id" });
    const flight = flightFromDraft({
      ...baseDraft(),
      flightNumber: "9c8835",
    });

    expect(flight.flightNumber).toBe("9C8835");
    expect(flight.airline).toMatchObject({ iata: "9C", icao: "CQH" });
    expect(flightToDraft(flight)).toMatchObject({
      flightNumber: "9C8835",
    });
    vi.unstubAllGlobals();
  });

  it("splits a pasted complete flight number and prevents an airline mismatch", () => {
    expect(splitFlightNumberInput("mu 589")).toMatchObject({
      airlineCode: "MU",
      serviceNumber: "589",
    });

    vi.stubGlobal("crypto", { randomUUID: () => "pasted-id" });
    const flight = flightFromDraft({
      ...baseDraft(),
      flightNumber: "MU589",
    });
    expect(flight.flightNumber).toBe("MU589");
    expect(flight.airline).toMatchObject({ iata: "MU", icao: "CES" });
    vi.unstubAllGlobals();
  });
});

function baseDraft(): FlightDraft {
  return {
    flightNumber: "MU583",
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
    aircraftType: "",
    aircraftRegistration: "",
    seat: "",
    cabin: "",
    bookingClass: "",
    baggageCarousel: "",
    ticketNumber: "",
    bookingReference: "",
    frequentFlyerMembershipId: "",
    frequentFlyerTierAtFlight: "",
  };
}
