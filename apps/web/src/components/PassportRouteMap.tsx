import { normalizeLanguage } from "../locales/registry";
import {
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  arrivalIdentity,
  buildUncertainAirportMarkers,
  distanceKilometers,
  localizedText,
  airportSelectionTarget,
  airportTargetMatches,
  originIdentity,
  routeIdentityKey,
  routeSelectionTarget,
  routeTargetMatches,
  type AirportSelectionTarget,
  type FlightEndpointIdentity,
  type RouteSelectionTarget,
  type SupportedLocale,
  type RoutePoint,
  type RouteSegment,
} from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  greatCircleMidpoint,
  greatCirclePath,
  projectPoint,
  WORLD_WIDTH,
  regionalCenterLongitude,
} from "../data/map-geometry";
import { passportMapCamera, type MapCamera } from "../data/map-camera";
import { airportLabelPositions } from "../data/map-labels";
import { routeVisuals } from "../data/map-route-visuals";
import { MapViewport } from "./MapViewport";
import { MapWorld } from "./MapWorld";
import { useAirportHistoryVersion } from "../data/airport-history";

interface PassportRouteMapProps {
  routes: RouteSegment[];
  flights: KeeprawFlight[];
  /** Selected airport by flight-date physical identity (code for display). */
  selectedAirport?: Omit<AirportSelectionTarget, "kind">;
  /** Selected directed route between two physical identities. */
  selectedRoute?: Omit<RouteSelectionTarget, "kind">;
  /** `routeIdentityKey` of the hovered or focused flight's route. */
  highlightedRoute?: string;
  onSelectAirport: (target: AirportSelectionTarget) => void;
  onSelectRoute: (target: RouteSelectionTarget) => void;
}

interface AirportMapPoint extends RoutePoint {
  identityKey: string;
  name: string;
  city: string;
  /** Formal flight-date assignment, or current-directory evidence only. */
  basis: FlightEndpointIdentity["basis"];
  historicalAssignmentVerified: boolean;
  flightCount: number;
  firstYear: string;
  lastYear: string;
}

interface MapTooltipData {
  key: string;
  x: number;
  y: number;
  title: string;
  detail: string;
  meta: string;
}

export function PassportRouteMap({
  routes,
  flights,
  selectedAirport,
  selectedRoute,
  highlightedRoute,
  onSelectAirport,
  onSelectRoute,
}: PassportRouteMapProps) {
  const { t, i18n } = useTranslation();
  const locale = normalizeLanguage(i18n.resolvedLanguage);
  const [activeTooltipKey, setActiveTooltipKey] = useState<string>();
  const historyVersion = useAirportHistoryVersion();
  const countryVisits = useMemo(
    () => collectCountryVisits(flights),
    [flights, historyVersion],
  );
  const airports = useMemo(
    () => collectAirports(flights, locale),
    [flights, locale, historyVersion],
  );
  // Undetermined endpoints are never drawn as airports or route ends; their
  // possible sites appear only as clearly marked, non-interactive hints.
  const possibleAirports = useMemo(
    () => buildUncertainAirportMarkers(flights),
    [flights, historyVersion],
  );
  const centerLongitude = useMemo(
    () => regionalCenterLongitude(airports),
    [airports],
  );
  const initialCamera = useMemo(
    () => passportMapCamera(routes, airports),
    [airports, routes],
  );
  const routeYears = useMemo(
    () => collectRouteYears(flights),
    [flights, historyVersion],
  );
  const regionNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: "region" }),
    [locale],
  );
  const routeItems = useMemo(
    () =>
      [...routes]
        .sort((a, b) => a.flightCount - b.flightCount)
        .map((route, index) => {
          // Physical identities keep two sites that shared a code apart.
          const identity = routeIdentityKey(route);
          const key = `route:${identity}`;
          const years = routeYears.get(identity);
          const midpoint = greatCircleMidpoint(
            route.origin,
            route.destination,
            centerLongitude,
          );
          const distance = Math.round(
            distanceKilometers(route.origin, route.destination),
          );
          const visuals = routeVisuals(route.flightCount);
          const label = t("passport.mapRouteData", {
            origin: route.origin.iata,
            destination: route.destination.iata,
            count: route.flightCount,
            first: years?.firstYear,
            last: years?.lastYear,
          });
          return {
            ...route,
            key,
            identity,
            label,
            path: greatCirclePath(
              route.origin,
              route.destination,
              40,
              centerLongitude,
            ),
            tooltip: {
              key,
              x: midpoint.x,
              y: midpoint.y,
              title: `${route.origin.iata} → ${route.destination.iata}`,
              detail: t("passport.mapRouteDistance", {
                distance: distance.toLocaleString(locale),
              }),
              meta: t("passport.flightFrequency", { count: route.flightCount }),
            } satisfies MapTooltipData,
            style: {
              "--map-item-index": index,
              "--map-route-opacity": 1,
              "--map-route-strength": `${visuals.strength}%`,
              "--map-route-width": `${visuals.width}px`,
            } as CSSProperties,
          };
        }),
    [locale, routeYears, routes, t, centerLongitude],
  );
  const airportItems = useMemo(
    () =>
      airports.map((airport, index) => {
        const key = `airport:${airport.identityKey}`;
        const point = projectPoint(airport, centerLongitude);
        const label = t("passport.mapAirportData", {
          airport: airport.iata,
          count: airport.flightCount,
          first: airport.firstYear,
          last: airport.lastYear,
        });
        return {
          ...airport,
          key,
          label,
          point,
          radius:
            2.15 + Math.min(Math.log2(airport.flightCount + 1) * 0.42, 1.25),
          tooltip: {
            key,
            x: point.x,
            y: point.y,
            title: compactAirportName(airport.name),
            detail: `${airport.iata} · ${t("passport.visitFrequency", { count: airport.flightCount })}`,
            meta: [
              airport.city,
              t(
                airport.historicalAssignmentVerified
                  ? "passport.mapAirportVerified"
                  : "passport.mapAirportCurrentDirectory",
              ),
            ]
              .filter(Boolean)
              .join(" · "),
          } satisfies MapTooltipData,
          style: { "--map-item-index": index } as CSSProperties,
        };
      }),
    [airports, t, centerLongitude],
  );
  const tooltipItems = useMemo(
    () =>
      new Map(
        [...routeItems, ...airportItems].map((item) => [
          item.key,
          item.tooltip,
        ]),
      ),
    [airportItems, routeItems],
  );
  const selectedTooltipKey = selectedAirport
    ? airportItems.find((airport) =>
        airportTargetMatches(selectedAirport, airport),
      )?.key
    : selectedRoute
      ? routeItems.find((route) => routeTargetMatches(selectedRoute, route))
          ?.key
      : undefined;
  const isSelectedRoute = (route: (typeof routeItems)[number]) =>
    Boolean(selectedRoute && routeTargetMatches(selectedRoute, route));
  const isHighlightedRoute = (route: (typeof routeItems)[number]) =>
    highlightedRoute === route.identity;
  const tooltip = tooltipItems.get(
    activeTooltipKey ?? selectedTooltipKey ?? "",
  );
  const totalFlights = routes.reduce(
    (sum, route) => sum + route.flightCount,
    0,
  );
  const emphasis = (route: (typeof routeItems)[number]) =>
    Number(isHighlightedRoute(route) || isSelectedRoute(route));
  // Opposite-direction routes share a great-circle path. Draw the active route
  // last so its selection color cannot be covered by the return flight.
  const displayedRoutes = [...routeItems].sort(
    (a, b) => emphasis(a) - emphasis(b),
  );

  return (
    <section className="route-map" id="passport-visual">
      <MapViewport
        className="route-map-canvas"
        ariaLabel={t("passport.mapPreviewLabel", { flights: totalFlights })}
        initialCamera={initialCamera}
        cameraForViewport={(height, pixelScale) =>
          passportMapCamera(routes, airports, height, 40 * pixelScale)
        }
        maxZoom={8}
        minZoom={0.3}
        labels={{
          zoomIn: t("mapControls.zoomIn"),
          zoomOut: t("mapControls.zoomOut"),
          reset: t("mapControls.reset"),
        }}
      >
        {(camera, height, pixelScale) => {
          // Physical identities whose markers and labels must stay visible.
          const required = new Set(
            airportItems
              .filter(
                (airport) =>
                  (selectedAirport &&
                    airportTargetMatches(selectedAirport, airport)) ||
                  routeItems.some(
                    (route) =>
                      (isSelectedRoute(route) || isHighlightedRoute(route)) &&
                      (route.origin.identityKey === airport.identityKey ||
                        route.destination.identityKey === airport.identityKey),
                  ),
              )
              .map((airport) => airport.identityKey),
          );
          const labelPositions = airportLabelPositions(
            airportItems.map((airport) => ({
              ...airport,
              key: airport.identityKey,
            })),
            camera,
            height,
            required,
            pixelScale,
          );
          return (
            <>
              <MapWorld
                appearance="aviation"
                centerLongitude={centerLongitude}
                countryVisits={countryVisits}
                showOutline={camera.zoom <= 1.05}
                countryName={(code, fallback) =>
                  code.length === 2
                    ? (regionNames.of(code) ?? fallback)
                    : fallback
                }
                countryLabel={(name, visited) =>
                  t(
                    visited
                      ? "passport.mapCountryVisited"
                      : "passport.mapCountryUnvisited",
                    { country: name },
                  )
                }
              />
              <g
                className={
                  highlightedRoute ? "map-routes has-highlight" : "map-routes"
                }
              >
                {displayedRoutes.map((route) => {
                  const selected = isSelectedRoute(route);
                  const highlighted = isHighlightedRoute(route);
                  return (
                    <g
                      key={route.key}
                      className={[
                        "map-route",
                        selected ? "is-selected" : "",
                        highlighted ? "is-highlighted" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={route.style}
                      role="button"
                      tabIndex={0}
                      aria-label={route.label}
                      aria-pressed={selected || highlighted}
                      onPointerEnter={() => setActiveTooltipKey(route.key)}
                      onPointerLeave={() => setActiveTooltipKey(undefined)}
                      onFocus={() => setActiveTooltipKey(route.key)}
                      onBlur={() => setActiveTooltipKey(undefined)}
                      data-route-identity={route.identity}
                      onClick={() => onSelectRoute(routeSelectionTarget(route))}
                      onKeyDown={(event) =>
                        activateMapItem(event, () =>
                          onSelectRoute(routeSelectionTarget(route)),
                        )
                      }
                    >
                      <path className="map-route-hit" d={route.path} />
                      <path className="map-route-underlay" d={route.path} />
                      <path
                        className="map-route-line"
                        d={route.path}
                        pathLength={1}
                      />
                      <title>{route.label}</title>
                    </g>
                  );
                })}
              </g>
              <g className="map-airports">
                {airportItems.map((airport) => {
                  const selected = required.has(airport.identityKey);
                  const label = labelPositions.get(airport.identityKey);
                  return (
                    <g
                      key={airport.key}
                      data-airport-identity={airport.identityKey}
                      data-airport-basis={
                        airport.historicalAssignmentVerified
                          ? "historical"
                          : "current-directory"
                      }
                      className={
                        selected ? "map-airport is-selected" : "map-airport"
                      }
                      transform={`translate(${airport.point.x} ${airport.point.y})`}
                      role="button"
                      tabIndex={0}
                      aria-label={airport.label}
                      aria-pressed={selected}
                      onPointerEnter={() => setActiveTooltipKey(airport.key)}
                      onPointerLeave={() => setActiveTooltipKey(undefined)}
                      onFocus={() => setActiveTooltipKey(airport.key)}
                      onBlur={() => setActiveTooltipKey(undefined)}
                      onClick={() =>
                        onSelectAirport(airportSelectionTarget(airport))
                      }
                      onKeyDown={(event) =>
                        activateMapItem(event, () =>
                          onSelectAirport(airportSelectionTarget(airport)),
                        )
                      }
                    >
                      <g transform={`scale(${pixelScale / camera.zoom})`}>
                        <circle className="map-airport-hit" r="14" />
                        <circle
                          className="map-airport-ring"
                          r={airport.radius + 3.6}
                        />
                        <circle
                          className="map-airport-point"
                          r={airport.radius}
                          style={airport.style}
                        />
                        <title>{airport.label}</title>
                        {label ? (
                          <text
                            className="map-airport-label"
                            x={label.x}
                            y={label.y}
                            textAnchor={label.anchor}
                          >
                            {airport.iata}
                          </text>
                        ) : null}
                      </g>
                    </g>
                  );
                })}
              </g>
              {possibleAirports.length ? (
                <g
                  className="map-possible-airports"
                  aria-label={t("passport.mapPossibleAirports")}
                >
                  {possibleAirports.map((marker) => {
                    const point = projectPoint(marker, centerLongitude);
                    const label = t("passport.mapPossibleAirport", {
                      airport: marker.iata,
                      name: marker.name ?? marker.iata,
                    });
                    return (
                      <g
                        key={`${marker.iata}|${marker.siteId}`}
                        className="map-possible-airport"
                        data-possible-airport={marker.iata}
                        data-source={marker.source}
                        transform={`translate(${point.x} ${point.y})`}
                      >
                        <g transform={`scale(${pixelScale / camera.zoom})`}>
                          <circle
                            className="map-possible-airport-ring"
                            r="3.4"
                          />
                          <title>{label}</title>
                        </g>
                      </g>
                    );
                  })}
                </g>
              ) : null}
              {tooltip ? (
                <MapTooltip
                  tooltip={tooltip}
                  camera={camera}
                  height={height}
                  pixelScale={pixelScale}
                />
              ) : null}
            </>
          );
        }}
      </MapViewport>
      <div
        className="passport-map-frequency-legend"
        role="group"
        aria-label={t("passport.mapRouteFrequencyHint")}
      >
        <span>{t("passport.mapRouteFrequency")}</span>
        {[1, 4, 8].map((count) => {
          const visuals = routeVisuals(count);
          return (
            <span className="passport-map-frequency-sample" key={count}>
              <svg
                width="24"
                height="10"
                viewBox="0 0 24 10"
                aria-hidden="true"
                style={
                  {
                    "--map-route-width": `${visuals.width}px`,
                    "--map-route-strength": `${visuals.strength}%`,
                  } as CSSProperties
                }
              >
                <line x1="3" x2="21" y1="5" y2="5" />
              </svg>
              {count}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function MapTooltip({
  tooltip,
  camera,
  height: viewportHeight,
  pixelScale,
}: {
  tooltip: MapTooltipData;
  camera: MapCamera;
  height: number;
  pixelScale: number;
}) {
  const width = 176;
  const height = 58;
  const screenX = (tooltip.x - camera.centerX) * camera.zoom + WORLD_WIDTH / 2;
  const screenY =
    (tooltip.y - camera.centerY) * camera.zoom + viewportHeight / 2;
  const offsetX =
    screenX + (width + 24) * pixelScale > WORLD_WIDTH ? -width - 12 : 12;
  const offsetY =
    screenY + (height + 20) * pixelScale > viewportHeight ? -height - 12 : 12;
  return (
    <g
      className="map-tooltip"
      transform={`translate(${tooltip.x} ${tooltip.y}) scale(${pixelScale / camera.zoom})`}
      aria-hidden="true"
    >
      <g transform={`translate(${offsetX} ${offsetY})`}>
        <rect width={width} height={height} rx="5" />
        <text x="12" y="18">
          <tspan className="map-tooltip-title">{tooltip.title}</tspan>
          <tspan className="map-tooltip-detail" x="12" dy="16">
            {tooltip.detail}
          </tspan>
          <tspan className="map-tooltip-meta" x="12" dy="15">
            {tooltip.meta}
          </tspan>
        </text>
      </g>
    </g>
  );
}

function collectAirports(
  flights: KeeprawFlight[],
  locale: SupportedLocale,
): AirportMapPoint[] {
  const points = new Map<string, AirportMapPoint>();
  for (const flight of flights) {
    if (flight.cancelled) continue;
    const year = flight.serviceDate.slice(0, 4);
    for (const identity of [originIdentity(flight), arrivalIdentity(flight)]) {
      // Only formal or explicit current-directory sites are drawn as airports.
      if (!identity.confirmed || !identity.point) continue;
      const existing = points.get(identity.identityKey);
      if (existing) {
        existing.flightCount += 1;
        if (year < existing.firstYear) existing.firstYear = year;
        if (year > existing.lastYear) existing.lastYear = year;
      } else {
        points.set(identity.identityKey, {
          iata: identity.iata,
          identityKey: identity.identityKey,
          latitude: identity.point.latitude,
          longitude: identity.point.longitude,
          name: identity.name
            ? localizedText(identity.name, locale)
            : identity.iata,
          city: identity.city ? localizedText(identity.city, locale) : "",
          basis: identity.basis,
          historicalAssignmentVerified: identity.historicalAssignmentVerified,
          flightCount: 1,
          firstYear: year,
          lastYear: year,
        });
      }
    }
  }
  return [...points.values()];
}

function collectCountryVisits(flights: KeeprawFlight[]) {
  const visits = new Map<string, number>();
  for (const flight of flights) {
    if (flight.cancelled) continue;
    for (const identity of [originIdentity(flight), arrivalIdentity(flight)]) {
      if (identity.confirmed && identity.country)
        visits.set(identity.country, (visits.get(identity.country) ?? 0) + 1);
    }
  }
  return visits;
}

function collectRouteYears(flights: KeeprawFlight[]) {
  const years = new Map<string, { firstYear: string; lastYear: string }>();
  for (const flight of flights) {
    if (flight.cancelled) continue;
    // Group by the flight-date physical route, never by its code pair.
    updateYearRange(
      years,
      routeIdentityKey({
        origin: originIdentity(flight),
        destination: arrivalIdentity(flight),
      }),
      flight.serviceDate.slice(0, 4),
    );
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

function compactAirportName(name: string): string {
  const compact = name
    .replace(/ International Airport$/i, "")
    .replace(/ Airport$/i, "")
    .replace(/国际机场$/, "机场");
  return compact.length > 29 ? `${compact.slice(0, 28)}…` : compact;
}

function activateMapItem(
  event: KeyboardEvent<SVGGElement>,
  activate: () => void,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activate();
}
