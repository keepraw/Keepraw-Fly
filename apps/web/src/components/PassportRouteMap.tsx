import { useMemo, useState, type CSSProperties, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  airportByIata,
  collectVisitedCountryCodes,
  distanceKilometers,
  type RoutePoint,
  type RouteSegment,
} from "@keepraw-fly/core";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  greatCircleMidpoint,
  greatCirclePath,
  projectPoint,
  WORLD_COUNTRIES,
  WORLD_HEIGHT,
  WORLD_SPHERE_PATH,
  WORLD_WIDTH,
} from "../data/map-geometry";

interface PassportRouteMapProps {
  routes: RouteSegment[];
  flights: KeeprawFlight[];
  selectedAirport?: string;
  selectedRoute?: { origin: string; destination: string };
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
  onSelectAirport,
  onSelectRoute,
}: PassportRouteMapProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en";
  const [activeTooltipKey, setActiveTooltipKey] = useState<string>();
  const visitedCountries = useMemo(() => collectVisitedCountryCodes(flights), [flights]);
  const airports = useMemo(() => collectAirports(flights, locale), [flights, locale]);
  const routeYears = useMemo(() => collectRouteYears(flights), [flights]);
  const regionNames = useMemo(() => new Intl.DisplayNames([locale], { type: "region" }), [locale]);
  const labeledAirports = useMemo(
    () => new Map(
      [...airports]
        .sort((left, right) => right.flightCount - left.flightCount || left.iata.localeCompare(right.iata))
        .slice(0, 5)
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
      radius: 3.1 + Math.min(Math.log2(airport.flightCount + 1) * 0.8, 2.5),
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
        <svg viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} role="group" aria-label={t("passport.mapPreviewLabel", { flights: totalFlights })}>
          <defs>
            <pattern id="passport-map-dots" width="7" height="7" patternUnits="userSpaceOnUse">
              <circle className="map-texture-dot" cx="1.5" cy="1.5" r="0.85" />
            </pattern>
          </defs>
          <path className="map-sphere" d={WORLD_SPHERE_PATH} aria-hidden="true" />
          <g className="map-countries" aria-hidden="true">
            {WORLD_COUNTRIES.map((country) => {
              const visited = visitedCountries.has(country.code);
              const countryName = country.code.length === 2
                ? regionNames.of(country.code) ?? country.name
                : country.name;
              const className = visited
                ? `map-country is-visited map-country-palette-${countryPalette(country.code)}`
                : "map-country";
              return <g key={country.code} className={className}>
                <path d={country.path}>
                  <title>{t(visited ? "passport.mapCountryVisited" : "passport.mapCountryUnvisited", { country: countryName })}</title>
                </path>
                {visited ? <path className="map-country-texture" d={country.path} /> : null}
              </g>;
            })}
          </g>
          <g className="map-routes">
            {routeItems.map((route) => {
              const selected = selectedRoute?.origin === route.origin.iata
                && selectedRoute.destination === route.destination.iata;
              return <g
                key={route.key}
                className={selected ? "map-route is-selected" : "map-route"}
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
                <path className="map-route-line" d={route.path} pathLength={1} style={route.style} />
                <title>{route.label}</title>
              </g>;
            })}
          </g>
          <g className="map-airports">
            {airportItems.map((airport) => {
              const selected = selectedAirport === airport.iata;
              const labelRank = labeledAirports.get(airport.iata);
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
                <circle className="map-airport-hit" r="14" />
                <circle className="map-airport-ring" r={airport.radius + 3.2} />
                <circle className="map-airport-point" r={airport.radius} style={airport.style} />
                <title>{airport.label}</title>
                {labelRank !== undefined ? <text className={labelRank > 1 ? "map-airport-label is-secondary" : "map-airport-label"} x="8" y="-7">{airport.iata}</text> : null}
              </g>;
            })}
          </g>
          {tooltip ? <MapTooltip tooltip={tooltip} /> : null}
        </svg>
      </div>
      <p className="route-map-legend">{t("passport.mapLegend")}</p>
    </section>
  );
}

function MapTooltip({ tooltip }: { tooltip: MapTooltipData }) {
  const width = 176;
  const height = 58;
  const x = Math.min(Math.max(tooltip.x + 12, 8), WORLD_WIDTH - width - 8);
  const y = tooltip.y > WORLD_HEIGHT - height - 18 ? tooltip.y - height - 12 : tooltip.y + 12;
  return <g className="map-tooltip" transform={`translate(${x} ${Math.max(8, y)})`} aria-hidden="true">
    <rect width={width} height={height} rx="5" />
    <text x="12" y="18">
      <tspan className="map-tooltip-title">{tooltip.title}</tspan>
      <tspan className="map-tooltip-detail" x="12" dy="16">{tooltip.detail}</tspan>
      <tspan className="map-tooltip-meta" x="12" dy="15">{tooltip.meta}</tspan>
    </text>
  </g>;
}

function collectAirports(flights: KeeprawFlight[], locale: "en" | "zh-CN"): AirportMapPoint[] {
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
          name: reference.name[locale],
          city: reference.city[locale],
          flightCount: 1,
          firstYear: year,
          lastYear: year,
        });
      }
    }
  }
  return [...points.values()];
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
  if (count === 1) return { opacity: 0.38, width: 1.25 };
  if (count <= 3) return { opacity: 0.52, width: 1.5 };
  if (count <= 9) return { opacity: 0.68, width: 1.85 };
  return { opacity: 0.82, width: 2.2 };
}

function countryPalette(code: string): number {
  return [...code].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 7;
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
