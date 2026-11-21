import { geoDistance, geoPath } from "d3-geo";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NEON_AVIATION, hatchTile } from "./neon-aviation-tokens";
import {
  datelineCrossing,
  greatCirclePath,
  projectionAt,
  regionalWorldPaths,
  routeFrame,
} from "./neon-geometry";
import {
  NEON_AIRPORTS,
  SPARSE_ROUTES,
  type NeonAirport,
} from "./sample-network";

export interface NeonRouteMapProps {
  initialRoute?: "tpe-lax" | "pvg-cdg";
}

export function NeonRouteMap({ initialRoute = "tpe-lax" }: NeonRouteMapProps) {
  const [routeId, setRouteId] = useState(initialRoute);
  const stageRef = useRef<HTMLDivElement>(null);
  const [pixelScale, setPixelScale] = useState(1);
  useEffect(() => setRouteId(initialRoute), [initialRoute]);
  const [fromCode, toCode] =
    routeId === "tpe-lax" ? ["TPE", "LAX"] : ["PVG", "CDG"];
  const origin = getAirport(fromCode);
  const destination = getAirport(toCode);
  const id = useId().replaceAll(":", "");
  const backgroundId = `neon-detail-bg-${id}`;
  const patternId = `neon-detail-hatch-${id}`;
  const landClipId = `neon-detail-land-${id}`;
  const haloId = `neon-detail-halo-${id}`;
  const frame = useMemo(
    () => routeFrame(origin, destination, 16 / 9, 0.12),
    [origin, destination],
  );
  const paths = useMemo(
    () => regionalWorldPaths(frame.centerLongitude),
    [frame.centerLongitude],
  );
  const projection = useMemo(
    () => projectionAt(frame.centerLongitude),
    [frame.centerLongitude],
  );
  const routePath = useMemo(
    () => greatCirclePath(origin, destination, 64, frame.centerLongitude),
    [origin, destination, frame.centerLongitude],
  );
  const dateLine = useMemo(
    () => datelineCrossing(origin, destination),
    [origin, destination],
  );
  const graticule = useMemo(
    () => geoPath(projection).digits(1)(geoGraticule()) ?? "",
    [projection],
  );
  const routeDefinition = SPARSE_ROUTES.find(
    (route) =>
      route.origin.iata === fromCode && route.destination.iata === toCode,
  );
  const distanceKm = Math.round(
    geoDistance(
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    ) * 6371,
  );
  const duration = `${Math.floor(distanceKm / 850)}h ${Math.round(
    ((distanceKm / 850) % 1) * 60,
  )}m`;
  const tile = hatchTile(NEON_AVIATION.hatch, window.devicePixelRatio || 1);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const updatePixelScale = () => {
      setPixelScale(frame.width / Math.max(1, stage.clientWidth));
    };
    updatePixelScale();
    const observer = new ResizeObserver(updatePixelScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [frame.width]);
  const originPoint = projectAirport(projection, origin);
  const destinationPoint = projectAirport(projection, destination);
  const dateLinePath = dateLine
    ? `M ${dateLine.x} ${Math.max(frame.y, dateLine.y - 34)} L ${dateLine.x} ${Math.min(frame.y + frame.height, dateLine.y + 34)}`
    : "";

  return (
    <section className="neon-detail-sample" data-neon-detail-ready="true">
      <div className="neon-detail-stage" ref={stageRef}>
        <svg
          className="neon-detail-map"
          viewBox={frame.viewBox}
          role="img"
          aria-label={`${origin.iata} to ${destination.iata} great-circle route sample`}
        >
          <defs>
            <linearGradient id={backgroundId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--neon-background-top)" />
              <stop offset="1" stopColor="var(--neon-background-bottom)" />
            </linearGradient>
            <pattern
              id={patternId}
              width={tile.size * pixelScale}
              height={tile.size * pixelScale}
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${tile.angle})`}
            >
              <path
                d={`M 0 0 L 0 ${tile.size * pixelScale}`}
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
            x={frame.x}
            y={frame.y}
            width={frame.width}
            height={frame.height}
            fill={`url(#${backgroundId})`}
          />
          <path className="neon-map-sphere" d={paths.sphere} />
          <path className="neon-map-graticule" d={graticule} />
          <path className="neon-map-land" d={paths.land} />
          <rect
            className="neon-map-hatch"
            x={frame.x}
            y={frame.y}
            width={frame.width}
            height={frame.height}
            fill={`url(#${patternId})`}
            clipPath={`url(#${landClipId})`}
          />
          <path
            className="neon-map-borders"
            d={paths.countries.map((country) => country.path).join("")}
          />
          <path className="neon-map-coastline" d={paths.land} />
          <path
            className="neon-route-glow neon-route-glow--detail"
            d={routePath}
          />
          <path
            className="neon-route-line neon-route-line--selected"
            d={routePath}
          />
          {dateLine && (
            <>
              <path className="neon-dateline" d={dateLinePath} />
              <g
                transform={`translate(${dateLine.x + 7} ${Math.max(frame.y + 14, dateLine.y - 39)}) scale(${pixelScale})`}
              >
                <text className="neon-dateline-label" x="0" y="0">
                  180° · Date line
                </text>
              </g>
            </>
          )}
          {[
            { airport: origin, point: originPoint },
            { airport: destination, point: destinationPoint },
          ].map(({ airport, point }) => (
            <g
              key={airport.iata}
              transform={`translate(${point.x} ${point.y}) scale(${pixelScale})`}
            >
              <circle
                className="neon-airport-halo"
                cx="0"
                cy="0"
                r={NEON_AVIATION.airport.selected.halo}
                fill={`url(#${haloId})`}
              />
              <circle
                className="neon-airport-point neon-airport-point--selected"
                cx="0"
                cy="0"
                r={NEON_AVIATION.airport.selected.radius}
                strokeWidth={NEON_AVIATION.airport.selected.stroke}
              />
              <text
                className="neon-detail-code"
                x="0"
                y="-22"
                textAnchor="middle"
              >
                {airport.iata}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="neon-detail-meta">
        <div className="neon-endpoint">
          <strong>{origin.iata}</strong>
          <span>{origin.city}</span>
          <small>
            {routeId === "tpe-lax" ? "09:45 · local" : "14:20 · local"}
          </small>
        </div>
        <div className="neon-route-readout">
          <span>{distanceKm.toLocaleString("en-US")} km</span>
          <span>≈ {duration} great-circle</span>
        </div>
        <div className="neon-endpoint neon-endpoint--end">
          <strong>{destination.iata}</strong>
          <span>{destination.city}</span>
          <small>
            {routeId === "tpe-lax" ? "06:10 · local" : "08:05 · local"}
            {routeId === "tpe-lax" && <b className="neon-next-day">+1 day</b>}
          </small>
        </div>
      </div>
      <div
        className="neon-route-switch"
        role="group"
        aria-label="Route example"
      >
        <button
          type="button"
          aria-pressed={routeId === "tpe-lax"}
          onClick={() => setRouteId("tpe-lax")}
        >
          TPE → LAX · date line
        </button>
        <button
          type="button"
          aria-pressed={routeId === "pvg-cdg"}
          onClick={() => setRouteId("pvg-cdg")}
        >
          PVG → CDG · regional
        </button>
      </div>
      <span className="neon-visually-hidden">
        {routeDefinition?.count ?? 0} fictional sample routes represented
      </span>
    </section>
  );
}

function getAirport(code: string): NeonAirport {
  const airport = NEON_AIRPORTS.find((entry) => entry.iata === code);
  if (!airport) throw new Error(`Unknown sample airport ${code}.`);
  return airport;
}

function projectAirport(
  projection: ReturnType<typeof projectionAt>,
  airport: NeonAirport,
) {
  const projected = projection([airport.longitude, airport.latitude]);
  if (!projected)
    throw new Error(`Unable to project sample airport ${airport.iata}.`);
  return { x: projected[0], y: projected[1] };
}

function geoGraticule() {
  const coordinates: [number, number][][] = [
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
  ];
  return { type: "MultiLineString" as const, coordinates };
}
