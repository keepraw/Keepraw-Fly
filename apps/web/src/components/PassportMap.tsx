import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  airportSelectionTarget,
  airportTargetMatches,
  arrivalIdentity,
  localizedAirportName,
  originIdentity,
  routeIdentityKey,
  routeKeyFromCodes,
  routePointIdentityKey,
  routeSelectionTarget,
  routeTargetMatches,
  type AirportSelectionTarget,
  type FlightEndpointIdentity,
  type RoutePoint,
  type RouteSegment,
  type RouteSelectionTarget,
} from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { normalizeLanguage } from "../locales/registry";
import { airportPickerValues, routePickerValues } from "../data/map-selection";
import type { MapTheme } from "../map2d/theme";
import { collectAirports, PassportRouteMap } from "./PassportRouteMap";

export type PassportMapSelection =
  AirportSelectionTarget | RouteSelectionTarget;

interface PassportMapProps {
  routes: RouteSegment[];
  flights: KeeprawFlight[];
  theme: MapTheme;
  selection: PassportMapSelection | null;
  highlightedRoute?: string;
  onSelect: (selection: PassportMapSelection) => void;
  onClear: () => void;
}

/** Production Passport map: the themed 2D route map plus its list pickers. */
export function PassportMap({
  routes,
  flights,
  theme,
  selection,
  highlightedRoute,
  onSelect,
  onClear,
}: PassportMapProps) {
  const { t, i18n } = useTranslation();
  const locale = normalizeLanguage(i18n.resolvedLanguage);
  const siteIdentities = useMemo(() => {
    const sites = new Map<string, FlightEndpointIdentity>();
    for (const flight of flights)
      for (const identity of [originIdentity(flight), arrivalIdentity(flight)])
        if (identity.confirmed && !sites.has(identity.identityKey))
          sites.set(identity.identityKey, identity);
    return sites;
  }, [flights]);
  const siteName = (point: RoutePoint) => {
    const identity = point.identityKey
      ? siteIdentities.get(point.identityKey)
      : undefined;
    return (
      localizedAirportName(identity?.airportId, locale, identity?.localDate) ??
      point.iata
    );
  };
  const airports = useMemo(
    () =>
      // Same source as the drawn markers, so a flight returning to its origin
      // keeps its airport in the picker even though it draws no route.
      collectAirports(flights, locale).sort(
        (a, b) => b.flightCount - a.flightCount || a.iata.localeCompare(b.iata),
      ),
    [flights, locale],
  );
  // Picker values are codes unless two physical sites share them.
  const routeValues = useMemo(() => routePickerValues(routes), [routes]);
  const airportValues = useMemo(
    () => airportPickerValues(airports),
    [airports],
  );
  const selectedRouteSegment =
    selection?.kind === "route"
      ? routes.find((route) => routeTargetMatches(selection, route))
      : undefined;
  const selectedRoute = selectedRouteSegment
    ? (routeValues.get(routeIdentityKey(selectedRouteSegment)) ?? "")
    : "";
  const selectedAirportPoint =
    selection?.kind === "airport"
      ? airports.find((airport) => airportTargetMatches(selection, airport))
      : undefined;
  const selectedAirport = selectedAirportPoint
    ? (airportValues.get(routePointIdentityKey(selectedAirportPoint)) ?? "")
    : "";

  return (
    <PassportRouteMap
      routes={routes}
      flights={flights}
      theme={theme}
      selectedAirport={selection?.kind === "airport" ? selection : undefined}
      selectedRoute={selection?.kind === "route" ? selection : undefined}
      highlightedRoute={highlightedRoute}
      onSelectAirport={onSelect}
      onSelectRoute={onSelect}
    >
      <details className="passport-map-navigation">
        <summary>
          {t("globe.routes")} / {t("globe.airports")}
        </summary>
        <div className="passport-map-picker">
          <label>
            <span>{t("globe.route")}</span>
            <select
              aria-label={t("globe.chooseRoute")}
              value={selectedRoute}
              onChange={(event) => {
                const route = routes.find(
                  (item) =>
                    routeValues.get(routeIdentityKey(item)) ===
                    event.target.value,
                );
                if (route) onSelect(routeSelectionTarget(route));
                else onClear();
              }}
            >
              <option value="">{t("globe.chooseRoute")}</option>
              {routes.map((route) => (
                <option
                  key={routeIdentityKey(route)}
                  value={routeValues.get(routeIdentityKey(route))}
                >
                  {route.origin.iata} → {route.destination.iata}
                  {routeValues.get(routeIdentityKey(route)) !==
                  routeKeyFromCodes(route)
                    ? ` (${siteName(route.origin)} → ${siteName(route.destination)})`
                    : ""}{" "}
                  · {route.flightCount}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("globe.airport")}</span>
            <select
              aria-label={t("globe.chooseAirport")}
              value={selectedAirport}
              onChange={(event) => {
                const airport = airports.find(
                  (item) =>
                    airportValues.get(routePointIdentityKey(item)) ===
                    event.target.value,
                );
                if (airport) onSelect(airportSelectionTarget(airport));
                else onClear();
              }}
            >
              <option value="">{t("globe.chooseAirport")}</option>
              {airports.map((airport) => (
                <option
                  key={routePointIdentityKey(airport)}
                  value={airportValues.get(routePointIdentityKey(airport))}
                >
                  {airport.iata}
                  {airportValues.get(routePointIdentityKey(airport)) !==
                  airport.iata
                    ? ` · ${siteName(airport)}`
                    : ""}{" "}
                  · {airport.flightCount}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </PassportRouteMap>
  );
}
