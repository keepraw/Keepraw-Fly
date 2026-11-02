import {
  routeIdentityKey,
  routeKeyFromCodes,
  routePointIdentityKey,
  type RoutePoint,
  type RouteSegment,
} from "@keepraw-fly/core";

/**
 * Picker values for routes and airports. A code (pair) stays the value while
 * it names one physical site (route); when two physical sites share a code,
 * each one's value becomes its physical identity so they stay separate.
 */
export function routePickerValues(routes: readonly RouteSegment[]) {
  const counts = new Map<string, number>();
  for (const route of routes) {
    const code = routeKeyFromCodes(route);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return new Map(
    routes.map((route) => {
      const code = routeKeyFromCodes(route);
      return [
        routeIdentityKey(route),
        counts.get(code)! > 1 ? routeIdentityKey(route) : code,
      ] as const;
    }),
  );
}

export function airportPickerValues(airports: readonly RoutePoint[]) {
  const counts = new Map<string, number>();
  for (const airport of airports)
    counts.set(airport.iata, (counts.get(airport.iata) ?? 0) + 1);
  return new Map(
    airports.map((airport) => [
      routePointIdentityKey(airport),
      counts.get(airport.iata)! > 1
        ? routePointIdentityKey(airport)
        : airport.iata,
    ]),
  );
}
