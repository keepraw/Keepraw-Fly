import type {
  JsonValue,
  KeeprawFlight,
  KeeprawFlyDocument,
} from "@keepraw-fly/schema";
import { frequentFlyerMemberships } from "@keepraw-fly/core";

/**
 * "Shareable" export: the archive without personal identifiers, for sharing
 * statistics or sample data. It stays a valid keepraw-fly document (it passes
 * the same schema and semantic validation and can be imported), but it is not
 * a backup: restoring from it permanently loses the removed fields.
 *
 * Removed:
 * - profile names (native and romanized)
 * - frequent flyer member numbers (programs, tiers and airline links remain)
 * - flight ticket numbers and booking references (PNR)
 * - legacy ticket / frequent-flyer snapshot extensions that copy those values
 * - every extension Keepraw Fly does not define (third-party namespaces and
 *   unknown keepraw-fly.* keys): their meaning cannot be judged, so they are
 *   dropped rather than risk leaking identifiers.
 *
 * Kept: routes, dates, times, airlines, aircraft, seat/cabin/booking class,
 * terminals, gates, baggage carousel, cancellation/diversion facts.
 */
export const SHAREABLE_FLIGHT_EXTENSIONS = [
  "keepraw-fly.aircraft",
  "keepraw-fly.seat",
  "keepraw-fly.baggage",
] as const;

export interface RedactionSummary {
  profileName: boolean;
  memberNumbers: number;
  ticketNumbers: number;
  bookingReferences: number;
  droppedExtensions: number;
}

type ExtensionMap = Record<string, JsonValue>;

function shareableExtensions(
  extensions: ExtensionMap | undefined,
  allowed: readonly string[],
  summary: RedactionSummary,
): ExtensionMap | undefined {
  if (!extensions) return undefined;
  const kept: ExtensionMap = {};
  for (const [key, value] of Object.entries(extensions)) {
    if (allowed.includes(key)) kept[key] = structuredClone(value);
    else summary.droppedExtensions += 1;
  }
  return Object.keys(kept).length ? kept : undefined;
}

function redactFlight(
  flight: KeeprawFlight,
  summary: RedactionSummary,
): KeeprawFlight {
  const {
    ticketNumber,
    bookingReference,
    extensions,
    frequentFlyer,
    ...facts
  } = flight;
  if (ticketNumber) summary.ticketNumbers += 1;
  if (bookingReference) summary.bookingReferences += 1;
  const legacyTicket = extensions?.["keepraw-fly.ticket"];
  if (legacyTicket && typeof legacyTicket === "object")
    summary.ticketNumbers += 1;
  const next: KeeprawFlight = structuredClone(facts);
  if (frequentFlyer)
    next.frequentFlyer = {
      membershipId: frequentFlyer.membershipId,
      ...(frequentFlyer.tierAtFlight !== undefined
        ? { tierAtFlight: frequentFlyer.tierAtFlight }
        : {}),
    };
  const kept = shareableExtensions(
    extensions,
    SHAREABLE_FLIGHT_EXTENSIONS,
    summary,
  );
  if (kept) next.extensions = kept;
  return next;
}

/** Returns a redacted deep copy; the input document is never modified. */
export function redactSensitiveData(document: KeeprawFlyDocument): {
  document: KeeprawFlyDocument;
  summary: RedactionSummary;
} {
  const summary: RedactionSummary = {
    profileName: Boolean(document.profile.name),
    memberNumbers: 0,
    ticketNumbers: 0,
    bookingReferences: 0,
    droppedExtensions: 0,
  };
  // Legacy archives keep memberships in a document extension; normalize first
  // so programs and flight links survive while their numbers do not.
  const memberships = frequentFlyerMemberships(document).map((membership) => {
    if (membership.memberNumber) summary.memberNumbers += 1;
    return { ...structuredClone(membership), memberNumber: "" };
  });
  const redacted: KeeprawFlyDocument = {
    format: document.format,
    formatVersion: document.formatVersion,
    profile: {},
    flights: document.flights.map((flight) => redactFlight(flight, summary)),
  };
  if (memberships.length) redacted.frequentFlyerMemberships = memberships;
  // No document-level extension is defined as shareable.
  if (document.extensions)
    summary.droppedExtensions += Object.keys(document.extensions).length;
  return { document: redacted, summary };
}
