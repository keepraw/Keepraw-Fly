import type { ExtensionMap, JsonValue, KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";

export const TICKET_EXTENSION_KEY = "keepraw-fly.ticket";
export const FREQUENT_FLYER_EXTENSION_KEY = "keepraw-fly.frequent-flyer";

export interface TicketFacts { number: string }

export interface FrequentFlyerMembership {
  id: string;
  programName: string;
  memberNumber: string;
  tier?: string;
  associatedAirlines: string[];
  defaultForAirlines?: string[];
}

export interface FrequentFlyerSnapshot {
  membershipId?: string;
  programName: string;
  memberNumber: string;
  tier?: string;
}

function objectValue(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function strings(value: JsonValue | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function ticketFacts(flight: KeeprawFlight): TicketFacts | null {
  const value = objectValue(flight.extensions?.[TICKET_EXTENSION_KEY]);
  return typeof value?.number === "string" && value.number ? { number: value.number } : null;
}

export function normalizeTicketNumber(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/[\s-]+/g, "");
  return /^\d{13}$/.test(digits) ? digits : trimmed;
}

export function isStandardTicketNumber(value: string): boolean {
  return /^\d{13}$/.test(normalizeTicketNumber(value));
}

export function formatTicketNumber(value: string): string {
  const normalized = normalizeTicketNumber(value);
  return /^\d{13}$/.test(normalized) ? `${normalized.slice(0, 3)}-${normalized.slice(3)}` : normalized;
}

export function frequentFlyerMemberships(document: Pick<KeeprawFlyDocument, "extensions">): FrequentFlyerMembership[] {
  const root = objectValue(document.extensions?.[FREQUENT_FLYER_EXTENSION_KEY]);
  if (!Array.isArray(root?.memberships)) return [];
  return root.memberships.flatMap((item) => {
    const value = objectValue(item);
    if (!value || typeof value.id !== "string" || typeof value.programName !== "string" || typeof value.memberNumber !== "string") return [];
    return [{
      id: value.id,
      programName: value.programName,
      memberNumber: value.memberNumber,
      ...(typeof value.tier === "string" && value.tier ? { tier: value.tier } : {}),
      associatedAirlines: strings(value.associatedAirlines).map((code) => code.toUpperCase()),
      ...(strings(value.defaultForAirlines).length ? { defaultForAirlines: strings(value.defaultForAirlines).map((code) => code.toUpperCase()) } : {}),
    }];
  });
}

export function frequentFlyerSnapshot(flight: KeeprawFlight): FrequentFlyerSnapshot | null {
  const value = objectValue(flight.extensions?.[FREQUENT_FLYER_EXTENSION_KEY]);
  if (!value || typeof value.programName !== "string" || typeof value.memberNumber !== "string") return null;
  return {
    ...(typeof value.membershipId === "string" ? { membershipId: value.membershipId } : {}),
    programName: value.programName,
    memberNumber: value.memberNumber,
    ...(typeof value.tier === "string" && value.tier ? { tier: value.tier } : {}),
  };
}

export function membershipsForAirline(memberships: readonly FrequentFlyerMembership[], airline: { iata?: string; icao?: string }): FrequentFlyerMembership[] {
  const codes = [airline.iata, airline.icao].filter((code): code is string => Boolean(code)).map((code) => code.toUpperCase());
  return memberships.filter((membership) => membership.associatedAirlines.some((code) => codes.includes(code.toUpperCase())));
}

export function autoMatchedMembership(memberships: readonly FrequentFlyerMembership[], airline: { iata?: string; icao?: string }): FrequentFlyerMembership | undefined {
  const matches = membershipsForAirline(memberships, airline);
  if (matches.length === 1) return matches[0];
  const codes = [airline.iata, airline.icao].filter((code): code is string => Boolean(code)).map((code) => code.toUpperCase());
  const defaults = matches.filter((membership) => membership.defaultForAirlines?.some((code) => codes.includes(code.toUpperCase())));
  return defaults.length === 1 ? defaults[0] : undefined;
}

export function withFrequentFlyerMemberships(extensions: ExtensionMap | undefined, memberships: readonly FrequentFlyerMembership[]): ExtensionMap | undefined {
  const next = structuredClone(extensions ?? {});
  if (memberships.length) next[FREQUENT_FLYER_EXTENSION_KEY] = { memberships: memberships as unknown as JsonValue[] };
  else delete next[FREQUENT_FLYER_EXTENSION_KEY];
  return Object.keys(next).length ? next : undefined;
}
