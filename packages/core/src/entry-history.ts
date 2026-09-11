import type { KeeprawFlight } from "@keepraw-fly/schema";

export function recentAirportCodes(
  flights: readonly KeeprawFlight[],
  limit = 6,
): string[] {
  if (limit <= 0) return [];
  const codes: string[] = [];
  const seen = new Set<string>();
  const newestFirst = [...flights].sort((left, right) =>
    right.serviceDate.localeCompare(left.serviceDate));

  for (const flight of newestFirst) {
    for (const code of [flight.origin.iata, flight.destination.iata]) {
      if (seen.has(code)) continue;
      seen.add(code);
      codes.push(code);
      if (codes.length === limit) return codes;
    }
  }
  return codes;
}
