import Ajv2020, { type ErrorObject } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import keeprawFlySchema from "@keepraw-fly/schema/schema";

export interface ValidationIssue {
  path: string;
  message: string;
  keyword: string;
  received?: unknown;
  flightIndex?: number;
}

export type ValidationResult =
  | { valid: true; data: KeeprawFlyDocument; issues: [] }
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
    return { valid: true, data: input, issues: [] };
  }

  return {
    valid: false,
    issues: (validateSchema.errors ?? []).map((error) => toIssue(error, input)),
  };
}

export function parseKeeprawFlyJson(text: string): ValidationResult {
  try {
    return validateKeeprawFly(JSON.parse(text) as unknown);
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
