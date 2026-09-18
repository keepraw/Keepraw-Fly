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
      <header className="detail-route-map-heading">
        <div>
          <p className="eyebrow">{t("flightDetail.routeAtlas")}</p>
          <h2 id="detail-route-map-title">{flight.origin.iata} → {flight.destination.iata}</h2>
        </div>
        <p>{t("flightDetail.routeAtlasDescription")}</p>
      </header>
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
            <DetailAirport x={origin.x} y={origin.y} inverseZoom={inverseZoom} code={route.origin.iata} />
            <DetailAirport x={destination.x} y={destination.y} inverseZoom={inverseZoom} code={route.destination.iata} />
          </>;
        }}
      </MapViewport>
    </section>
  );
}

function DetailAirport({ x, y, inverseZoom, code }: { x: number; y: number; inverseZoom: number; code: string }) {
  return <g className="detail-map-airport" transform={`translate(${x} ${y})`}>
    <g transform={`scale(${inverseZoom})`}>
      <circle className="detail-map-airport-ring" r="8" />
      <circle className="detail-map-airport-point" r="3.5" />
      <text x="9" y="-7">{code}</text>
    </g>
  </g>;
}
