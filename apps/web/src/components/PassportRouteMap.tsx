import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { RoutePoint, RouteSegment } from "@keepraw-fly/core";
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
}

interface AirportMapPoint extends RoutePoint {
  flightCount: number;
}

export function PassportRouteMap({ routes }: PassportRouteMapProps) {
  const { t } = useTranslation();
  const airports = useMemo(() => collectAirports(routes), [routes]);
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
        <svg viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} role="img" aria-label={t("passport.mapPreviewLabel", { flights: totalFlights })}>
          <defs aria-hidden="true">
            <linearGradient id="passport-ocean" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1b2923" />
              <stop offset="0.55" stopColor="#14201b" />
              <stop offset="1" stopColor="#101814" />
            </linearGradient>
            <linearGradient id="passport-land" x1="0" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#405249" />
              <stop offset="1" stopColor="#2b3a32" />
            </linearGradient>
            <filter id="passport-route-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.8" result="route-blur" />
              <feMerge><feMergeNode in="route-blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path className="map-sphere" d={WORLD_SPHERE_PATH} aria-hidden="true" />
          <path className="map-graticule" d={WORLD_GRATICULE_PATH} aria-hidden="true" />
          <path className="map-land" d={WORLD_LAND_PATH} aria-hidden="true" />
          <g className="map-routes" filter="url(#passport-route-glow)">
            {routes.map((route) => (
              <path
                key={`${route.origin.iata}-${route.destination.iata}`}
                d={greatCirclePath(route.origin, route.destination)}
                style={{ strokeWidth: 1.4 + Math.min(route.flightCount, 5) * 0.55 }}
              >
                <title>{route.origin.iata} → {route.destination.iata} · {t("flights.count", { count: route.flightCount })}</title>
              </path>
            ))}
          </g>
          <g className="map-airports">
            {airports.map((airport) => {
              const point = projectPoint(airport);
              return <g key={airport.iata} transform={`translate(${point.x} ${point.y})`}>
                <circle r={3.5 + Math.min(airport.flightCount, 6) * 0.4} />
                <title>{airport.iata} · {t("flights.count", { count: airport.flightCount })}</title>
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

function collectAirports(routes: RouteSegment[]): AirportMapPoint[] {
  const points = new Map<string, AirportMapPoint>();
  for (const route of routes) {
    for (const endpoint of [route.origin, route.destination]) {
      const existing = points.get(endpoint.iata);
      if (existing) existing.flightCount += route.flightCount;
      else points.set(endpoint.iata, { ...endpoint, flightCount: route.flightCount });
    }
  }
  return [...points.values()];
}
