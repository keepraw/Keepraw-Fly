/**
 * Passport selection by physical identity and visible assignment evidence,
 * against the committed real airport-history package (no mocked airports).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";
import airportRows from "@keepraw-fly/core/airport-directory";
import {
  arrivalIdentity,
  buildRouteSegments,
  installAirportDirectory,
  originIdentity,
  routeSelectionTarget,
  type CompactAirportRow,
} from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import en from "../locales/en-US.json";
import { FlightRow } from "../components/FlightRow";
import { FlightDetailPage } from "../pages/FlightDetailPage";
import { createDefaultDraft, flightFromDraft } from "./flight-editor";
import {
  explorePassportFlights,
  initialPassportView,
  passportVisibleFlights,
  sameSelection,
  type PassportSelection,
} from "./passport-exploration";

const i18n = createInstance();

beforeAll(async () => {
  installAirportDirectory(airportRows as CompactAirportRow[]);
  await i18n.init({
    resources: { en: { translation: en } },
    lng: "en",
    interpolation: { escapeValue: false },
  });
}, 120_000);

function flight(
  id: string,
  origin: string,
  destination: string,
  serviceDate: string,
  scheduledDeparture: string,
  scheduledArrival: string,
): KeeprawFlight {
  return {
    id,
    flightNumber: "CX100",
    serviceDate,
    airline: { iata: "CX" },
    origin: { iata: origin },
    destination: { iata: destination },
    scheduledDeparture,
    scheduledArrival,
  };
}

const kaiTak = flight(
  "kai-tak",
  "HKG",
  "SFO",
  "1997-06-01",
  "1997-06-01T10:00:00+08:00",
  "1997-06-01T23:00:00+08:00",
);
const chekLapKok = flight(
  "chek-lap-kok",
  "HKG",
  "SFO",
  "1999-06-01",
  "1999-06-01T10:00:00+08:00",
  "1999-06-01T23:00:00+08:00",
);
const kaiTakInbound = flight(
  "kai-tak-inbound",
  "LAX",
  "HKG",
  "1997-07-01",
  "1997-07-01T09:00:00-07:00",
  "1997-07-02T16:00:00+08:00",
);
const directoryOnly = flight(
  "pek-sfo",
  "PEK",
  "SFO",
  "1997-06-01",
  "1997-06-01T10:00:00+08:00",
  "1997-06-01T08:00:00-07:00",
);
const flights = [kaiTak, chekLapKok, kaiTakInbound];

const visible = (selection: PassportSelection | null) =>
  passportVisibleFlights(flights, { ...initialPassportView, selection })
    .map((f) => f.id)
    .sort();

describe("Passport selects physical airports, not IATA codes", () => {
  it("selects only Kai Tak flights or only Chek Lap Kok flights", () => {
    const kaiTakKey = originIdentity(kaiTak).identityKey;
    const chekLapKokKey = originIdentity(chekLapKok).identityKey;
    expect(kaiTakKey).not.toBe(chekLapKokKey);
    expect(
      visible({ kind: "airport", code: "HKG", identityKey: kaiTakKey }),
    ).toEqual(["kai-tak", "kai-tak-inbound"]);
    expect(
      visible({ kind: "airport", code: "HKG", identityKey: chekLapKokKey }),
    ).toEqual(["chek-lap-kok"]);
    // Older transient state without identity still matches by code.
    expect(visible({ kind: "airport", code: "HKG" })).toHaveLength(3);
  });

  it("selects one physical route even when the code pair is shared", () => {
    const hkgSfo = buildRouteSegments(flights).filter(
      (r) => r.origin.iata === "HKG" && r.destination.iata === "SFO",
    );
    expect(hkgSfo).toHaveLength(2);
    const [first, second] = hkgSfo.map(routeSelectionTarget);
    expect(visible(first!)).toHaveLength(1);
    expect(visible(second!)).toHaveLength(1);
    expect(visible(first!)).not.toEqual(visible(second!));
    expect(sameSelection(first!, second!)).toBe(false);
    expect(sameSelection(first!, { ...first! })).toBe(true);
  });

  it("explores the selected site by its flight-date identity", () => {
    const exploration = explorePassportFlights(flights, {
      kind: "airport",
      code: "HKG",
      identityKey: originIdentity(kaiTak).identityKey,
    })!;
    expect(exploration.flights.map((f) => f.id).sort()).toEqual([
      "kai-tak",
      "kai-tak-inbound",
    ]);
    expect(originIdentity(kaiTak).name?.en).toBe(
      "Hong Kong International Airport Kai Tak",
    );
    expect(arrivalIdentity(kaiTakInbound).identityKey).toBe(
      originIdentity(kaiTak).identityKey,
    );
  });
});

function detail(record: KeeprawFlight) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <FlightDetailPage
        flight={record}
        memberships={[]}
        locale="en-US"
        distanceUnit="kilometers"
        timeFormat="24-hour"
        appearance="light"
        solarMode="fixed"
      />
    </I18nextProvider>,
  );
}

function row(record: KeeprawFlight) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <FlightRow
        flight={record}
        locale="en-US"
        timeFormat="24-hour"
        presentation="passport"
        onOpen={() => {}}
      />
    </I18nextProvider>,
  );
}

describe("airport presentation", () => {
  it("shows the airport without evidence classification text", () => {
    const markup = detail(chekLapKok);
    expect(markup).toContain("Hong Kong");
    expect(markup).not.toContain("Historically verified for this flight date");
  });

  it("shows a current-directory match as not historically verified", () => {
    const markup = detail(directoryOnly);
    expect(markup).not.toContain(
      "Based on the current airport directory; the code&#x27;s validity on this date is not verified",
    );
    expect(markup).not.toContain("historically_verified");
  });

  it("distinguishes a directory-only historical flight from a resolved one in FlightRow", () => {
    const resolved = row(kaiTak);
    expect(resolved).toContain("Hong Kong International Airport Kai Tak");
    const plain = row(directoryOnly);
    expect(plain).toContain("SFO");
    expect(plain).not.toContain("historically_verified");
  });

  it("still lets a user enter and save normal current-directory airports", () => {
    vi.stubGlobal("crypto", { ...crypto, randomUUID: () => "u-current" });
    const saved = flightFromDraft({
      ...createDefaultDraft("2026-06-01"),
      flightNumber: "CA985",
      originIata: "PEK",
      destinationIata: "SFO",
      serviceDate: "2026-06-01",
      departureTime: "13:00",
      arrivalDate: "2026-06-01",
      arrivalTime: "09:30",
    });
    vi.unstubAllGlobals();
    expect(saved.origin.iata).toBe("PEK");
    expect(saved.destination.iata).toBe("SFO");
    expect(saved.scheduledDeparture).toBe("2026-06-01T13:00:00+08:00");
    const origin = originIdentity(saved);
    expect(origin.confirmed).toBe(true);
    expect(origin.assignmentEvidence).toBe("current_directory");
    expect(origin.historicalAssignmentVerified).toBe(false);
  });
});
