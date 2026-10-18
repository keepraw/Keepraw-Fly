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
 * - inside the three shareable extensions, everything except the fields listed
 *   in SHAREABLE_EXTENSION_FIELDS. The schema lets an extension hold any JSON,
 *   so a legacy or third-party writer may have nested a PNR, a ticket number or
 *   a name under an innocuous key; unknown keys, nested objects, arrays and
 *   values of the wrong shape are dropped (default deny), never copied.
 *
 * Kept: routes, dates, times, airlines, aircraft type/registration, seat/cabin/
 * booking class, terminals, gates, baggage carousel, cancellation/diversion
 * facts. This removes common direct identifiers only. Exact dates, flight
 * numbers, routes and seats can still identify a traveller to someone who
 * knows their trips, so the result is not anonymous.
 */
export const SHAREABLE_FLIGHT_EXTENSIONS = [
  "keepraw-fly.aircraft",
  "keepraw-fly.seat",
  "keepraw-fly.baggage",
] as const;

type ShareableExtension = (typeof SHAREABLE_FLIGHT_EXTENSIONS)[number];

/**
 * The only fields a shareable extension may carry, each a short single-line
 * string: exactly what Keepraw Fly itself writes (flight editor, importers)
 * and reads (packages/core/src/extensions.ts, statistics, search).
 */
export const SHAREABLE_EXTENSION_FIELDS: Readonly<
  Record<ShareableExtension, readonly string[]>
> = {
  "keepraw-fly.aircraft": ["type", "registration"],
  "keepraw-fly.seat": ["seat", "cabin", "bookingClass"],
  "keepraw-fly.baggage": ["carousel"],
};

/** Longer than any aircraft type, registration, seat, cabin or carousel. */
export const SHAREABLE_FIELD_MAX_LENGTH = 64;

export interface RedactionSummary {
  profileName: boolean;
  memberNumbers: number;
  ticketNumbers: number;
  bookingReferences: number;
  droppedExtensions: number;
  /** Fields removed from inside the shareable extensions. */
  droppedExtensionFields: number;
}

type ExtensionMap = Record<string, JsonValue>;

function isShareableExtension(key: string): key is ShareableExtension {
  return (SHAREABLE_FLIGHT_EXTENSIONS as readonly string[]).includes(key);
}

function isShareableValue(value: JsonValue): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= SHAREABLE_FIELD_MAX_LENGTH &&
    !/[\u0000-\u001f\u007f\u2028\u2029]/.test(value)
  );
}

/** Builds a new object from allowed fields only; the input is not touched. */
function shareableFields(
  key: ShareableExtension,
  value: JsonValue,
  summary: RedactionSummary,
): ExtensionMap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    summary.droppedExtensionFields += 1;
    return null;
  }
  const allowed = SHAREABLE_EXTENSION_FIELDS[key];
  const kept: ExtensionMap = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    if (allowed.includes(field) && isShareableValue(fieldValue))
      kept[field] = fieldValue;
    else summary.droppedExtensionFields += 1;
  }
  return Object.keys(kept).length ? kept : null;
}

function shareableExtensions(
  extensions: ExtensionMap | undefined,
  summary: RedactionSummary,
): ExtensionMap | undefined {
  if (!extensions) return undefined;
  const kept: ExtensionMap = {};
  for (const [key, value] of Object.entries(extensions)) {
    if (!isShareableExtension(key)) {
      summary.droppedExtensions += 1;
      continue;
    }
    const fields = shareableFields(key, value, summary);
    if (fields) kept[key] = fields;
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
  const kept = shareableExtensions(extensions, summary);
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
    droppedExtensionFields: 0,
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
