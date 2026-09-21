import type {
  FrequentFlyerMembership,
  JsonValue,
  KeeprawFlight,
  KeeprawFlyDocument,
} from "@keepraw-fly/schema";
import type { SupportedLocale } from "./reference-data";
import { frequentFlyerProgramId, frequentFlyerProgramName } from "./frequent-flyer-programs";
import { canonicalAirlineCode } from "./airline-reference";

export const TICKET_EXTENSION_KEY = "keepraw-fly.ticket";
export const FREQUENT_FLYER_EXTENSION_KEY = "keepraw-fly.frequent-flyer";

export type { FrequentFlyerMembership } from "@keepraw-fly/schema";

export interface TicketFacts { number: string }

export interface FrequentFlyerSnapshot {
  membershipId: string;
  programId: string;
  programName: string;
  memberNumber: string;
  tierAtFlight?: string;
}

function objectValue(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function strings(value: JsonValue | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function airlineStrings(value: JsonValue | undefined): string[] {
  if (typeof value === "string") return value.split(/[\s,，]+/).filter(Boolean);
  return strings(value);
}

export function normalizeMembershipAirlines(
  codes: readonly string[],
  requestedDefault?: string | null,
): Pick<FrequentFlyerMembership, "associatedAirlines" | "defaultAirline"> {
  const associatedAirlines = [...new Set(codes.map(canonicalAirlineCode).filter(Boolean))];
  const canonicalDefault = requestedDefault ? canonicalAirlineCode(requestedDefault) : null;
  const defaultAirline = associatedAirlines.length === 1
    ? associatedAirlines[0]!
    : canonicalDefault && associatedAirlines.includes(canonicalDefault) ? canonicalDefault : null;
  return { associatedAirlines, defaultAirline };
}

export function ticketFacts(flight: KeeprawFlight): TicketFacts | null {
  if (typeof flight.ticketNumber === "string" && flight.ticketNumber) return { number: flight.ticketNumber };
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

export function frequentFlyerMemberships(
  document: Pick<KeeprawFlyDocument, "frequentFlyerMemberships" | "extensions">,
): FrequentFlyerMembership[] {
  if (document.frequentFlyerMemberships) {
    return document.frequentFlyerMemberships.map((membership) => ({
      ...membership,
      ...normalizeMembershipAirlines(membership.associatedAirlines, membership.defaultAirline),
    }));
  }
  const root = objectValue(document.extensions?.[FREQUENT_FLYER_EXTENSION_KEY]);
  if (!Array.isArray(root?.memberships)) return [];
  return root.memberships.flatMap((item) => {
    const value = objectValue(item);
    if (!value || typeof value.id !== "string" || typeof value.programName !== "string" || typeof value.memberNumber !== "string") return [];
    const associatedAirlines = airlineStrings(value.associatedAirlines);
    const legacyDefaults = airlineStrings(value.defaultForAirlines);
    return [{
      id: value.id,
      programId: frequentFlyerProgramId(value.programName),
      programName: value.programName,
      memberNumber: value.memberNumber,
      ...(typeof value.tier === "string" && value.tier ? { tier: value.tier } : {}),
      ...normalizeMembershipAirlines(
        associatedAirlines,
        typeof value.defaultAirline === "string" ? value.defaultAirline : legacyDefaults[0],
      ),
    }];
  });
}

export function frequentFlyerSnapshot(
  flight: KeeprawFlight,
  memberships: readonly FrequentFlyerMembership[],
  locale: SupportedLocale,
): FrequentFlyerSnapshot | null {
  const reference = flight.frequentFlyer;
  if (!reference) return null;
  const membership = memberships.find((item) => item.id === reference.membershipId);
  if (!membership) return null;
  return {
    membershipId: membership.id,
    programId: membership.programId,
    programName: frequentFlyerProgramName(membership, locale),
    memberNumber: membership.memberNumber,
    ...(reference.tierAtFlight ? { tierAtFlight: reference.tierAtFlight } : {}),
  };
}

export function membershipsForAirline(memberships: readonly FrequentFlyerMembership[], airline: { iata?: string; icao?: string }): FrequentFlyerMembership[] {
  const code = canonicalAirlineCode(airline);
  return memberships.filter((membership) => membership.associatedAirlines.includes(code));
}

export function autoMatchedMembership(memberships: readonly FrequentFlyerMembership[], airline: { iata?: string; icao?: string }): FrequentFlyerMembership | undefined {
  const matches = membershipsForAirline(memberships, airline);
  if (matches.length === 1) return matches[0];
  const code = canonicalAirlineCode(airline);
  const defaults = matches.filter((membership) => membership.defaultAirline === code);
  return defaults.length === 1 ? defaults[0] : undefined;
}

export function withFrequentFlyerMemberships(
  document: KeeprawFlyDocument,
  memberships: readonly FrequentFlyerMembership[],
): KeeprawFlyDocument {
  const next = structuredClone(document);
  if (memberships.length) next.frequentFlyerMemberships = memberships.map((membership) => ({
    id: membership.id,
    programId: membership.programId || "custom",
    ...(membership.programName?.trim() ? { programName: membership.programName.trim() } : {}),
    memberNumber: membership.memberNumber.trim(),
    ...(membership.tier?.trim() ? { tier: membership.tier.trim() } : {}),
    ...normalizeMembershipAirlines(membership.associatedAirlines, membership.defaultAirline),
  }));
  else delete next.frequentFlyerMemberships;
  const extensions = structuredClone(next.extensions ?? {});
  delete extensions[FREQUENT_FLYER_EXTENSION_KEY];
  if (Object.keys(extensions).length) next.extensions = extensions;
  else delete next.extensions;
  return next;
}
