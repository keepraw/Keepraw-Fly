import { WORLD_COUNTRIES, WORLD_LAND_PATH, WORLD_SPHERE_PATH, WORLD_WIDTH } from "../data/map-geometry";

interface MapWorldProps {
  countryVisits?: ReadonlyMap<string, number>;
  countryName?: (code: string, fallback: string) => string;
  countryLabel?: (name: string, visited: boolean) => string;
  showOutline?: boolean;
}

const WORLD_OFFSETS = [0, WORLD_WIDTH] as const;

export function MapWorld({ countryVisits, countryName, countryLabel, showOutline = true }: MapWorldProps) {
  const maximumVisits = Math.max(1, ...(countryVisits ? [...countryVisits.values()] : []));

  return <g className="map-world" aria-hidden="true">
    {WORLD_OFFSETS.map((offset) => <g key={offset} transform={`translate(${offset} 0)`}>
      <path className={showOutline ? "map-sphere" : "map-sphere is-outline-hidden"} d={WORLD_SPHERE_PATH} />
      <g className="map-countries">
        {WORLD_COUNTRIES.map((country) => {
          const visits = countryVisits?.get(country.code) ?? 0;
          const visited = visits > 0;
          const intensity = visits / maximumVisits;
          const className = visited
            ? `map-country is-visited is-${intensity > 0.66 ? "high" : intensity > 0.33 ? "medium" : "low"}`
            : "map-country";
          const name = countryName?.(country.code, country.name) ?? country.name;
          return <path key={country.code} className={className} d={country.path}>
            {countryLabel ? <title>{countryLabel(name, visited)}</title> : null}
          </path>;
        })}
      </g>
      <path className="map-coastline" d={WORLD_LAND_PATH} />
    </g>)}
  </g>;
}
