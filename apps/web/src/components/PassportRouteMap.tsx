import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  airportByIata,
  distanceKilometers,
  localizedText,
  type SupportedLocale,
  type RoutePoint,
  type RouteSegment,
} from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  greatCircleMidpoint,
  greatCirclePath,
  projectPoint,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../data/map-geometry";
import { passportMapCamera, type MapCamera } from "../data/map-camera";
import { MapViewport } from "./MapViewport";
import { MapWorld } from "./MapWorld";

interface PassportRouteMapProps {
  routes: RouteSegment[];
  flights: KeeprawFlight[];
  selectedAirport?: string;
  selectedRoute?: { origin: string; destination: string };
  highlightedRoute?: { origin: string; destination: string };
  onSelectAirport: (code: string) => void;
  onSelectRoute: (origin: string, destination: string) => void;
}

interface AirportMapPoint extends RoutePoint {
  name: string;
  city: string;
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
  const locale: SupportedLocale = i18n.resolvedLanguage === "zh-TW"
    ? "zh-TW"
    : i18n.resolvedLanguage === "zh-CN"
      ? "zh-CN"
      : "en";
  const [activeTooltipKey, setActiveTooltipKey] = useState<string>();
  const countryVisits = useMemo(() => collectCountryVisits(flights), [flights]);
  const airports = useMemo(() => collectAirports(flights, locale), [flights, locale]);
  const initialCamera = useMemo(() => passportMapCamera(routes, airports), [airports, routes]);
  const routeYears = useMemo(() => collectRouteYears(flights), [flights]);
  const regionNames = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const labeledAirports = useMemo(
    () => new Map(
      [...airports]
        .sort((left, right) => right.flightCount - left.flightCount || left.iata.localeCompare(right.iata))
        .map((airport, rank) => [airport.iata, rank]),
    ),
    [airports],
  );
  const routeItems = useMemo(() => routes.map((route, index) => {
    const key = `route:${route.origin.iata}-${route.destination.iata}`;
    const years = routeYears.get(`${route.origin.iata}-${route.destination.iata}`);
    const midpoint = greatCircleMidpoint(route.origin, route.destination);
    const distance = Math.round(distanceKilometers(route.origin, route.destination));
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
      label,
      path: greatCirclePath(route.origin, route.destination),
      tooltip: {
        key,
        x: midpoint.x,
        y: midpoint.y,
        title: `${route.origin.iata} → ${route.destination.iata}`,
        detail: t("passport.mapRouteDistance", { distance: distance.toLocaleString(locale) }),
        meta: t("passport.flightFrequency", { count: route.flightCount }),
      } satisfies MapTooltipData,
      style: {
        "--map-item-index": index,
        "--map-route-opacity": visuals.opacity,
        "--map-route-width": visuals.width,
      } as CSSProperties,
    };
  }), [locale, routeYears, routes, t]);
  const airportItems = useMemo(() => airports.map((airport, index) => {
    const key = `airport:${airport.iata}`;
    const point = projectPoint(airport);
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
      radius: 2.15 + Math.min(Math.log2(airport.flightCount + 1) * 0.42, 1.25),
      tooltip: {
        key,
        x: point.x,
        y: point.y,
        title: compactAirportName(airport.name),
        detail: `${airport.iata} · ${t("passport.visitFrequency", { count: airport.flightCount })}`,
        meta: airport.city,
      } satisfies MapTooltipData,
      style: { "--map-item-index": index } as CSSProperties,
    };
  }), [airports, t]);
  const tooltipItems = useMemo(
    () => new Map([...routeItems, ...airportItems].map((item) => [item.key, item.tooltip])),
    [airportItems, routeItems],
  );
  const selectedTooltipKey = selectedAirport
    ? `airport:${selectedAirport}`
    : selectedRoute
      ? `route:${selectedRoute.origin}-${selectedRoute.destination}`
      : undefined;
  const tooltip = tooltipItems.get(activeTooltipKey ?? selectedTooltipKey ?? "");
  const totalFlights = routes.reduce((sum, route) => sum + route.flightCount, 0);

  return (
    <section className="route-map" id="passport-visual">
      <MapViewport
        className="route-map-canvas"
        ariaLabel={t("passport.mapPreviewLabel", { flights: totalFlights })}
        initialCamera={initialCamera}
        labels={{
          zoomIn: t("mapControls.zoomIn"),
          zoomOut: t("mapControls.zoomOut"),
          reset: t("mapControls.reset"),
        }}
      >
        {(camera) => <>
          <defs>
            <linearGradient id="passport-route-gradient" x1="0" y1="0" x2={WORLD_WIDTH} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--color-map-route-warm)" />
              <stop offset="1" stopColor="var(--color-map-route-cool)" />
            </linearGradient>
          </defs>
          <MapWorld
            countryVisits={countryVisits}
            showOutline={camera.zoom <= 1.05}
            countryName={(code, fallback) => code.length === 2 ? regionNames.of(code) ?? fallback : fallback}
            countryLabel={(name, visited) => t(visited ? "passport.mapCountryVisited" : "passport.mapCountryUnvisited", { country: name })}
          />
          <g className={highlightedRoute ? "map-routes has-highlight" : "map-routes"}>
            {routeItems.map((route) => {
              const selected = selectedRoute?.origin === route.origin.iata
                && selectedRoute.destination === route.destination.iata;
              const highlighted = highlightedRoute?.origin === route.origin.iata
                && highlightedRoute.destination === route.destination.iata;
              return <g
                key={route.key}
                className={["map-route", selected ? "is-selected" : "", highlighted ? "is-highlighted" : ""].filter(Boolean).join(" ")}
                role="button"
                tabIndex={0}
                aria-label={route.label}
                aria-pressed={selected}
                onPointerEnter={() => setActiveTooltipKey(route.key)}
                onPointerLeave={() => setActiveTooltipKey(undefined)}
                onFocus={() => setActiveTooltipKey(route.key)}
                onBlur={() => setActiveTooltipKey(undefined)}
                onClick={() => onSelectRoute(route.origin.iata, route.destination.iata)}
                onKeyDown={(event) => activateMapItem(event, () => onSelectRoute(route.origin.iata, route.destination.iata))}
              >
                <path className="map-route-hit" d={route.path} />
                <path className="map-route-underlay" d={route.path} />
                <path className="map-route-line" d={route.path} pathLength={1} style={route.style} />
                <title>{route.label}</title>
              </g>;
            })}
          </g>
          <g className="map-airports">
            {airportItems.map((airport) => {
              const selected = selectedAirport === airport.iata;
              const labelRank = labeledAirports.get(airport.iata);
              const showLabel = selected
                || labelRank === 0
                || (camera.zoom >= 1.65 && (labelRank ?? Infinity) < 3)
                || (camera.zoom >= 2.6 && (labelRank ?? Infinity) < 8)
                || camera.zoom >= 4;
              return <g
                key={airport.iata}
                className={selected ? "map-airport is-selected" : "map-airport"}
                transform={`translate(${airport.point.x} ${airport.point.y})`}
                role="button"
                tabIndex={0}
                aria-label={airport.label}
                aria-pressed={selected}
                onPointerEnter={() => setActiveTooltipKey(airport.key)}
                onPointerLeave={() => setActiveTooltipKey(undefined)}
                onFocus={() => setActiveTooltipKey(airport.key)}
                onBlur={() => setActiveTooltipKey(undefined)}
                onClick={() => onSelectAirport(airport.iata)}
                onKeyDown={(event) => activateMapItem(event, () => onSelectAirport(airport.iata))}
              >
                <g transform={`scale(${1 / camera.zoom})`}>
                  <circle className="map-airport-hit" r="14" />
                  <circle className="map-airport-ring" r={airport.radius + 3.6} />
                  <circle className="map-airport-point" r={airport.radius} style={airport.style} />
                  <title>{airport.label}</title>
                  {showLabel ? <text className={(labelRank ?? Infinity) > 1 ? "map-airport-label is-secondary" : "map-airport-label"} x="8" y="-7">{airport.iata}</text> : null}
                </g>
              </g>;
            })}
          </g>
          {tooltip ? <MapTooltip tooltip={tooltip} camera={camera} /> : null}
        </>}
      </MapViewport>
    </section>
  );
}

function MapTooltip({ tooltip, camera }: { tooltip: MapTooltipData; camera: MapCamera }) {
  const width = 176;
  const height = 58;
  const screenX = (tooltip.x - camera.centerX) * camera.zoom + WORLD_WIDTH / 2;
  const screenY = (tooltip.y - camera.centerY) * camera.zoom + WORLD_HEIGHT / 2;
  const offsetX = screenX + width + 24 > WORLD_WIDTH ? -width - 12 : 12;
  const offsetY = screenY + height + 20 > WORLD_HEIGHT ? -height - 12 : 12;
  return <g className="map-tooltip" transform={`translate(${tooltip.x} ${tooltip.y}) scale(${1 / camera.zoom})`} aria-hidden="true">
    <g transform={`translate(${offsetX} ${offsetY})`}>
      <rect width={width} height={height} rx="5" />
      <text x="12" y="18">
        <tspan className="map-tooltip-title">{tooltip.title}</tspan>
        <tspan className="map-tooltip-detail" x="12" dy="16">{tooltip.detail}</tspan>
        <tspan className="map-tooltip-meta" x="12" dy="15">{tooltip.meta}</tspan>
      </text>
    </g>
  </g>;
}

function collectAirports(flights: KeeprawFlight[], locale: SupportedLocale): AirportMapPoint[] {
  const points = new Map<string, AirportMapPoint>();
  for (const flight of flights) {
    const year = flight.serviceDate.slice(0, 4);
    for (const iata of [flight.origin.iata, flight.destination.iata]) {
      const reference = airportByIata.get(iata);
      if (!reference) continue;
      const existing = points.get(iata);
      if (existing) {
        existing.flightCount += 1;
        if (year < existing.firstYear) existing.firstYear = year;
        if (year > existing.lastYear) existing.lastYear = year;
      } else {
        points.set(iata, {
          iata,
          latitude: reference.latitude,
          longitude: reference.longitude,
          name: localizedText(reference.name, locale),
          city: localizedText(reference.city, locale),
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
    for (const iata of [flight.origin.iata, flight.destination.iata]) {
      const country = airportByIata.get(iata)?.country;
      if (country) visits.set(country, (visits.get(country) ?? 0) + 1);
    }
  }
  return visits;
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

function routeVisuals(count: number) {
  if (count === 1) return { opacity: 0.7, width: 1.25 };
  if (count <= 3) return { opacity: 0.79, width: 1.38 };
  if (count <= 9) return { opacity: 0.88, width: 1.56 };
  return { opacity: 0.95, width: 1.74 };
}

function compactAirportName(name: string): string {
  const compact = name
    .replace(/ International Airport$/i, "")
    .replace(/ Airport$/i, "")
    .replace(/国际机场$/, "机场");
  return compact.length > 29 ? `${compact.slice(0, 28)}…` : compact;
}

function activateMapItem(event: KeyboardEvent<SVGGElement>, activate: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activate();
}
