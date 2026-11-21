import { geoPath } from "d3-geo";
import { useId, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { MapViewport } from "../components/MapViewport";
import { airportLabelPositions } from "../data/map-labels";
import { regionalCenterLongitude } from "../data/map-geometry";
import { WORLD_CAMERA } from "../data/map-camera";
import {
  airportStyle,
  hatchTile,
  NEON_AVIATION,
  rgba,
  routeStroke,
  routeTier,
  type NeonRouteState,
} from "./neon-aviation-tokens";
import {
  greatCirclePath,
  projectionAt,
  regionalWorldPaths,
} from "./neon-geometry";
import {
  DENSE_ROUTES,
  NEON_AIRPORTS,
  SPARSE_ROUTES,
  type NeonAirport,
} from "./sample-network";

export interface NeonWorldMapProps {
  density?: "sparse" | "dense";
  forcedState?: "normal" | "hover" | "selected";
}

export function NeonWorldMap({
  density = "sparse",
  forcedState,
}: NeonWorldMapProps) {
  const routes = density === "dense" ? DENSE_ROUTES : SPARSE_ROUTES;
  const maxCount = Math.max(...routes.map((route) => route.count));
  const routeCenter = useMemo(
    () =>
      regionalCenterLongitude(
        NEON_AIRPORTS.map(({ latitude, longitude }) => ({
          latitude,
          longitude,
        })),
      ),
    [],
  );
  const paths = useMemo(() => regionalWorldPaths(routeCenter), [routeCenter]);
  const routeLines = useMemo(
    () =>
      routes
        .map((route) => ({
          ...route,
          path: greatCirclePath(
            route.origin,
            route.destination,
            48,
            routeCenter,
          ),
        }))
        .sort((left, right) => left.count - right.count),
    [routeCenter, routes],
  );
  const airportCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const route of routes) {
      counts.set(
        route.origin.iata,
        (counts.get(route.origin.iata) ?? 0) + route.count,
      );
      counts.set(
        route.destination.iata,
        (counts.get(route.destination.iata) ?? 0) + route.count,
      );
    }
    return counts;
  }, [routes]);
  const hubs = new Set(
    [...airportCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([code]) => code),
  );
  const centerProjection = useMemo(
    () => projectionAt(routeCenter),
    [routeCenter],
  );
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [hoveredAirport, setHoveredAirport] = useState<string | null>(null);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const forcedSelectedRoute =
    forcedState === "selected" ? (routeLines[0]?.id ?? null) : null;
  const activeSelectedRoute = selectedRoute ?? forcedSelectedRoute;
  const generatedId = useId().replaceAll(":", "");
  const patternId = `neon-hatch-${generatedId}`;
  const landClipId = `neon-land-${generatedId}`;
  const haloId = `neon-halo-${generatedId}`;

  return (
    <MapViewport
      ariaLabel="Interactive fictional flight network map"
      className="neon-map-viewport"
      initialCamera={WORLD_CAMERA}
      labels={{ zoomIn: "Zoom in", zoomOut: "Zoom out", reset: "Map controls" }}
    >
      {(camera, viewportHeight, pixelScale) => {
        const tile = hatchTile(
          NEON_AVIATION.hatch,
          window.devicePixelRatio || 1,
          camera.zoom,
        );
        const tileSize = tile.size * pixelScale;
        const sortedGlowIds = new Set(
          [...routes]
            .sort((left, right) => right.count - left.count)
            .slice(0, NEON_AVIATION.glow.maxGlowingRoutes)
            .map((route) => route.id),
        );
        const airportPoints = NEON_AIRPORTS.map((airport) => {
          const projected = centerProjection([
            airport.longitude,
            airport.latitude,
          ]);
          return {
            airport,
            point: projected
              ? { x: projected[0], y: projected[1] }
              : { x: 0, y: 0 },
          };
        });
        const selectedRouteData = routes.find(
          (route) => route.id === activeSelectedRoute,
        );
        const labelCandidates = airportPoints.filter(
          ({ airport }) =>
            hubs.has(airport.iata) ||
            selectedAirport === airport.iata ||
            selectedRouteData?.origin.iata === airport.iata ||
            selectedRouteData?.destination.iata === airport.iata,
        );
        const requiredLabels = new Set(
          [
            selectedAirport,
            selectedRouteData?.origin.iata,
            selectedRouteData?.destination.iata,
          ].filter((iata): iata is string => Boolean(iata)),
        );
        const labelPositions = airportLabelPositions(
          labelCandidates.map(({ airport, point }) => ({
            iata: airport.iata,
            point,
            flightCount: routes.reduce(
              (total, route) =>
                total +
                (route.origin.iata === airport.iata ||
                route.destination.iata === airport.iata
                  ? route.count
                  : 0),
              0,
            ),
          })),
          camera,
          viewportHeight,
          requiredLabels,
          pixelScale,
        );

        return (
          <g className="neon-world-scene" data-neon-world-ready="true">
            <defs>
              <linearGradient
                id={`neon-background-${generatedId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor="var(--neon-background-top)" />
                <stop offset="1" stopColor="var(--neon-background-bottom)" />
              </linearGradient>
              <pattern
                id={patternId}
                width={tileSize}
                height={tileSize}
                patternUnits="userSpaceOnUse"
                patternTransform={`rotate(${tile.angle}) scale(${1 / camera.zoom})`}
              >
                <path
                  d={`M 0 0 L 0 ${tileSize}`}
                  fill="none"
                  stroke="var(--neon-land-hatch)"
                  strokeWidth={tile.lineWidth * pixelScale}
                />
              </pattern>
              <clipPath id={landClipId} clipPathUnits="userSpaceOnUse">
                <path d={paths.land} />
              </clipPath>
              <radialGradient id={haloId}>
                <stop
                  offset="0"
                  stopColor="var(--neon-airport-halo)"
                  stopOpacity="0.45"
                />
                <stop
                  offset="1"
                  stopColor="var(--neon-airport-halo)"
                  stopOpacity="0"
                />
              </radialGradient>
            </defs>
            <rect
              className="neon-map-background"
              x="0"
              y="0"
              width="960"
              height={viewportHeight}
              fill={`url(#neon-background-${generatedId})`}
            />
            <path className="neon-map-sphere" d={paths.sphere} />
            <path
              className="neon-map-graticule"
              d={pathsGraticule(routeCenter)}
            />
            <path className="neon-map-land" d={paths.land} />
            <rect
              className="neon-map-hatch"
              x="0"
              y="0"
              width="960"
              height="480"
              fill={`url(#${patternId})`}
              clipPath={`url(#${landClipId})`}
            />
            <path
              className="neon-map-borders"
              d={paths.countries.map((country) => country.path).join("")}
            />
            <path className="neon-map-coastline" d={paths.land} />
            <g className="neon-routes">
              {routeLines.map((route, index) => {
                const forced = forcedState && index === 0 ? forcedState : null;
                const state: NeonRouteState =
                  selectedRoute === route.id
                    ? "selected"
                    : forced === "selected"
                      ? "selected"
                      : hoveredRoute === route.id || forced === "hover"
                        ? "hover"
                        : activeSelectedRoute
                          ? "dimmed"
                          : "normal";
                const tier = routeTier(route.count, maxCount);
                const stroke = routeStroke(tier, state);
                const showGlow =
                  stroke.glow ||
                  (sortedGlowIds.has(route.id) && !activeSelectedRoute);
                const routeStyle = {
                  "--neon-route-current-width": `${stroke.width}px`,
                  "--neon-route-current-opacity": stroke.opacity,
                  "--neon-route-glow-width": `${stroke.width + NEON_AVIATION.glow.spread * 2}px`,
                  "--neon-route-inner-width": `${stroke.width + NEON_AVIATION.glow.innerSpread * 2}px`,
                } as CSSProperties;
                return (
                  <g
                    key={route.id}
                    className={`neon-route neon-route--${tier}${stateClass(state)}`}
                    data-route-id={route.id}
                    data-state={state}
                    role="button"
                    tabIndex={0}
                    aria-label={`${route.origin.iata} to ${route.destination.iata}, ${route.count} sample flights`}
                    style={routeStyle}
                    onPointerEnter={() => setHoveredRoute(route.id)}
                    onPointerLeave={() => setHoveredRoute(null)}
                    onFocus={() => setHoveredRoute(route.id)}
                    onBlur={() => setHoveredRoute(null)}
                    onClick={() => setSelectedRoute(route.id)}
                    onKeyDown={(event) =>
                      activateOnEnter(event, () => setSelectedRoute(route.id))
                    }
                  >
                    {showGlow && (
                      <path
                        className="neon-route-glow"
                        d={route.path}
                        aria-hidden="true"
                      />
                    )}
                    {stroke.innerGlow && (
                      <path
                        className="neon-route-inner-glow"
                        d={route.path}
                        aria-hidden="true"
                      />
                    )}
                    <path className="neon-route-line" d={route.path} />
                    <path className="neon-route-hit" d={route.path} />
                  </g>
                );
              })}
            </g>
            <g className="neon-airports">
              {airportPoints.map(({ airport, point }) => {
                const isSelected =
                  selectedAirport === airport.iata ||
                  selectedRouteData?.origin.iata === airport.iata ||
                  selectedRouteData?.destination.iata === airport.iata;
                const isHovered = hoveredAirport === airport.iata;
                const kind = isSelected
                  ? "selected"
                  : hubs.has(airport.iata)
                    ? "hub"
                    : "base";
                const state: NeonRouteState = isSelected
                  ? "selected"
                  : isHovered
                    ? "hover"
                    : activeSelectedRoute
                      ? "dimmed"
                      : "normal";
                const style = airportStyle(kind, state);
                const hoverScale =
                  state === "hover" ? NEON_AVIATION.state.hoverScale : 1;
                const label = labelPositions.get(airport.iata);
                return (
                  <g
                    key={airport.iata}
                    className={`neon-airport neon-airport--${kind}${style.focus ? " is-focused" : ""}`}
                    data-airport-code={airport.iata}
                    data-state={state}
                    role="button"
                    tabIndex={0}
                    aria-label={`${airport.iata}, ${airport.city}`}
                    onPointerEnter={() => setHoveredAirport(airport.iata)}
                    onPointerLeave={() => setHoveredAirport(null)}
                    onFocus={() => setHoveredAirport(airport.iata)}
                    onBlur={() => setHoveredAirport(null)}
                    onClick={() => setSelectedAirport(airport.iata)}
                    onKeyDown={(event) =>
                      activateOnEnter(event, () =>
                        setSelectedAirport(airport.iata),
                      )
                    }
                    style={
                      {
                        "--neon-airport-opacity": style.opacity,
                      } as CSSProperties
                    }
                  >
                    <g
                      className="neon-airport-marker"
                      transform={`translate(${point.x} ${point.y}) scale(${pixelScale / camera.zoom})`}
                    >
                      <circle
                        className="neon-airport-halo"
                        cx="0"
                        cy="0"
                        r={style.halo * hoverScale}
                        fill={`url(#${haloId})`}
                      />
                      {style.focus && (
                        <circle
                          className="neon-airport-focus"
                          cx="0"
                          cy="0"
                          r={
                            style.radius * hoverScale +
                            style.stroke +
                            NEON_AVIATION.state.focusRingOffset
                          }
                        />
                      )}
                      <circle
                        className="neon-airport-point"
                        cx="0"
                        cy="0"
                        r={style.radius * hoverScale}
                        strokeWidth={style.stroke}
                      />
                      {label && (
                        <text
                          className={`neon-airport-label${kind === "selected" ? " is-selected" : ""}`}
                          x={label.x}
                          y={label.y}
                          textAnchor={label.anchor}
                        >
                          {airport.iata}
                        </text>
                      )}
                    </g>
                  </g>
                );
              })}
            </g>
          </g>
        );
      }}
    </MapViewport>
  );
}

function stateClass(state: NeonRouteState) {
  if (state === "hover") return " is-hovered";
  if (state === "selected") return " is-selected";
  if (state === "dimmed") return " is-dimmed";
  return "";
}

function activateOnEnter(
  event: KeyboardEvent<SVGGElement>,
  activate: () => void,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activate();
}

function pathsGraticule(centerLongitude: number) {
  const projection = projectionAt(centerLongitude);
  const graticule = {
    type: "MultiLineString" as const,
    coordinates: [
      ...Array.from({ length: 13 }, (_, index) => {
        const longitude = -180 + index * 30;
        return Array.from({ length: 19 }, (_, step): [number, number] => [
          longitude,
          -90 + step * 10,
        ]);
      }),
      ...Array.from({ length: 7 }, (_, index) => {
        const latitude = -60 + index * 20;
        return Array.from({ length: 37 }, (_, step): [number, number] => [
          -180 + step * 10,
          latitude,
        ]);
      }),
    ] as [number, number][][],
  };
  return geoPath(projection).digits(1)(graticule) ?? "";
}
