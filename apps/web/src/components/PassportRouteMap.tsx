import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { RoutePoint, RouteSegment } from "@keepraw-fly/core";
import {
  greatCirclePath,
  polygonPoints,
  projectPoint,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  worldLandShapes,
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
          <g className="map-graticule" aria-hidden="true">
            {[-120, -60, 0, 60, 120].map((longitude) => {
              const x = projectPoint({ longitude, latitude: 0 }).x;
              return <line key={`longitude-${longitude}`} x1={x} y1="0" x2={x} y2={WORLD_HEIGHT} />;
            })}
            {[-60, -30, 0, 30, 60].map((latitude) => {
              const y = projectPoint({ longitude: 0, latitude }).y;
              return <line key={`latitude-${latitude}`} x1="0" y1={y} x2={WORLD_WIDTH} y2={y} />;
            })}
          </g>
          <g className="map-land" aria-hidden="true">
            {worldLandShapes.map((shape, index) => <polygon points={polygonPoints(shape)} key={index} />)}
          </g>
          <g className="map-routes">
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
