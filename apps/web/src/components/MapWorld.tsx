import { projectionAt, regionalWorldPaths } from "../data/map-geometry";
import { geoGraticule10, geoPath } from "d3-geo";
import { useId, useMemo } from "react";
import { MapRelief } from "./MapRelief";
import { hatchTile } from "../map2d/theme-style";
import type { MapTheme } from "../map2d/theme";

interface MapWorldProps {
  countryVisits?: ReadonlyMap<string, number>;
  countryName?: (code: string, fallback: string) => string;
  countryLabel?: (name: string, visited: boolean) => string;
  showOutline?: boolean;
  centerLongitude?: number;
  appearance?: "standard" | "aviation";
  /** Draws the hatched, token-driven world instead of the relief raster. */
  theme?: MapTheme;
  zoom?: number;
  pixelScale?: number;
}

export function MapWorld({
  countryVisits,
  countryName,
  countryLabel,
  showOutline = true,
  centerLongitude = 0,
  appearance = "standard",
  theme,
  zoom = 1,
  pixelScale = 1,
}: MapWorldProps) {
  const id = useId().replace(/:/g, "");
  const aviation = !theme && appearance === "aviation";
  const graticule = useMemo(
    () =>
      aviation || theme
        ? geoPath(projectionAt(centerLongitude))(geoGraticule10())
        : null,
    [aviation, theme, centerLongitude],
  );
  const paths = useMemo(
    () => regionalWorldPaths(centerLongitude),
    [centerLongitude],
  );
  const maximumVisits = Math.max(
    1,
    ...(countryVisits ? [...countryVisits.values()] : []),
  );

  if (theme) {
    const tile = hatchTile(
      theme.tokens.hatch,
      typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
      zoom,
    );
    const tileSize = tile.size * pixelScale;
    return (
      <g className="map-world map-world--themed" aria-hidden="true">
        <defs>
          <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--map-theme-background-top)" />
            <stop offset="1" stopColor="var(--map-theme-background-bottom)" />
          </linearGradient>
          <pattern
            id={`hatch-${id}`}
            width={tileSize}
            height={tileSize}
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${tile.angle}) scale(${1 / zoom})`}
          >
            <path
              d={`M 0 0 L 0 ${tileSize}`}
              fill="none"
              stroke="var(--map-theme-land-hatch)"
              strokeWidth={tile.lineWidth * pixelScale}
            />
          </pattern>
        </defs>
        <path d={paths.sphere} fill={`url(#sky-${id})`} />
        {graticule ? <path className="map-graticule" d={graticule} /> : null}
        <path className="map-land-fill" d={paths.land} />
        <path
          className="map-land-hatch"
          d={paths.land}
          fill={`url(#hatch-${id})`}
        />
        <g className="map-countries">
          {paths.countries.map((country) => {
            const visited = (countryVisits?.get(country.code) ?? 0) > 0;
            const name =
              countryName?.(country.code, country.name) ?? country.name;
            return (
              <path
                key={country.code}
                className={visited ? "map-country is-visited" : "map-country"}
                d={country.path}
              >
                {countryLabel ? (
                  <title>{countryLabel(name, visited)}</title>
                ) : null}
              </path>
            );
          })}
        </g>
        <path className="map-coastline" d={paths.land} />
      </g>
    );
  }

  return (
    <g
      className={`map-world${aviation ? " map-world--aviation" : ""}`}
      aria-hidden="true"
    >
      {aviation ? (
        <>
          <defs>
            <filter id={`relief-light-${id}`} colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="table" tableValues="0.40 0.60 0.82 0.97" />
                <feFuncG type="table" tableValues="0.57 0.75 0.89 0.99" />
                <feFuncB type="table" tableValues="0.75 0.88 0.97 1" />
              </feComponentTransfer>
            </filter>
            <filter id={`relief-dark-${id}`} colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="table" tableValues="0.025 0.08 0.16 0.28" />
                <feFuncG type="table" tableValues="0.06 0.16 0.28 0.44" />
                <feFuncB type="table" tableValues="0.12 0.26 0.41 0.58" />
              </feComponentTransfer>
            </filter>
            <clipPath id={`land-${id}`}>
              <path d={paths.land} />
            </clipPath>
            <radialGradient id={`ocean-${id}`} cx="48%" cy="24%" r="82%">
              <stop offset="0" stopColor="var(--color-map-surface)" />
              <stop offset="1" stopColor="var(--color-map-ocean)" />
            </radialGradient>
            <linearGradient
              id={`land-light-${id}`}
              x1="0"
              y1="0"
              x2="0.7"
              y2="1"
            >
              <stop offset="0" stopColor="var(--color-map-land-light)" />
              <stop offset="0.52" stopColor="var(--color-map-land)" />
              <stop offset="1" stopColor="var(--color-map-land-shadow)" />
            </linearGradient>
            <radialGradient id={`limb-${id}`} cx="50%" cy="35%" r="65%">
              <stop
                offset="0.4"
                stopColor="var(--color-map-ocean)"
                stopOpacity="0"
              />
              <stop
                offset="1"
                stopColor="var(--color-map-ocean)"
                stopOpacity="0.65"
              />
            </radialGradient>
          </defs>
          <path d={paths.sphere} fill={`url(#ocean-${id})`} />
          {graticule ? <path className="map-graticule" d={graticule} /> : null}
          <path
            className="map-land-depth"
            d={paths.land}
            fill={`url(#land-light-${id})`}
          />
        </>
      ) : null}
      <path
        className={showOutline ? "map-sphere" : "map-sphere is-outline-hidden"}
        d={paths.sphere}
      />
      <g className="map-countries">
        {paths.countries.map((country) => {
          const visits = countryVisits?.get(country.code) ?? 0;
          const visited = visits > 0;
          const intensity = visits / maximumVisits;
          const className = visited
            ? `map-country is-visited is-${intensity > 0.66 ? "high" : intensity > 0.33 ? "medium" : "low"}`
            : "map-country";
          const name =
            countryName?.(country.code, country.name) ?? country.name;
          return (
            <path key={country.code} className={className} d={country.path}>
              {countryLabel ? (
                <title>{countryLabel(name, visited)}</title>
              ) : null}
            </path>
          );
        })}
      </g>
      {aviation ? (
        <>
          <g clipPath={`url(#land-${id})`} className="map-relief">
            <MapRelief
              centerLongitude={centerLongitude}
              lightFilter={`relief-light-${id}`}
              darkFilter={`relief-dark-${id}`}
            />
          </g>
          <path
            className="map-limb-shade"
            d={paths.sphere}
            fill={`url(#limb-${id})`}
          />
        </>
      ) : null}
      <path className="map-coastline" d={paths.land} />
    </g>
  );
}
