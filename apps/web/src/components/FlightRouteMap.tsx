import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  airportDirectoryVersion,
  storedEndpointTimezone,
  type RoutePoint,
} from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { greatCirclePath, projectPoint } from "../data/map-geometry";
import { airportLabelPositions } from "../data/map-labels";
import {
  FLIGHT_ROUTE_MAX_ZOOM,
  flightRouteCamera,
  flightRouteScene,
} from "../map2d/flight-route";
import { mapThemeCssVariables } from "../map2d/theme-css";
import type { MapTheme } from "../map2d/theme";
import { MapViewport } from "./MapViewport";
import { MapWorld } from "./MapWorld";

/** Flight Detail map: one automatically framed route on the themed 2D map. */
export function FlightRouteMap({
  flight,
  theme,
}: {
  flight: KeeprawFlight;
  theme: MapTheme;
}) {
  const { t } = useTranslation();
  // Only flight identity and route semantics rebuild the scene; editing notes
  // or switching language keeps the user's camera.
  const { id, origin, destination, divertedTo, cancelled, serviceDate } =
    flight;
  const scene = useMemo(
    () => flightRouteScene(flight),
    [
      id,
      cancelled,
      serviceDate,
      origin.iata,
      origin.airportId,
      destination.iata,
      destination.airportId,
      divertedTo?.iata,
      divertedTo?.airportId,
      flight.actualArrival ?? flight.scheduledArrival,
      storedEndpointTimezone(flight, "origin"),
      storedEndpointTimezone(flight, "destination"),
      storedEndpointTimezone(flight, "divertedTo"),
      airportDirectoryVersion(),
    ],
  );
  const geometry = useMemo(() => {
    if (!scene.origin || !scene.arrival) return null;
    const center = scene.centerLongitude;
    const marker = (
      point: RoutePoint,
      role: "origin" | "arrival" | "planned",
    ) => ({
      ...point,
      key: role,
      role,
      flightCount: role === "planned" ? 0 : 1,
      point: projectPoint(point, center),
    });
    return {
      path: greatCirclePath(scene.origin, scene.arrival, 96, center),
      plannedPath: scene.planned
        ? greatCirclePath(scene.origin, scene.planned, 96, center)
        : null,
      markers: [
        marker(scene.origin, "origin"),
        marker(scene.arrival, "arrival"),
        ...(scene.planned ? [marker(scene.planned, "planned")] : []),
      ],
    };
  }, [scene]);

  return (
    <div
      className="detail-route-map detail-flight-map"
      data-map-theme={theme.id}
      data-route-status={scene.status}
      style={mapThemeCssVariables(theme)}
    >
      {geometry && scene.origin && scene.arrival ? (
        <MapViewport
          className="detail-flight-map-canvas"
          ariaLabel={t("flightDetail.routeMapLabel", {
            origin: scene.origin.iata,
            destination: scene.arrival.iata,
          })}
          initialCamera={flightRouteCamera(scene)}
          cameraForViewport={(height) => flightRouteCamera(scene, height)}
          maxZoom={FLIGHT_ROUTE_MAX_ZOOM * 2}
          minZoom={0.5}
          labels={{
            zoomIn: t("mapControls.zoomIn"),
            zoomOut: t("mapControls.zoomOut"),
            reset: t("mapControls.reset"),
          }}
        >
          {(camera, height, pixelScale) => {
            const labels = airportLabelPositions(
              geometry.markers,
              camera,
              height,
              new Set(geometry.markers.map((marker) => marker.key)),
              pixelScale,
            );
            return (
              <>
                <MapWorld
                  theme={theme}
                  zoom={camera.zoom}
                  pixelScale={pixelScale}
                  centerLongitude={scene.centerLongitude}
                  showOutline={false}
                />
                <g className="map-routes">
                  {geometry.plannedPath ? (
                    <path
                      className="map-route-planned"
                      d={geometry.plannedPath}
                    />
                  ) : null}
                  <g className="map-route is-selected">
                    <path className="map-route-glow" d={geometry.path} />
                    <path className="map-route-line" d={geometry.path} />
                  </g>
                </g>
                <g className="map-airports">
                  {geometry.markers.map((marker) => {
                    const label = labels.get(marker.key);
                    return (
                      <g
                        key={marker.key}
                        className={
                          marker.role === "planned"
                            ? "map-airport is-planned"
                            : "map-airport is-selected"
                        }
                        data-airport-identity={marker.identityKey}
                        data-airport-role={marker.role}
                        transform={`translate(${marker.point.x} ${marker.point.y})`}
                      >
                        <g transform={`scale(${pixelScale / camera.zoom})`}>
                          <circle className="map-airport-ring" r="8" />
                          <circle className="map-airport-point" r="4" />
                          {marker.role === "planned" ? (
                            <title>
                              {t("flightDetail.plannedArrival", {
                                airport: marker.iata,
                              })}
                            </title>
                          ) : null}
                          {label ? (
                            <text
                              className="map-airport-label"
                              x={label.x}
                              y={label.y}
                              textAnchor={label.anchor}
                            >
                              {marker.iata}
                            </text>
                          ) : null}
                        </g>
                      </g>
                    );
                  })}
                </g>
              </>
            );
          }}
        </MapViewport>
      ) : (
        <div className="detail-flight-map-message" role="status">
          {t(
            cancelled
              ? "routeMap.detailCancelled"
              : "routeMap.detailUnavailable",
          )}
        </div>
      )}
    </div>
  );
}
