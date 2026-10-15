import { describe, expect, it, vi } from "vitest";
import {
  validateKeeprawFly,
  parseKeeprawFlyJson,
} from "@keepraw-fly/validator";
import type { FrequentFlyerMembership } from "@keepraw-fly/schema";
import {
  createEmptyDocument,
  flightFromDraft,
  flightToDraft,
  splitFlightNumberInput,
  type FlightDraft,
  zonedDateTimeToIso,
} from "./flight-editor";

describe("flight editor data", () => {
  it.each(["ZH9911", "zh9911", "ZH 9911", "ZH-9911"])(
    "normalizes %s as one flight-number field",
    (value) => {
      expect(splitFlightNumberInput(value)).toMatchObject({
        canonical: "ZH9911",
        airline: { iata: "ZH", icao: "CSZ" },
      });
    },
  );

  it.each(["3U8633", "6E203", "9C8835"])(
    "accepts numeric IATA designators in %s",
    (value) => {
      expect(splitFlightNumberInput(value)?.canonical).toBe(value);
    },
  );

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
    expect(zonedDateTimeToIso("2026-08-21", "09:00", "Asia/Shanghai")).toBe(
      "2026-08-21T09:00:00+08:00",
    );
    expect(
      zonedDateTimeToIso("2026-08-21", "09:00", "America/Los_Angeles"),
    ).toBe("2026-08-21T09:00:00-07:00");
    expect(
      zonedDateTimeToIso("2026-12-20", "09:00", "America/Los_Angeles"),
    ).toBe("2026-12-20T09:00:00-08:00");
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
    expect(() =>
      flightFromDraft({
        ...baseDraft(),
        originIata: "TYO",
        destinationIata: "SFO",
      }),
    ).toThrow("unknown-airport");
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
      destinationGate: "",
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
    expect(() =>
      flightFromDraft({
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
        destinationGate: "",
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
      }),
    ).toThrow("arrival-before-departure");
  });

  it("writes actual times and optional facts while preserving unknown extensions", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "facts-id" });
    const flight = flightFromDraft(
      {
        ...baseDraft(),
        actualDepartureDate: "2026-08-21",
        actualDepartureTime: "13:17",
        actualArrivalDate: "2026-08-21",
        actualArrivalTime: "09:22",
        originTerminal: "1",
        originGate: "18",
        destinationTerminal: "B",
        destinationGate: "8",
        aircraftType: "B773",
        aircraftRegistration: "B-7883",
        seat: "31L",
        cabin: "economy",
        bookingClass: "P",
        baggageCarousel: "8",
      },
      {
        ...flightFromDraft(baseDraft()),
        extensions: {
          "example.unknown": { preserved: true },
          "keepraw-fly.aircraft": { source: "manual" },
        },
      },
    );

    expect(flight.actualDeparture).toBe("2026-08-21T13:17:00+08:00");
    expect(flight.actualArrival).toBe("2026-08-21T09:22:00-07:00");
    expect(flight.origin).toMatchObject({
      iata: "PVG",
      terminal: "1",
      gate: "18",
    });
    expect(flight.destination).toMatchObject({
      iata: "SFO",
      terminal: "B",
      gate: "8",
    });
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
    expect(flightToDraft(flight)).toMatchObject({
      ticketNumber: "7811234567890",
      bookingReference: "KY78M9",
      frequentFlyerTierAtFlight: "金卡",
    });
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
      memberships: [
        {
          id: "membership-zh",
          programId: "phoenixmiles",
          programName: "尊鹏俱乐部",
          memberNumber: "ZH123456",
          tier: "金卡",
          associatedAirlines: ["ZH"],
        },
      ],
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

  it.each([
    ["normal", "cancelled"],
    ["cancelled", "normal"],
    ["cancelled", "diverted"],
    ["diverted", "normal"],
    ["diverted", "cancelled"],
  ])("transitions from %s to %s without stale state", (from, to) => {
    const original = flightFromDraft({
      ...baseDraft(),
      cancelled: from === "cancelled",
      divertedToIata: from === "diverted" ? "JFK" : "",
    });
    const edited = flightFromDraft(
      {
        ...flightToDraft(original),
        cancelled: to === "cancelled",
        divertedToIata: to === "diverted" ? "JFK" : "",
      },
      original,
    );
    expect(Boolean(edited.cancelled)).toBe(to === "cancelled");
    expect(edited.divertedTo).toEqual(
      to === "diverted" ? { iata: "JFK" } : undefined,
    );
    expect(
      validateKeeprawFly({ ...createEmptyDocument(), flights: [edited] }).valid,
    ).toBe(true);
    expect(edited.scheduledDeparture).toBe(original.scheduledDeparture);
    expect(edited.scheduledArrival).toBe(original.scheduledArrival);
    expect(edited.destination).toEqual(original.destination);
  });

  it("rejects a cancelled and diverted draft without mutating the original", () => {
    const original = flightFromDraft(baseDraft());
    const before = structuredClone(original);
    expect(() =>
      flightFromDraft(
        { ...flightToDraft(original), cancelled: true, divertedToIata: "JFK" },
        original,
      ),
    ).toThrow("cancelled-diverted-conflict");
    expect(original).toEqual(before);
  });

  it.each([null, undefined, "Silver"])(
    "preserves historical tier %s when the current tier is Gold",
    (tier) => {
      const membership: FrequentFlyerMembership = {
        id: "synthetic-membership",
        programId: "synthetic",
        memberNumber: "TEST-123",
        associatedAirlines: ["MU"],
        tier: "Gold",
      };
      const original = {
        ...flightFromDraft(baseDraft()),
        frequentFlyer: {
          membershipId: membership.id,
          ...(tier !== undefined ? { tierAtFlight: tier } : {}),
        },
      };
      const parsed = parseKeeprawFlyJson(
        JSON.stringify({
          ...createEmptyDocument(),
          frequentFlyerMemberships: [membership],
          flights: [original],
        }),
      );
      expect(parsed.valid).toBe(true);
      if (!parsed.valid) throw new Error("Invalid generated archive");
      const imported = parsed.data.flights[0]!;
      const draft = flightToDraft(imported, { memberships: [membership] });
      expect(draft.frequentFlyerTierAtFlight).toBe(tier ?? "");
      expect(
        flightFromDraft({ ...draft, flightNumber: "MU584" }, imported),
      ).toEqual({ ...original, flightNumber: "MU584" });
      expect(
        flightFromDraft(
          { ...draft, frequentFlyerTierAtFlight: "Platinum" },
          imported,
        ).frequentFlyer,
      ).toEqual({ membershipId: membership.id, tierAtFlight: "Platinum" });
    },
  );

  it.each(["flightNumber", "bookingReference"] as const)(
    "preserves diversion facts when only %s changes",
    (field) => {
      const original = {
        ...flightFromDraft({ ...baseDraft(), divertedToIata: "JFK" }),
        divertedTo: { iata: "JFK", terminal: "4", gate: "B12" },
        extensions: {
          "test.synthetic": { source: "generated", values: [null, 42, true] },
        },
      };
      const before = structuredClone(original);
      const value = field === "flightNumber" ? "MU584" : "TEST123";
      const edited = flightFromDraft(
        { ...flightToDraft(original), [field]: value },
        original,
      );
      expect(edited).toEqual({ ...original, [field]: value });
      expect(original).toEqual(before);
      expect(
        flightFromDraft(
          { ...flightToDraft(original), divertedToIata: "LAX" },
          original,
        ).divertedTo,
      ).toEqual({ iata: "LAX" });
      expect(
        flightFromDraft(
          { ...flightToDraft(original), divertedToIata: "" },
          original,
        ),
      ).not.toHaveProperty("divertedTo");
    },
  );

  it("keeps planned arrival in the destination timezone and actual arrival in the diversion timezone", () => {
    const original = flightFromDraft({ ...baseDraft(), cancelled: true });
    const edited = flightFromDraft(
      {
        ...flightToDraft(original),
        cancelled: false,
        divertedToIata: "JFK",
        actualDepartureDate: "2026-08-21",
        actualDepartureTime: "13:17",
        actualArrivalDate: "2026-08-21",
        actualArrivalTime: "13:22",
      },
      original,
    );
    expect(edited.scheduledArrival).toBe(original.scheduledArrival);
    expect(edited.actualDeparture).toBe("2026-08-21T13:17:00+08:00");
    expect(edited.actualArrival).toBe("2026-08-21T13:22:00-04:00");
    expect(edited.destination).toEqual(original.destination);
    expect(
      validateKeeprawFly({ ...createEmptyDocument(), flights: [edited] }).valid,
    ).toBe(true);
  });

  it("requires both date and time for an actual event", () => {
    expect(() =>
      flightFromDraft({
        ...baseDraft(),
        actualDepartureDate: "2026-08-21",
      }),
    ).toThrow("incomplete-actual-time");
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

    expect(flight.extensions?.["keepraw-fly.seat"]).toEqual({
      bookingClass: "P",
    });
    expect(() =>
      flightFromDraft({ ...baseDraft(), bookingClass: "PP" }),
    ).toThrow("invalid-booking-class");
    vi.unstubAllGlobals();
  });

  it("round-trips destination terminal and gate, and removes a cleared gate", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "destination-gate-id" });
    const existing = {
      ...flightFromDraft({
        ...baseDraft(),
        destinationTerminal: "I",
        destinationGate: "72A",
      }),
    };
    const draft = flightToDraft(existing);
    expect(draft).toMatchObject({
      destinationTerminal: "I",
      destinationGate: "72A",
    });
    const edited = flightFromDraft(draft, existing);
    expect(edited.destination).toEqual({
      iata: "SFO",
      terminal: "I",
      gate: "72A",
    });

    const cleared = flightFromDraft({ ...draft, destinationGate: "" }, edited);
    expect(cleared.destination).toEqual({ iata: "SFO", terminal: "I" });
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
    destinationGate: "",
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
