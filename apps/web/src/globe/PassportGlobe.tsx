import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RouteSegment } from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import type { Appearance } from "../storage/types";
import { GlobeMap } from "./GlobeMap";
import { defaultLighting } from "./globe-lighting";
import { globeAirports } from "./globe-math";
import type { GlobeSelection } from "./globe-renderer";
import type { SolarMode } from "./globe-solar";
import "./globe-lab.css";
import "./passport-globe.css";
import "./lab-locales";

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
  const { t } = useTranslation();
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
  const selectedRoute =
    selection?.kind === "route"
      ? `${selection.origin}-${selection.destination}`
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
                    `${item.origin.iata}-${item.destination.iata}` ===
                    event.target.value,
                );
                if (route)
                  onSelect({
                    kind: "route",
                    origin: route.origin.iata,
                    destination: route.destination.iata,
                  });
                else onClear();
              }}
            >
              <option value="">{t("globe.chooseRoute")}</option>
              {routes.map((route) => (
                <option
                  key={`${route.origin.iata}-${route.destination.iata}`}
                  value={`${route.origin.iata}-${route.destination.iata}`}
                >
                  {route.origin.iata} → {route.destination.iata} ·{" "}
                  {route.flightCount}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{t("globe.airport")}</span>
            <select
              aria-label={t("globe.chooseAirport")}
              value={selection?.kind === "airport" ? selection.code : ""}
              onChange={(event) =>
                event.target.value
                  ? onSelect({ kind: "airport", code: event.target.value })
                  : onClear()
              }
            >
              <option value="">{t("globe.chooseAirport")}</option>
              {airports.map((airport) => (
                <option key={airport.iata} value={airport.iata}>
                  {airport.iata} · {airport.flightCount}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}
