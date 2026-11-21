import { geoPath } from "d3-geo";
import { useId, useMemo, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { routePointIdentityKey } from "@keepraw-fly/core";
import { MapViewport } from "../components/MapViewport";
import {
  projectionAt,
  regionalCenterLongitude,
  regionalWorldPaths,
  WORLD_WIDTH,
} from "../data/map-geometry";
import { type MapCamera, WORLD_CAMERA } from "../data/map-camera";
import { buildMapScene } from "../map2d/scene";
import { segmentsToPath } from "../map2d/svg-path";
import { mapThemeCssVariables } from "../map2d/theme-css";
import { resolveMapTheme } from "../map2d/theme-registry";
import {
  airportStyle,
  hatchTile,
  routeStroke,
  routeTier,
  type MapRouteState,
} from "../map2d/theme-style";
import {
  DENSE_ROUTES,
  NEON_AIRPORTS,
  SPARSE_ROUTES,
  type NeonAirport,
} from "./sample-network";

const theme = resolveMapTheme("neon-aviation");
const NEON_MAP_CENTER_LONGITUDE = regionalCenterLongitude(
  NEON_AIRPORTS.map(({ latitude, longitude }) => ({ latitude, longitude })),
);
const airportMetadata = new Map(
  NEON_AIRPORTS.map((airport) => [routePointIdentityKey(airport), airport]),
);

export interface NeonWorldMapProps {
  density?: "sparse" | "dense";
  forcedState?: "normal" | "hover" | "selected";
}

export function NeonWorldMap({
  density = "sparse",
  forcedState,
}: NeonWorldMapProps) {
  const { tokens } = theme;
  const routes = density === "dense" ? DENSE_ROUTES : SPARSE_ROUTES;
  const scene = useMemo(
    () =>
      buildMapScene({
        routes: routes.map((route) => ({
          origin: route.origin,
          destination: route.destination,
          flightCount: route.count,
        })),
        centerLongitude: NEON_MAP_CENTER_LONGITUDE,
      }),
    [routes],
  );
  const maxCount = scene.routes.at(-1)?.flightCount ?? 0;
  const routeCenter = scene.centerLongitude;
  const paths = useMemo(() => regionalWorldPaths(routeCenter), [routeCenter]);
  const routeLines = useMemo(
    () =>
      scene.routes.map((route) => ({
        ...route,
        path: segmentsToPath(route.segments),
      })),
    [scene],
  );
  const routeIds = new Set(routeLines.map((route) => route.key));
  const airportIds = new Set(
    scene.airports.map((airport) => airport.identityKey),
  );
  const [hoveredRoute, setHoveredRoute] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [hoveredAirport, setHoveredAirport] = useState<string | null>(null);
  const [selectedAirport, setSelectedAirport] = useState<string | null>(null);
  const forcedSelectedRoute =
    forcedState === "selected" ? (routeLines[0]?.key ?? null) : null;
  const activeSelectedRoute =
    selectedRoute && routeIds.has(selectedRoute)
      ? selectedRoute
      : forcedSelectedRoute;
  const activeHoveredRoute =
    hoveredRoute && routeIds.has(hoveredRoute) ? hoveredRoute : null;
  const activeSelectedAirport =
    selectedAirport && airportIds.has(selectedAirport) ? selectedAirport : null;
  const activeHoveredAirport =
    hoveredAirport && airportIds.has(hoveredAirport) ? hoveredAirport : null;
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
          tokens.hatch,
          window.devicePixelRatio || 1,
          camera.zoom,
        );
        const tileSize = tile.size * pixelScale;
        const sortedGlowIds = new Set(
          scene.routes
            .slice(-tokens.glow.maxGlowingRoutes)
            .map((route) => route.key),
        );
        const airportPoints = scene.airports.flatMap((sceneAirport) => {
          const airport = airportMetadata.get(sceneAirport.identityKey);
          return airport
            ? [
                {
                  airport,
                  identityKey: sceneAirport.identityKey,
                  flightCount: sceneAirport.flightCount,
                  hub: sceneAirport.hub,
                  point: { x: sceneAirport.x, y: sceneAirport.y },
                },
              ]
            : [];
        });
        const activeSelectedRouteData = routeLines.find(
          (route) => route.key === activeSelectedRoute,
        );
        const labelCandidates = airportPoints.flatMap(
          ({ identityKey, point, flightCount, hub }) => {
            const isSelected =
              activeSelectedAirport === identityKey ||
              (activeSelectedRouteData !== undefined &&
                (routePointIdentityKey(activeSelectedRouteData.origin) ===
                  identityKey ||
                  routePointIdentityKey(activeSelectedRouteData.destination) ===
                    identityKey));
            if (!hub && !isSelected) return [];
            const style = airportStyle(
              tokens,
              isSelected ? "selected" : "hub",
              isSelected ? "selected" : "normal",
            );
            return [
              {
                identityKey,
                point,
                flightCount,
                isSelected,
                radius: style.radius,
                halo: style.halo,
              },
            ];
          },
        );
        const labelPositions = neonAirportLabelPositions(
          labelCandidates,
          camera,
          viewportHeight,
          pixelScale,
          tokens.type.size.mapLabel,
          tokens.type.size.mapLabelSelected,
        );

        return (
          <g
            className="neon-world-scene"
            data-neon-world-ready="true"
            style={mapThemeCssVariables(theme)}
          >
            <defs>
              <linearGradient
                id={`neon-background-${generatedId}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor="var(--map-theme-background-top)" />
                <stop
                  offset="1"
                  stopColor="var(--map-theme-background-bottom)"
                />
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
                  stroke="var(--map-theme-land-hatch)"
                  strokeWidth={tile.lineWidth * pixelScale}
                />
              </pattern>
              <clipPath id={landClipId} clipPathUnits="userSpaceOnUse">
                <path d={paths.land} />
              </clipPath>
              <radialGradient id={haloId}>
                <stop
                  offset="0"
                  stopColor="var(--map-theme-airport-halo)"
                  stopOpacity="0.45"
                />
                <stop
                  offset="1"
                  stopColor="var(--map-theme-airport-halo)"
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
                const state: MapRouteState =
                  activeSelectedRoute === route.key
                    ? "selected"
                    : forced === "selected"
                      ? "selected"
                      : activeHoveredRoute === route.key || forced === "hover"
                        ? "hover"
                        : activeSelectedRoute
                          ? "dimmed"
                          : "normal";
                const tier = routeTier(route.flightCount, maxCount);
                const stroke = routeStroke(tokens, tier, state);
                const showGlow =
                  stroke.glow ||
                  (sortedGlowIds.has(route.key) && !activeSelectedRoute);
                const routeStyle = {
                  "--map-theme-route-current-width": `${stroke.width}px`,
                  "--map-theme-route-current-opacity": stroke.opacity,
                  "--map-theme-route-glow-width": `${stroke.width + tokens.glow.spread * 2}px`,
                  "--map-theme-route-inner-width": `${stroke.width + tokens.glow.innerSpread * 2}px`,
                } as CSSProperties;
                return (
                  <g
                    key={route.key}
                    className={`neon-route neon-route--${tier}${stateClass(state)}`}
                    data-route-id={route.key}
                    data-state={state}
                    role="button"
                    tabIndex={0}
                    aria-label={`${route.origin.iata} to ${route.destination.iata}, ${route.flightCount} sample flights`}
                    style={routeStyle}
                    onPointerEnter={() => setHoveredRoute(route.key)}
                    onPointerLeave={() => setHoveredRoute(null)}
                    onFocus={() => setHoveredRoute(route.key)}
                    onBlur={() => setHoveredRoute(null)}
                    onClick={() => setSelectedRoute(route.key)}
                    onKeyDown={(event) =>
                      activateOnEnter(event, () => setSelectedRoute(route.key))
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
              {airportPoints.map(({ airport, identityKey, point, hub }) => {
                const isSelected =
                  activeSelectedAirport === identityKey ||
                  (activeSelectedRouteData !== undefined &&
                    (routePointIdentityKey(activeSelectedRouteData.origin) ===
                      identityKey ||
                      routePointIdentityKey(
                        activeSelectedRouteData.destination,
                      ) === identityKey));
                const isHovered = activeHoveredAirport === identityKey;
                const kind = isSelected ? "selected" : hub ? "hub" : "base";
                const state: MapRouteState = isSelected
                  ? "selected"
                  : isHovered
                    ? "hover"
                    : activeSelectedRoute
                      ? "dimmed"
                      : "normal";
                const style = airportStyle(tokens, kind, state);
                const hoverScale =
                  state === "hover" ? tokens.state.hoverScale : 1;
                const label = labelPositions.get(identityKey);
                return (
                  <g
                    key={identityKey}
                    className={`neon-airport neon-airport--${kind}${style.focus ? " is-focused" : ""}`}
                    data-airport-code={airport.iata}
                    data-airport-identity={identityKey}
                    data-state={state}
                    role="button"
                    tabIndex={0}
                    aria-label={`${airport.iata}, ${airport.city}`}
                    onPointerEnter={() => setHoveredAirport(identityKey)}
                    onPointerLeave={() => setHoveredAirport(null)}
                    onFocus={() => setHoveredAirport(identityKey)}
                    onBlur={() => setHoveredAirport(null)}
                    onClick={() => setSelectedAirport(identityKey)}
                    onKeyDown={(event) =>
                      activateOnEnter(event, () =>
                        setSelectedAirport(identityKey),
                      )
                    }
                    style={
                      {
                        "--map-theme-airport-opacity": style.opacity,
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
                            tokens.state.focusRingOffset
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

function stateClass(state: MapRouteState) {
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

function neonAirportLabelPositions(
  candidates: Array<{
    identityKey: string;
    point: { x: number; y: number };
    flightCount: number;
    isSelected: boolean;
    radius: number;
    halo: number;
  }>,
  camera: MapCamera,
  height: number,
  pixelScale: number,
  mapLabelFontSize: number,
  selectedLabelFontSize: number,
) {
  const placed: Array<{
    left: number;
    top: number;
    right: number;
    bottom: number;
  }> = [];
  const labels = new Map<
    string,
    { x: number; y: number; anchor: "start" | "end" | "middle" }
  >();
  const ordered = [...candidates].sort(
    (left, right) =>
      Number(right.isSelected) - Number(left.isSelected) ||
      right.flightCount - left.flightCount ||
      left.identityKey.localeCompare(right.identityKey),
  );

  for (const candidate of ordered) {
    const fontSize = candidate.isSelected
      ? selectedLabelFontSize
      : mapLabelFontSize;
    const gap = Math.max(candidate.radius, candidate.halo) + 4;
    const width = Math.max(30, fontSize * 2.8);
    const textHeight = fontSize * 1.4;
    const centerX =
      (candidate.point.x - camera.centerX) * camera.zoom + WORLD_WIDTH / 2;
    const centerY =
      (candidate.point.y - camera.centerY) * camera.zoom + height / 2;
    const offsets: Array<{
      x: number;
      y: number;
      anchor: "start" | "end" | "middle";
    }> = [
      { x: gap, y: fontSize * 0.35, anchor: "start" },
      { x: -gap, y: fontSize * 0.35, anchor: "end" },
      { x: 0, y: -gap, anchor: "middle" },
      { x: 0, y: gap + fontSize, anchor: "middle" },
    ];

    for (const offset of offsets) {
      const x = centerX + offset.x * pixelScale;
      const y = centerY + offset.y * pixelScale;
      const left =
        x -
        (offset.anchor === "start"
          ? 0
          : offset.anchor === "end"
            ? width * pixelScale
            : (width * pixelScale) / 2);
      const top = y - fontSize * pixelScale * 0.9;
      const box = {
        left,
        top,
        right: left + width * pixelScale,
        bottom: top + textHeight * pixelScale,
      };
      const inBounds =
        box.left >= 3 &&
        box.right <= WORLD_WIDTH - 3 &&
        box.top >= 3 &&
        box.bottom <= height - 3;
      const overlaps = placed.some(
        (other) =>
          box.left < other.right &&
          box.right > other.left &&
          box.top < other.bottom &&
          box.bottom > other.top,
      );
      if (!inBounds || overlaps) continue;
      labels.set(candidate.identityKey, offset);
      placed.push(box);
      break;
    }
  }
  return labels;
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
