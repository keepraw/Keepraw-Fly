import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  airportSelectionTarget,
  airportTargetMatches,
  arrivalIdentity,
  localizedText,
  originIdentity,
  routeIdentityKey,
  routeKeyFromCodes,
  routePointIdentityKey,
  routeSelectionTarget,
  routeTargetMatches,
  type LocalizedText,
  type RoutePoint,
  type RouteSegment,
} from "@keepraw-fly/core";
import { normalizeLanguage } from "../locales/registry";
import { airportPickerValues, routePickerValues } from "../data/map-selection";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import type { Appearance } from "../storage/types";
import { GlobeMap } from "./GlobeMap";
import { defaultLighting } from "./globe-lighting";
import { globeAirports } from "./globe-math";
import type { GlobeSelection } from "./globe-renderer";
import type { SolarMode } from "./globe-solar";
import "./globe-lab.css";
import "./passport-globe.css";

interface PassportGlobeProps {
  routes: RouteSegment[];
  flights: KeeprawFlight[];
  appearance: Appearance;
  solarMode: SolarMode;
  selection: GlobeSelection | null;
  highlightedRoute?: string;
  onSelect: (selection: GlobeSelection) => void;
  onClear: () => void;
}

/** Production bridge: reuse the approved Lab renderer with Passport's state. */
export function PassportGlobe({
  routes,
  flights,
  appearance,
  solarMode,
  selection,
  highlightedRoute,
  onSelect,
  onClear,
}: PassportGlobeProps) {
  const { t, i18n } = useTranslation();
  // Flight-date names of each physical site, for codes two sites shared.
  const siteNames = useMemo(() => {
    const names = new Map<string, LocalizedText>();
    for (const flight of flights)
      for (const identity of [originIdentity(flight), arrivalIdentity(flight)])
        if (identity.name && !names.has(identity.identityKey))
          names.set(identity.identityKey, identity.name);
    return names;
  }, [flights]);
  const siteName = (point: RoutePoint) => {
    const name = point.identityKey && siteNames.get(point.identityKey);
    return name
      ? localizedText(name, normalizeLanguage(i18n.resolvedLanguage))
      : point.iata;
  };
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches),
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  const theme =
    appearance === "system" ? (systemDark ? "dark" : "light") : appearance;
  const airports = useMemo(() => globeAirports(routes), [routes]);
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
    <div className="passport-globe-frame" data-theme={theme}>
      <GlobeMap
        variant="passport"
        routes={routes}
        flights={flights}
        theme={theme}
        quality="4096"
        lighting={defaultLighting}
        solarMode={solarMode}
        selection={selection}
        highlightedRoute={highlightedRoute}
        onSelect={onSelect}
      />
      <details className="passport-globe-navigation">
        <summary>
          {t("globe.routes")} / {t("globe.airports")}
        </summary>
        <div className="passport-globe-picker">
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
    </div>
  );
}
