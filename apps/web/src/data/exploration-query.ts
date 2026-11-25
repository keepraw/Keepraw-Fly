import {
  canonicalAirlineCode,
  FLIGHT_SORT_ORDERS,
  type FlightSortOrder,
} from "@keepraw-fly/core";
import type {
  PassportSelection,
  PassportViewState,
} from "./passport-exploration";

/**
 * The part of the exploration state mirrored into the fragment query
 * (docs/views-and-skins.md). Search text is deliberately absent: it stays in
 * memory so search terms never reach the address or the browser history.
 */
export type ExplorationQueryState = Pick<
  PassportViewState,
  "year" | "selection" | "airline" | "aircraft" | "sort"
>;

const CODE = /^[A-Z0-9]{2,4}$/;
const IDENTITY_KEY = /^[\w:.-]{1,80}$/;

function encode(value: string): string {
  // ":" is legal in a fragment and keeps identity keys readable.
  return encodeURIComponent(value).replaceAll("%3A", ":");
}

/** The query for a view state, with its leading `?`, or "" for the defaults. */
export function formatExplorationQuery(view: ExplorationQueryState): string {
  const parts: [string, string][] = [];
  if (view.year !== "lifetime") parts.push(["year", String(view.year)]);
  const selection = view.selection;
  if (selection?.kind === "airport") {
    parts.push(["airport", selection.code]);
    if (selection.identityKey) parts.push(["at", selection.identityKey]);
  }
  if (selection?.kind === "route") {
    parts.push(["route", `${selection.origin}-${selection.destination}`]);
    if (selection.originIdentityKey && selection.destinationIdentityKey) {
      parts.push(["from", selection.originIdentityKey]);
      parts.push(["to", selection.destinationIdentityKey]);
    }
  }
  if (view.airline) parts.push(["airline", view.airline]);
  if (view.aircraft) parts.push(["aircraft", view.aircraft]);
  if (view.sort !== "newest") parts.push(["sort", view.sort]);
  return parts.length
    ? `?${parts.map(([key, value]) => `${key}=${encode(value)}`).join("&")}`
    : "";
}

function parseSelection(params: URLSearchParams): PassportSelection | null {
  const airport = params.get("airport");
  if (airport && CODE.test(airport)) {
    const identityKey = params.get("at");
    return identityKey && IDENTITY_KEY.test(identityKey)
      ? { kind: "airport", code: airport, identityKey }
      : { kind: "airport", code: airport };
  }
  const [origin, destination, ...rest] = (params.get("route") ?? "").split("-");
  if (
    origin &&
    destination &&
    !rest.length &&
    CODE.test(origin) &&
    CODE.test(destination)
  ) {
    const originIdentityKey = params.get("from");
    const destinationIdentityKey = params.get("to");
    return originIdentityKey &&
      destinationIdentityKey &&
      IDENTITY_KEY.test(originIdentityKey) &&
      IDENTITY_KEY.test(destinationIdentityKey)
      ? {
          kind: "route",
          origin,
          destination,
          originIdentityKey,
          destinationIdentityKey,
        }
      : { kind: "route", origin, destination };
  }
  return null;
}

/**
 * The exploration state written in a fragment such as `#/log?year=2025`.
 * Returns `null` when the fragment carries no query, so the state in memory is
 * kept; unknown or malformed values fall back to their defaults.
 */
export function parseExplorationQuery(
  fragment: string,
): ExplorationQueryState | null {
  const start = fragment.indexOf("?");
  if (start < 0) return null;
  const params = new URLSearchParams(fragment.slice(start + 1));
  const year = params.get("year") ?? "";
  const airline = params.get("airline");
  const sort = params.get("sort") as FlightSortOrder;
  return {
    year: /^\d{4}$/.test(year) ? Number(year) : "lifetime",
    selection: parseSelection(params),
    airline:
      airline && CODE.test(airline) ? canonicalAirlineCode(airline) : null,
    // Free text matched exactly against the recorded type, so it is kept as written.
    aircraft: params.get("aircraft") || null,
    sort: FLIGHT_SORT_ORDERS.includes(sort) ? sort : "newest",
  };
}
