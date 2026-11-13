import { describe, expect, it } from "vitest";
import { airportByIata, originIdentity, arrivalIdentity, plannedDestinationIdentity } from "@keepraw-fly/core";
import { parseKeeprawFlyJson } from "@keepraw-fly/validator";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import { flightFromDraft, flightToDraft } from "./flight-editor";
import { serializeKeeprawFly } from "./export";
import { buildShareRenderModel } from "../share/share-model";

const kaiTak = "apt_86460159-a072-4a18-afcc-ab376cda7047";
const chekLapKok = "apt_8d89722f-007c-4eb4-aaa0-ec1c61007a09";
const flight: KeeprawFlight = {
  id: "saved", flightNumber: "CX100", serviceDate: "1997-06-01", airline: { iata: "CX" },
  origin: { iata: "HKG", airportId: kaiTak, terminal: "1", gate: "3" },
  destination: { iata: "HKG", airportId: chekLapKok },
  divertedTo: { iata: "SFO", airportId: airportByIata.get("SFO")!.airportId, gate: "7" },
  scheduledDeparture: "1997-06-01T10:00:00+08:00", scheduledArrival: "1997-06-01T23:00:00+08:00",
  actualArrival: "1997-06-01T09:00:00-07:00", extensions: { "example.notes": { text: "keep me" } },
};
describe("endpoint persistence", () => {
  it("keeps physical airports separate in exported route images", () => {
    const old = structuredClone(flight);
    delete old.divertedTo;
    old.destination = { iata: "SFO" };
    const current = structuredClone(old);
    current.id = "new";
    current.origin.airportId = chekLapKok;
    const { model } = buildShareRenderModel([old, current], { privacy: "routes", airportLabels: true });
    expect(model.routes).toHaveLength(2);
    expect(model.airports.filter((airport) => airport.code === "HKG")).toHaveLength(2);
    expect(model.statistics.airports).toBe(3);
  });
  it("retains three independent identities across JSON export and reimport", async () => {
    const archive: KeeprawFlyDocument = { format: "keepraw-fly", formatVersion: "0.1.0", profile: {}, flights: [flight] };
    const text = await serializeKeeprawFly(archive);
    expect(JSON.parse(text).formatVersion).toBe("0.2.0");
    const result = parseKeeprawFlyJson(text);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error("Backup rejected");
    expect(result.data.flights[0]).toEqual(flight);
    const saved = result.data.flights[0]!;
    expect(originIdentity(saved).airportId).toBe(kaiTak);
    expect(plannedDestinationIdentity(saved).airportId).toBe(chekLapKok);
    expect(arrivalIdentity(saved).airportId).toBe(flight.divertedTo!.airportId);
  });
  it("retains identity, raw code and facts through date and unrelated edits", () => {
    const draft = flightToDraft(flight);
    draft.serviceDate = "2005-06-01";
    draft.arrivalDate = "2005-06-01";
    draft.actualArrivalDate = "2005-06-01";
    draft.bookingReference = "ABC123";
    const saved = flightFromDraft(draft, flight);
    expect(saved.origin).toEqual(flight.origin);
    expect(saved.destination).toEqual(flight.destination);
    expect(saved.divertedTo).toEqual(flight.divertedTo);
    expect(saved.extensions?.["example.notes"]).toEqual({ text: "keep me" });
    expect(originIdentity(saved).airportId).toBe(kaiTak);
  });
  it("imports old backups without manufacturing confirmations", () => {
    const old = structuredClone(flight);
    delete old.origin.airportId;
    delete old.destination.airportId;
    delete old.divertedTo;
    const result = parseKeeprawFlyJson(JSON.stringify({ format: "keepraw-fly", formatVersion: "0.1.0", profile: {}, flights: [old] }));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.flights[0]).toEqual(old);
  });
  it("preserves unrecognized permanent IDs instead of dropping flights", async () => {
    const unknown = structuredClone(flight);
    unknown.origin.airportId = "apt_not_in_this_directory_version";
    const result = parseKeeprawFlyJson(await serializeKeeprawFly({ format: "keepraw-fly", formatVersion: "0.2.0", profile: {}, flights: [unknown] }));
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error("Unknown ID discarded the flight");
    expect(result.data.flights[0]).toEqual(unknown);
    const saved = flightFromDraft(flightToDraft(unknown), unknown);
    expect(saved.origin).toEqual(unknown.origin);
    expect(originIdentity(saved).point).toBeNull();
  });
});
