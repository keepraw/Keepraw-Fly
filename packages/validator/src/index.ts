import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  KEEPRAW_FLY_FORMAT,
  KEEPRAW_FLY_FORMAT_VERSION,
  type KeeprawFlyDocument,
} from "@keepraw-fly/schema";
import keeprawFlySchema from "@keepraw-fly/schema/schema";
import { canonicalAirlineCode } from "@keepraw-fly/core";

export interface ValidationIssue {
  path: string;
  message: string;
  keyword: string;
  received?: unknown;
  flightIndex?: number;
}

export type KeeprawFlyMigration = "rawfly-brand" | "version-0.1" | "flight-metadata-v2";

export type ValidationResult =
  | { valid: true; data: KeeprawFlyDocument; issues: []; migrations: KeeprawFlyMigration[] }
  | { valid: false; issues: ValidationIssue[] };

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const validateSchema = ajv.compile<KeeprawFlyDocument>(keeprawFlySchema);

function valueAtPath(input: unknown, instancePath: string): unknown {
  if (!instancePath) return input;

  return instancePath
    .split("/")
    .slice(1)
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce<unknown>((value, segment) => {
      if (Array.isArray(value)) return value[Number(segment)];
      if (value && typeof value === "object") {
        return (value as Record<string, unknown>)[segment];
      }
      return undefined;
    }, input);
}

function displayPath(error: ErrorObject): string {
  if (error.keyword === "required") {
    const missing = (error.params as { missingProperty: string }).missingProperty;
    return `${error.instancePath}/${missing}`;
  }

  if (error.keyword === "additionalProperties") {
    const extra = (error.params as { additionalProperty: string })
      .additionalProperty;
    return `${error.instancePath}/${extra}`;
  }

  return error.instancePath || "/";
}

function humanMessage(error: ErrorObject): string {
  if (error.keyword === "format") {
    const format = (error.params as { format: string }).format;
    if (format === "date-time") {
      return "Expected an ISO 8601 datetime with an explicit timezone.";
    }
    if (format === "date") return "Expected an ISO 8601 date (YYYY-MM-DD).";
  }

  if (error.keyword === "additionalProperties") {
    return "This field is not part of the Keepraw Fly 0.1 core schema.";
  }

  return error.message ? `Expected value ${error.message}.` : "Invalid value.";
}

function toIssue(error: ErrorObject, input: unknown): ValidationIssue {
  const path = displayPath(error);
  const match = /^\/flights\/(\d+)/.exec(path);

  return {
    path,
    keyword: error.keyword,
    message: humanMessage(error),
    received: valueAtPath(input, path),
    ...(match ? { flightIndex: Number(match[1]) } : {}),
  };
}

function semanticIssues(document: KeeprawFlyDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenIds = new Set<string>();
  const membershipIds = new Set<string>();

  document.frequentFlyerMemberships?.forEach((membership, membershipIndex) => {
    if (membershipIds.has(membership.id)) {
      issues.push({
        path: `/frequentFlyerMemberships/${membershipIndex}/id`,
        keyword: "uniqueMembershipId",
        message: "Frequent-flyer membership id must be unique within a Keepraw Fly document.",
        received: membership.id,
      });
    }
    membershipIds.add(membership.id);
    if (membership.defaultAirline && !membership.associatedAirlines.includes(membership.defaultAirline)) {
      issues.push({
        path: `/frequentFlyerMemberships/${membershipIndex}/defaultAirline`,
        keyword: "membershipDefaultAirline",
        message: "Default airline must be one of the membership's associated airlines.",
        received: membership.defaultAirline,
      });
    }
  });

  document.flights.forEach((flight, flightIndex) => {
    if (seenIds.has(flight.id)) {
      issues.push({
        path: `/flights/${flightIndex}/id`,
        keyword: "uniqueFlightId",
        message: "Flight id must be unique within a Keepraw Fly document.",
        received: flight.id,
        flightIndex,
      });
    }
    seenIds.add(flight.id);

    if (flight.frequentFlyer && !membershipIds.has(flight.frequentFlyer.membershipId)) {
      issues.push({
        path: `/flights/${flightIndex}/frequentFlyer/membershipId`,
        keyword: "membershipReference",
        message: "Flight frequent-flyer reference must point to a saved membership.",
        received: flight.frequentFlyer.membershipId,
        flightIndex,
      });
    }

    if (flight.scheduledDeparture.slice(0, 10) !== flight.serviceDate) {
      issues.push({
        path: `/flights/${flightIndex}/serviceDate`,
        keyword: "serviceDate",
        message: "Service date must match the local date in scheduled departure.",
        received: flight.serviceDate,
        flightIndex,
      });
    }

    if (Date.parse(flight.scheduledArrival) <= Date.parse(flight.scheduledDeparture)) {
      issues.push({
        path: `/flights/${flightIndex}/scheduledArrival`,
        keyword: "chronology",
        message: "Scheduled arrival must be later than scheduled departure.",
        received: flight.scheduledArrival,
        flightIndex,
      });
    }

    if (
      flight.actualDeparture &&
      flight.actualArrival &&
      Date.parse(flight.actualArrival) <= Date.parse(flight.actualDeparture)
    ) {
      issues.push({
        path: `/flights/${flightIndex}/actualArrival`,
        keyword: "chronology",
        message: "Actual arrival must be later than actual departure.",
        received: flight.actualArrival,
        flightIndex,
      });
    }
  });

  return issues;
}

export function validateKeeprawFly(input: unknown): ValidationResult {
  if (validateSchema(input)) {
    const issues = semanticIssues(input);
    if (issues.length) return { valid: false, issues };
    return { valid: true, data: input, issues: [], migrations: [] };
  }

  return {
    valid: false,
    issues: (validateSchema.errors ?? []).map((error) => toIssue(error, input)),
  };
}

export function validateAndMigrateKeeprawFly(input: unknown): ValidationResult {
  const { data, migrations } = migrateKeeprawFly(input);
  const result = validateKeeprawFly(data);
  return result.valid ? { ...result, migrations } : result;
}

export function migrateKeeprawFly(input: unknown): {
  data: unknown;
  migrations: KeeprawFlyMigration[];
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { data: input, migrations: [] };
  }

  const source = input as Record<string, unknown>;
  const data = structuredClone(source);
  const migrations: KeeprawFlyMigration[] = [];

  if (data.format === "rawfly") {
    data.format = KEEPRAW_FLY_FORMAT;
    migrations.push("rawfly-brand");
  }
  if (data.formatVersion === "0.1") {
    data.formatVersion = KEEPRAW_FLY_FORMAT_VERSION;
    migrations.push("version-0.1");
  }

  if (migrateFlightMetadata(data)) migrations.push("flight-metadata-v2");

  return { data, migrations };
}

function migrateFlightMetadata(document: Record<string, unknown>): boolean {
  let changed = false;
  const documentExtensions = objectValue(document.extensions);
  const legacyFrequentFlyer = objectValue(documentExtensions?.["keepraw-fly.frequent-flyer"]);
  const sourceMemberships = Array.isArray(document.frequentFlyerMemberships)
    ? document.frequentFlyerMemberships
    : Array.isArray(legacyFrequentFlyer?.memberships) ? legacyFrequentFlyer.memberships : [];
  const memberships = sourceMemberships.flatMap((item) => normalizeMembership(item));
  const membershipIds = new Set(memberships.map((membership) => membership.id));

  if ((!Array.isArray(document.frequentFlyerMemberships) && sourceMemberships.length)
    || sourceMemberships.some((item) => {
      const value = objectValue(item);
      return !value?.programId
        || membershipAirlinesNeedMigration(value);
    })) changed = true;
  if (legacyFrequentFlyer && documentExtensions) {
    delete documentExtensions["keepraw-fly.frequent-flyer"];
    changed = true;
  }

  if (Array.isArray(document.flights)) {
    document.flights = document.flights.map((item) => {
      const flight = objectValue(item);
      if (!flight) return item;
      const next = { ...flight };
      const extensions = objectValue(next.extensions);
      if (!extensions) return next;

      const baggage = objectValue(extensions["keepraw-fly.baggage"]);
      if (baggage) {
        if (!("baggageCarousel" in next)) {
          next.baggageCarousel = typeof baggage.carousel === "string" && baggage.carousel ? baggage.carousel : null;
        }
        delete extensions["keepraw-fly.baggage"];
        changed = true;
      }

      const ticket = objectValue(extensions["keepraw-fly.ticket"]);
      if (ticket) {
        if (!("ticketNumber" in next)) {
          next.ticketNumber = typeof ticket.number === "string" && ticket.number ? ticket.number : null;
        }
        delete extensions["keepraw-fly.ticket"];
        changed = true;
      }

      const oldSnapshot = objectValue(extensions["keepraw-fly.frequent-flyer"]);
      if (oldSnapshot) {
        if (!("frequentFlyer" in next)) {
          let membershipId = typeof oldSnapshot.membershipId === "string" ? oldSnapshot.membershipId : undefined;
          if (!membershipId || !membershipIds.has(membershipId)) {
            const programName = typeof oldSnapshot.programName === "string" ? oldSnapshot.programName : "";
            const memberNumber = typeof oldSnapshot.memberNumber === "string" ? oldSnapshot.memberNumber : "";
            const matching = memberships.find((membership) =>
              membership.memberNumber === memberNumber
              && (membership.programName === programName || membership.programId === programId(programName)),
            );
            membershipId = matching?.id;
            if (!membershipId && (programName || memberNumber)) {
              membershipId = uniqueLegacyMembershipId(String(next.id ?? "flight"), membershipIds);
              memberships.push({
                id: membershipId,
                programId: programId(programName),
                ...(programName ? { programName } : {}),
                memberNumber,
                associatedAirlines: [],
                defaultAirline: null,
              });
              membershipIds.add(membershipId);
            }
          }
          if (membershipId) {
            next.frequentFlyer = {
              membershipId,
              tierAtFlight: typeof oldSnapshot.tier === "string" && oldSnapshot.tier ? oldSnapshot.tier : null,
            };
          }
        }
        delete extensions["keepraw-fly.frequent-flyer"];
        changed = true;
      }

      if (Object.keys(extensions).length) next.extensions = extensions;
      else delete next.extensions;
      return next;
    });
  }

  if (memberships.length) document.frequentFlyerMemberships = memberships;
  else delete document.frequentFlyerMemberships;
  if (documentExtensions && Object.keys(documentExtensions).length) document.extensions = documentExtensions;
  else delete document.extensions;
  return changed;
}

function normalizeMembership(item: unknown): Array<Record<string, unknown> & { id: string; programId: string; memberNumber: string }> {
  const value = objectValue(item);
  if (!value || typeof value.id !== "string" || typeof value.memberNumber !== "string") return [];
  const name = typeof value.programName === "string" ? value.programName : "";
  const id = typeof value.programId === "string" && value.programId ? value.programId : programId(name);
  const associatedAirlines = uniqueAirlineCodes(value.associatedAirlines);
  const legacyDefaults = stringValues(value.defaultForAirlines);
  const requestedDefault = typeof value.defaultAirline === "string"
    ? canonicalAirlineCode(value.defaultAirline)
    : legacyDefaults[0] ? canonicalAirlineCode(legacyDefaults[0]) : null;
  const defaultAirline = associatedAirlines.length === 1
    ? associatedAirlines[0]!
    : requestedDefault && associatedAirlines.includes(requestedDefault) ? requestedDefault : null;
  return [{
    id: value.id,
    programId: id,
    ...(name ? { programName: name } : {}),
    memberNumber: value.memberNumber,
    ...(typeof value.tier === "string" && value.tier ? { tier: value.tier } : value.tier === null ? { tier: null } : {}),
    associatedAirlines,
    defaultAirline,
  }];
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return value.split(/[\s,，]+/).filter(Boolean);
  return stringArray(value);
}

function uniqueAirlineCodes(value: unknown): string[] {
  return [...new Set(stringValues(value).map(canonicalAirlineCode).filter(Boolean))];
}

function membershipAirlinesNeedMigration(value: Record<string, unknown> | null): boolean {
  if (!value || !Array.isArray(value.associatedAirlines) || "defaultForAirlines" in value) return true;
  const canonical = uniqueAirlineCodes(value.associatedAirlines);
  const stored = stringArray(value.associatedAirlines);
  if (canonical.length !== stored.length || canonical.some((code, index) => code !== stored[index])) return true;
  const requestedDefault = typeof value.defaultAirline === "string" ? canonicalAirlineCode(value.defaultAirline) : null;
  const expectedDefault = canonical.length === 1
    ? canonical[0]!
    : requestedDefault && canonical.includes(requestedDefault) ? requestedDefault : null;
  return value.defaultAirline !== expectedDefault;
}

function programId(value: string): string {
  const normalized = value.trim().toLocaleLowerCase();
  if (["phoenixmiles", "凤凰知音", "鳳凰知音"].includes(normalized)) return "phoenixmiles";
  const slug = normalized.normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "custom";
}

function uniqueLegacyMembershipId(flightId: string, used: Set<string>): string {
  const base = `legacy-ff-${flightId.replace(/[^a-zA-Z0-9_-]+/g, "-") || "flight"}`;
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) candidate = `${base}-${suffix++}`;
  return candidate;
}

export function parseKeeprawFlyJson(text: string): ValidationResult {
  try {
    return validateAndMigrateKeeprawFly(JSON.parse(text) as unknown);
  } catch (error) {
    return {
      valid: false,
      issues: [
        {
          path: "/",
          keyword: "parse",
          message:
            error instanceof SyntaxError
              ? `The file is not valid JSON: ${error.message}`
              : "The file could not be read as JSON.",
        },
      ],
    };
  }
}
