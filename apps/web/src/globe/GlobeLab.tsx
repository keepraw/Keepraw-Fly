import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight, KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  buildRouteSegments,
  localizedText,
  airportByIata,
} from "@keepraw-fly/core";
import type { ViewerSettings } from "../storage/types";
import {
  initialPassportView,
  passportVisibleFlights,
} from "../data/passport-exploration";
import { FlightRow } from "../components/FlightRow";
import { GlobeMap } from "./GlobeMap";
import { globeAirports } from "./globe-math";
import type { GlobeSelection, GlobeTheme } from "./globe-renderer";
import { defaultLighting } from "./globe-lighting";
import "./globe-lab.css";
import "./lab-locales";

export default function GlobeLab({
  document,
  settings,
  isDemo,
}: {
  document: KeeprawFlyDocument;
  settings: ViewerSettings;
  isDemo: boolean;
}) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<GlobeTheme>(() =>
    settings.appearance === "system"
      ? matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : settings.appearance,
  );
  const [year, setYear] = useState<number | "lifetime">("lifetime"),
    [query, setQuery] = useState("");
  const [selection, setSelection] = useState<GlobeSelection | null>(null),
    [hovered, setHovered] = useState<KeeprawFlight | null>(null);
  const [quality, setQuality] = useState<"2048" | "4096">("4096");
  const [lighting, setLighting] = useState({ ...defaultLighting });
  const flights = useMemo(
    () =>
      passportVisibleFlights(document.flights, {
        ...initialPassportView,
        year,
        query,
      }),
    [document.flights, year, query],
  );
  const routes = useMemo(() => buildRouteSegments(flights), [flights]);
  const airports = useMemo(() => globeAirports(routes), [routes]);
  const years = useMemo(
    () =>
      [
        ...new Set(
          document.flights.map((f) => Number(f.serviceDate.slice(0, 4))),
        ),
      ].sort((a, b) => b - a),
    [document.flights],
  );
  const select = (s: GlobeSelection) => setSelection(s);
  const routeSelection = (flight: KeeprawFlight): GlobeSelection => ({
    kind: "route",
    origin: flight.origin.iata,
    destination: (flight.divertedTo ?? flight.destination).iata,
  });
  return (
    <div className="globe-lab" data-theme={theme}>
      <header className="globe-lab-header">
        <a href="/" className="globe-wordmark">
          KEEPRAW FLY
        </a>
        <span>Globe Lab</span>
        <a href="/#passport">{t("globe.back")}</a>
      </header>
      <main className="globe-lab-main" id="main-content">
        <div className="globe-lab-intro">
          <span>
            {isDemo ? t("demo.label") : t("globe.personal")} ·{" "}
            {t("globe.experiment")}
          </span>
          <div
            className="globe-theme-switch"
            aria-label={t("globe.appearance")}
          >
            <button
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              {t("settings.light")}
            </button>
            <button
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              {t("settings.dark")}
            </button>
          </div>
        </div>
        <div className="globe-lab-layout">
          <aside
            className="globe-lab-sidebar passport-archive"
            aria-label={t("globe.flights")}
          >
            <div className="globe-years">
              <button
                aria-pressed={year === "lifetime"}
                onClick={() => {
                  setYear("lifetime");
                  setSelection(null);
                }}
              >
                {t("globe.all")}
              </button>
              {years.map((y) => (
                <button
                  key={y}
                  aria-pressed={year === y}
                  onClick={() => {
                    setYear(y);
                    setSelection(null);
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
            <label className="globe-search">
              <span aria-hidden="true">⌕</span>
              <input
                aria-label={t("globe.search")}
                placeholder={t("globe.search")}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelection(null);
                }}
              />
            </label>
            <div className="globe-flight-heading">
              <strong>{t("globe.flights")}</strong>
              <span>
                {flights.length} {t("globe.records")}
              </span>
            </div>
            <div className="globe-flight-list">
              {flights.map((flight) => (
                <FlightRow
                  key={flight.id}
                  flight={flight}
                  locale={settings.language}
                  timeFormat={settings.timeFormat}
                  presentation="passport"
                  selected={
                    selection?.kind === "route" &&
                    selection.origin === flight.origin.iata &&
                    selection.destination ===
                      (flight.divertedTo ?? flight.destination).iata
                  }
                  onOpen={() => select(routeSelection(flight))}
                  onHoverChange={setHovered}
                />
              ))}
              {!flights.length && <p>{t("globe.empty")}</p>}
            </div>
          </aside>
          <section className="globe-lab-map-panel">
            <div className="globe-map-heading">
              <h1>{t("passport.worldTitle")}</h1>
              <span>
                {routes.length} {t("globe.routes")} · {airports.length}{" "}
                {t("globe.airports")}
              </span>
            </div>
            <GlobeMap
              routes={routes}
              flights={flights}
              theme={theme}
              quality={quality}
              lighting={lighting}
              selection={selection}
              highlightedRoute={
                hovered
                  ? `${hovered.origin.iata}-${(hovered.divertedTo ?? hovered.destination).iata}`
                  : undefined
              }
              onSelect={select}
            />
            <div className="globe-selection-controls">
              <label>
                {t("globe.route")}
                <select
                  aria-label={t("globe.route")}
                  value={
                    selection?.kind === "route"
                      ? `${selection.origin}-${selection.destination}`
                      : ""
                  }
                  onChange={(e) => {
                    const route = routes.find(
                      (r) =>
                        `${r.origin.iata}-${r.destination.iata}` ===
                        e.target.value,
                    );
                    if (route)
                      select({
                        kind: "route",
                        origin: route.origin.iata,
                        destination: route.destination.iata,
                      });
                  }}
                >
                  <option value="">{t("globe.chooseRoute")}</option>
                  {routes.map((r) => (
                    <option
                      key={`${r.origin.iata}-${r.destination.iata}`}
                      value={`${r.origin.iata}-${r.destination.iata}`}
                    >
                      {r.origin.iata} → {r.destination.iata} · {r.flightCount}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("globe.airport")}
                <select
                  aria-label={t("globe.airport")}
                  value={selection?.kind === "airport" ? selection.code : ""}
                  onChange={(e) => {
                    if (e.target.value)
                      select({ kind: "airport", code: e.target.value });
                  }}
                >
                  <option value="">{t("globe.chooseAirport")}</option>
                  {airports.map((a) => (
                    <option key={a.iata} value={a.iata}>
                      {a.iata} ·{" "}
                      {localizedText(
                        airportByIata.get(a.iata)!.city,
                        settings.language,
                      )}{" "}
                      · {a.flightCount}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("globe.quality")}
                <select
                  aria-label={t("globe.quality")}
                  value={quality}
                  onChange={(e) =>
                    setQuality(e.target.value as "2048" | "4096")
                  }
                >
                  <option value="4096">4K</option>
                  <option value="2048">2K</option>
                </select>
              </label>
            </div>
            <p className="globe-help">{t("globe.help")}</p>
            <details className="globe-debug" open>
              <summary>{t("globe.lightingReview")}</summary>
              <div className="globe-debug-layers">
                {(
                  ["earthOnly", "surface", "nightLights", "atmosphere"] as const
                ).map((key) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={lighting[key]}
                      onChange={(event) =>
                        setLighting((previous) => ({
                          ...previous,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                    {t(`globe.${key === "surface" ? "daySurface" : key}`)}
                  </label>
                ))}
              </div>
              <div className="globe-debug-parameters">
                {(
                  [
                    ["sunIntensity", 0, 4, 0.1],
                    ["twilightWidth", 0.05, 0.4, 0.01],
                    ["atmosphereIntensity", 0, 2, 0.1],
                    ["nightIntensity", 0, 3, 0.1],
                  ] as const
                ).map(([key, min, max, step]) => (
                  <label key={key}>
                    {t(`globe.${key}`)}
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={lighting[key]}
                      onChange={(event) =>
                        setLighting((previous) => ({
                          ...previous,
                          [key]: Number(event.target.value),
                        }))
                      }
                    />
                    <output>{lighting[key]}</output>
                  </label>
                ))}
              </div>
              <button onClick={() => setLighting({ ...defaultLighting })}>
                {t("globe.resetLighting")}
              </button>
            </details>
            <p className="globe-attribution">
              {t("globe.credit")}{" "}
              <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/">
                NASA Earth Observatory / Blue Marble
              </a>
              {" · "}
              <a href="https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/">
                NASA / Black Marble 2016
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
