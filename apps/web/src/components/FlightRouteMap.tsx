import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { buildRouteSegments } from "@keepraw-fly/core";
import { flightRouteCamera } from "../data/map-camera";
import { greatCirclePath, projectPoint, WORLD_WIDTH } from "../data/map-geometry";
import { MapViewport } from "./MapViewport";
import { MapWorld } from "./MapWorld";

interface FlightRouteMapProps {
  flight: KeeprawFlight;
}

export function FlightRouteMap({ flight }: FlightRouteMapProps) {
  const { t } = useTranslation();
  const route = useMemo(() => buildRouteSegments([flight])[0], [flight]);
  const camera = useMemo(
    () => route ? flightRouteCamera(route.origin, route.destination) : null,
    [route],
  );

  if (!route || !camera) return null;

  const origin = projectPoint(route.origin);
  const destination = projectPoint(route.destination);
  const routePath = greatCirclePath(route.origin, route.destination);

  return (
    <section className="detail-route-map" aria-labelledby="detail-route-map-title">
      <h2 className="sr-only" id="detail-route-map-title">{flight.origin.iata} → {flight.destination.iata}</h2>
      <MapViewport
        className="detail-route-map-canvas"
        ariaLabel={t("flightDetail.routeAtlasLabel", {
          origin: flight.origin.iata,
          destination: flight.destination.iata,
        })}
        initialCamera={camera}
        maxZoom={8}
        labels={{
          zoomIn: t("mapControls.zoomIn"),
          zoomOut: t("mapControls.zoomOut"),
          reset: t("mapControls.reset"),
        }}
      >
        {(viewport) => {
          const inverseZoom = 1 / viewport.zoom;
          return <>
            <defs>
              <linearGradient id="detail-route-gradient" x1="0" y1="0" x2={WORLD_WIDTH} y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="var(--color-map-route-warm)" />
                <stop offset="1" stopColor="var(--color-map-route-cool)" />
              </linearGradient>
            </defs>
            <MapWorld showOutline={false} />
            <g className="detail-map-route-group">
              <path className="detail-map-route-underlay" d={routePath} />
              <path className="detail-map-route" d={routePath} />
            </g>
            <DetailAirport x={origin.x} y={origin.y} inverseZoom={inverseZoom} code={route.origin.iata} variant="origin" />
            <DetailAirport x={destination.x} y={destination.y} inverseZoom={inverseZoom} code={route.destination.iata} variant="destination" />
          </>;
        }}
      </MapViewport>
    </section>
  );
}

function DetailAirport({
  x,
  y,
  inverseZoom,
  code,
  variant,
}: {
  x: number;
  y: number;
  inverseZoom: number;
  code: string;
  variant: "origin" | "destination";
}) {
  return <g className={`detail-map-airport is-${variant}`} transform={`translate(${x} ${y})`}>
    <g transform={`scale(${inverseZoom})`}>
      <circle className="detail-map-airport-ring" r="7" />
      <circle className="detail-map-airport-point" r="3" />
      <g className="detail-map-airport-label" transform="translate(8 -23)">
        <rect width="34" height="19" rx="4" />
        <text x="17" y="13" textAnchor="middle">{code}</text>
      </g>
    </g>
  </g>;
}
