import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { buildRouteSegments } from "@keepraw-fly/core";
import {
  greatCirclePath,
  projectPoint,
  WORLD_GRATICULE_PATH,
  WORLD_HEIGHT,
  WORLD_LAND_PATH,
  WORLD_WIDTH,
} from "../data/map-geometry";

interface FlightRouteMapProps {
  flight: KeeprawFlight;
}

export function FlightRouteMap({ flight }: FlightRouteMapProps) {
  const { t } = useTranslation();
  const route = useMemo(() => buildRouteSegments([flight])[0], [flight]);

  if (!route) return null;

  const origin = projectPoint(route.origin);
  const destination = projectPoint(route.destination);
  const mapFrame = routeViewBox(origin, destination);

  return (
    <section className="detail-route-map" aria-labelledby="detail-route-map-title">
      <header className="detail-route-map-heading">
        <div>
          <p className="eyebrow">{t("flightDetail.routeAtlas")}</p>
          <h2 id="detail-route-map-title">{flight.origin.iata} → {flight.destination.iata}</h2>
        </div>
        <p>{t("flightDetail.routeAtlasDescription")}</p>
      </header>
      <div className="detail-route-map-canvas">
        <svg
          viewBox={mapFrame.value}
          role="img"
          aria-label={t("flightDetail.routeAtlasLabel", {
            origin: flight.origin.iata,
            destination: flight.destination.iata,
          })}
        >
          <path className="map-graticule" d={WORLD_GRATICULE_PATH} aria-hidden="true" />
          <path className="map-land" d={WORLD_LAND_PATH} aria-hidden="true" />
          <path className="detail-map-route" d={greatCirclePath(route.origin, route.destination)} />
          <g className="detail-map-airport" transform={`translate(${origin.x} ${origin.y})`}>
            <circle r={5 * mapFrame.scale} />
            <text
              x={9 * mapFrame.scale}
              y={-8 * mapFrame.scale}
              style={{ fontSize: 11 * mapFrame.scale }}
            >{route.origin.iata}</text>
          </g>
          <g className="detail-map-airport" transform={`translate(${destination.x} ${destination.y})`}>
            <circle r={5 * mapFrame.scale} />
            <text
              x={9 * mapFrame.scale}
              y={-8 * mapFrame.scale}
              style={{ fontSize: 11 * mapFrame.scale }}
            >{route.destination.iata}</text>
          </g>
        </svg>
      </div>
    </section>
  );
}

function routeViewBox(origin: { x: number; y: number }, destination: { x: number; y: number }) {
  const centerX = (origin.x + destination.x) / 2;
  const centerY = (origin.y + destination.y) / 2;
  const horizontalSpan = Math.abs(origin.x - destination.x);
  const verticalSpan = Math.abs(origin.y - destination.y);
  const aspectRatio = 2.2;
  const width = Math.min(
    WORLD_WIDTH,
    Math.max(320, horizontalSpan * 1.75, verticalSpan * aspectRatio * 1.75),
  );
  const height = Math.min(WORLD_HEIGHT, width / aspectRatio);
  const x = Math.min(Math.max(0, centerX - width / 2), WORLD_WIDTH - width);
  const y = Math.min(Math.max(0, centerY - height / 2), WORLD_HEIGHT - height);
  return {
    value: `${x} ${y} ${width} ${height}`,
    scale: width / WORLD_WIDTH,
  };
}
