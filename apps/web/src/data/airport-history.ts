import { useSyncExternalStore } from "react";
import {
  airportHistoryCandidateVersion,
  createAirportHistoryLoader,
  ensureAirportHistoryCodes,
  ensureAirportHistorySearchIndex,
  flightAirportCodes,
  subscribeAirportHistory,
  type AirportHistoryLoader,
} from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";

/**
 * Same-origin, content-hashed static assets built from the committed
 * airport-history package. Nothing here contacts GitHub or an API: Vite copies
 * each shard into the build and the browser fetches only the shards the archive
 * needs, verifying each file's manifest SHA-256 before use.
 */
// Only the shards code resolution and search read are shipped; the canonical
// full group and record rows stay in the repository package.
const shardUrls = import.meta.glob(
  [
    "../../../../packages/core/data/airport-history/observations/iata.*.jsonl.gz",
    "../../../../packages/core/data/airport-history/observations/icao.*.jsonl.gz",
    "../../../../packages/core/data/airport-history/observations/search-index.jsonl.gz",
    "../../../../packages/core/data/airport-history/transitions/codes.*.jsonl.gz",
  ],
  { query: "?url", import: "default", eager: true },
) as Record<string, string>;

const prefix = "../../../../packages/core/data/airport-history/";
const urlByPath = new Map(
  Object.entries(shardUrls).map(([key, url]) => [
    key.slice(prefix.length),
    url,
  ]),
);

export const airportHistoryLoader: AirportHistoryLoader =
  createAirportHistoryLoader(async (path) => {
    const url = urlByPath.get(path);
    if (!url) throw new Error(`Airport-history shard is not bundled: ${path}`);
    const response = await fetch(url);
    if (!response.ok)
      throw new Error(`Airport-history request failed: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  });

/** Loads the candidate shards for every code in these flights (non-blocking for formal data). */
export function loadAirportHistoryFor(
  flights: readonly KeeprawFlight[],
): Promise<void> {
  return ensureAirportHistoryCodes(
    airportHistoryLoader,
    flightAirportCodes(flights),
  );
}

export function loadAirportHistoryCodes(
  codes: readonly string[],
): Promise<void> {
  return ensureAirportHistoryCodes(
    airportHistoryLoader,
    codes.filter((code) => /^[A-Z]{3}$/.test(code)).map((code) => ({ code })),
  );
}

export function loadAirportHistorySearchIndex(): Promise<void> {
  return ensureAirportHistorySearchIndex(airportHistoryLoader);
}

/** Re-renders when a candidate shard is installed; include it in memo deps. */
export function useAirportHistoryVersion(): number {
  return useSyncExternalStore(
    subscribeAirportHistory,
    airportHistoryCandidateVersion,
    airportHistoryCandidateVersion,
  );
}
