import { useMemo, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { RoutePoint, RouteSegment } from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  greatCirclePath,
  projectPoint,
  WORLD_GRATICULE_PATH,
  WORLD_HEIGHT,
  WORLD_LAND_PATH,
  WORLD_SPHERE_PATH,
  WORLD_WIDTH,
} from "../data/map-geometry";

interface PassportRouteMapProps {
  routes: RouteSegment[];
  flights: KeeprawFlight[];
  selectedAirport?: string;
  selectedRoute?: { origin: string; destination: string };
  onSelectAirport: (code: string) => void;
  onSelectRoute: (origin: string, destination: string) => void;
}

interface AirportMapPoint extends RoutePoint {
  flightCount: number;
  firstYear: string;
  lastYear: string;
}

export function PassportRouteMap({
  routes,
  flights,
  selectedAirport,
  selectedRoute,
  onSelectAirport,
  onSelectRoute,
}: PassportRouteMapProps) {
  const { t } = useTranslation();
  const airports = useMemo(() => collectAirports(routes, flights), [routes, flights]);
  const routeYears = useMemo(() => collectRouteYears(flights), [flights]);
  const labeledAirports = useMemo(
    () => new Set([...airports].sort((left, right) => right.flightCount - left.flightCount).slice(0, 10).map((airport) => airport.iata)),
    [airports],
  );
  const totalFlights = routes.reduce((sum, route) => sum + route.flightCount, 0);

  return (
    <section className="route-map" aria-labelledby="map-title">
      <header className="route-map-heading">
        <div>
          <p className="eyebrow">{t("passport.routes")}</p>
          <h2 id="map-title">{t("passport.map")}</h2>
          <p>{t("passport.mapDescription")}</p>
        </div>
        <span>{t("passport.mapSummary", { routes: routes.length, airports: airports.length })}</span>
      </header>

      <div className="route-map-canvas">
        <svg viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} role="group" aria-label={t("passport.mapPreviewLabel", { flights: totalFlights })}>
          <path className="map-sphere" d={WORLD_SPHERE_PATH} aria-hidden="true" />
          <path className="map-graticule" d={WORLD_GRATICULE_PATH} aria-hidden="true" />
          <path className="map-land" d={WORLD_LAND_PATH} aria-hidden="true" />
          <g className="map-routes">
            {routes.map((route, index) => {
              const key = `${route.origin.iata}-${route.destination.iata}`;
              const years = routeYears.get(key);
              const label = t("passport.mapRouteData", {
                origin: route.origin.iata,
                destination: route.destination.iata,
                count: route.flightCount,
                first: years?.firstYear,
                last: years?.lastYear,
              });
              const selected = selectedRoute?.origin === route.origin.iata
                && selectedRoute.destination === route.destination.iata;
              return <g
                key={`${route.origin.iata}-${route.destination.iata}`}
                className={selected ? "map-route is-selected" : "map-route"}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected}
                onClick={() => onSelectRoute(route.origin.iata, route.destination.iata)}
                onKeyDown={(event) => activateMapItem(event, () => onSelectRoute(route.origin.iata, route.destination.iata))}
              >
                <path
                  className="map-route-hit"
                  d={greatCirclePath(route.origin, route.destination)}
                  pathLength={1}
                />
                <path
                  className="map-route-line"
                  d={greatCirclePath(route.origin, route.destination)}
                  pathLength={1}
                  style={{
                    "--map-item-index": index,
                    strokeWidth: 1.4 + Math.min(route.flightCount, 5) * 0.55,
                  } as CSSProperties}
                />
                <title>{label}</title>
              </g>;
            })}
          </g>
          <g className="map-airports">
            {airports.map((airport, index) => {
              const point = projectPoint(airport);
              const selected = selectedAirport === airport.iata;
              const label = t("passport.mapAirportData", {
                airport: airport.iata,
                count: airport.flightCount,
                first: airport.firstYear,
                last: airport.lastYear,
              });
              return <g
                key={airport.iata}
                className={selected ? "map-airport is-selected" : "map-airport"}
                transform={`translate(${point.x} ${point.y})`}
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={selected}
                onClick={() => onSelectAirport(airport.iata)}
                onKeyDown={(event) => activateMapItem(event, () => onSelectAirport(airport.iata))}
              >
                <circle className="map-airport-hit" r="13" />
                <circle
                  className="map-airport-point"
                  r={3.5 + Math.min(airport.flightCount, 6) * 0.4}
                  style={{ "--map-item-index": index } as CSSProperties}
                />
                <title>{label}</title>
                {labeledAirports.has(airport.iata) ? <text x="8" y="-7">{airport.iata}</text> : null}
              </g>;
            })}
          </g>
        </svg>
      </div>
      <p className="route-map-legend">{t("passport.mapLegend")}</p>
    </section>
  );
}

function collectAirports(routes: RouteSegment[], flights: KeeprawFlight[]): AirportMapPoint[] {
  const points = new Map<string, AirportMapPoint>();
  const years = collectAirportYears(flights);
  for (const route of routes) {
    for (const endpoint of [route.origin, route.destination]) {
      const existing = points.get(endpoint.iata);
      if (existing) existing.flightCount += route.flightCount;
      else {
        const range = years.get(endpoint.iata);
        points.set(endpoint.iata, {
          ...endpoint,
          flightCount: route.flightCount,
          firstYear: range?.firstYear ?? "",
          lastYear: range?.lastYear ?? "",
        });
      }
    }
  }
  return [...points.values()];
}

function collectAirportYears(flights: KeeprawFlight[]) {
  const years = new Map<string, { firstYear: string; lastYear: string }>();
  for (const flight of flights) {
    const year = flight.serviceDate.slice(0, 4);
    for (const code of new Set([flight.origin.iata, flight.destination.iata])) {
      updateYearRange(years, code, year);
    }
  }
  return years;
}

function collectRouteYears(flights: KeeprawFlight[]) {
  const years = new Map<string, { firstYear: string; lastYear: string }>();
  for (const flight of flights) {
    updateYearRange(years, `${flight.origin.iata}-${flight.destination.iata}`, flight.serviceDate.slice(0, 4));
  }
  return years;
}

function updateYearRange(
  ranges: Map<string, { firstYear: string; lastYear: string }>,
  key: string,
  year: string,
) {
  const current = ranges.get(key);
  if (!current) ranges.set(key, { firstYear: year, lastYear: year });
  else {
    if (year < current.firstYear) current.firstYear = year;
    if (year > current.lastYear) current.lastYear = year;
  }
}

function activateMapItem(event: KeyboardEvent<SVGGElement>, activate: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activate();
}
