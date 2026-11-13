import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  airportByIata,
  airportCityGroupByCode,
  airportCityGroupForAirport,
  airportCityGroupName,
  assignmentDateRelation,
  localizedText,
  resolveEndpointIdentity,
  searchAirports,
  searchHistoricalAirports,
  type AirportReference,
  type HistoricalAirportSearchResult,
  type SupportedLocale,
} from "@keepraw-fly/core";

/** A well-formed code that is not a metropolitan city code may be kept as is. */
function keepableCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return null;
  if (airportByIata.has(code)) return code;
  return airportCityGroupByCode.has(code) ? null : code;
}

function historicalCode(
  result: HistoricalAirportSearchResult,
  date: string | undefined,
): string | null {
  const iata = result.assignments.filter((row) => row.scheme === "IATA");
  const atDate = date
    ? iata.find((row) => assignmentDateRelation(date, row) !== "excluded")
    : undefined;
  return (atDate ?? iata[0])?.code ?? result.searchCode;
}

interface AirportComboboxProps {
  label: string;
  locale: SupportedLocale;
  value: string;
  airportId?: string;
  onChange: (iata: string, airportId?: string) => void;
  required?: boolean;
  preferredCodes?: readonly string[];
  /** Local date the airport is used on, for historical identification. */
  date?: string;
  role?: "origin" | "destination" | "arrival";
}

export function AirportCombobox({
  label,
  locale,
  value,
  airportId,
  onChange,
  required = true,
  preferredCodes = [],
  date,
  role = "origin",
}: AirportComboboxProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const reviewRequest = useRef(0);
  const [research, setResearch] = useState<
    import("../data/airport-history").AirportResearchResult[]
  >([]);
  const [researchState, setResearchState] = useState<
    "idle" | "loading" | "ready" | "failed"
  >("idle");
  useEffect(() => {
    reviewRequest.current++;
    setResearch([]);
    setResearchState("idle");
  }, [value]);
  async function reviewHistory() {
    const request = ++reviewRequest.current;
    setResearchState("loading");
    try {
      const { researchAirportCode } = await import("../data/airport-history");
      const matches = await researchAirportCode(value);
      if (request !== reviewRequest.current) return;
      setResearch(matches);
      setResearchState("ready");
    } catch {
      if (request === reviewRequest.current) setResearchState("failed");
    }
  }
  const results = useMemo(
    () =>
      query.trim()
        ? searchAirports(query, locale)
        : preferredCodes
            .map((code) => airportByIata.get(code))
            .filter((airport): airport is AirportReference => Boolean(airport)),
    [query, locale, preferredCodes],
  );
  const historical = useMemo(
    () =>
      query.trim()
        ? searchHistoricalAirports(query, 5).filter((result) =>
            Boolean(historicalCode(result, date)),
          )
        : [],
    [query, date],
  );
  const identity = useMemo(
    () =>
      value
        ? resolveEndpointIdentity(value, date || null, role, null, airportId)
        : null,
    [value, date, role, airportId],
  );

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => setActiveIndex(0), [query, locale]);

  function chooseAirport(airport: AirportReference) {
    const code = value || keepableCode(query) || airport.iata;
    setQuery(code);
    onChange(code, airport.airportId);
    setOpen(false);
  }

  function chooseCode(code: string, id: string) {
    const original = value || keepableCode(query) || code;
    setQuery(original);
    onChange(original, id);
    setOpen(false);
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    // Searching a name must not change the recorded code, even while the user
    // passes through a three-letter prefix. Commit typed codes on blur.
    setOpen(true);
  }

  return (
    <div className="airport-combobox">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        required={required}
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && Boolean(results.length)}
        aria-activedescendant={
          open && results[activeIndex]
            ? `${listId}-${results[activeIndex].iata}`
            : undefined
        }
        autoComplete="off"
        spellCheck={false}
        value={query}
        placeholder={t("flightEditor.airportSearchPlaceholder")}
        onFocus={() => {
          setOpen(true);
        }}
        onChange={(event) => updateQuery(event.target.value)}
        onBlur={(event) => {
          if (event.currentTarget.parentElement?.contains(event.relatedTarget))
            return;
          const code = keepableCode(query);
          if (code && code !== value) onChange(code);
          else if (!query.trim()) onChange("");
          setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && results.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) =>
              Math.min(current + 1, results.length - 1),
            );
          } else if (event.key === "ArrowUp" && results.length) {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && open && results[activeIndex]) {
            event.preventDefault();
            chooseAirport(results[activeIndex]);
          } else if (event.key === "Enter" && open && historical[0]) {
            event.preventDefault();
            chooseCode(
              historicalCode(historical[0], date)!,
              historical[0].airportId,
            );
          } else if (
            event.key === "Enter" &&
            keepableCode(query) &&
            query !== value
          ) {
            event.preventDefault();
            onChange(keepableCode(query)!);
            setOpen(false);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <small className="editor-field-hint">
        {identity?.name
          ? `${value} · ${localizedText(identity.name, locale)}${identity.city ? ` · ${localizedText(identity.city, locale)}` : ""}`
          : preferredCodes.length
            ? t("flightEditor.airportRecentHint")
            : t("flightEditor.airportSearchHint")}
      </small>
      {value ? (
        <details>
          <summary>{t("flightEditor.airportHistory.searchGroup")}</summary>
          <button
            type="button"
            disabled={researchState === "loading"}
            onClick={() => void reviewHistory()}
          >
            {t("flightEditor.airportHistory.review", {
              defaultValue: "Look up historical airports",
            })}
          </button>
          {researchState === "failed" ? (
            <p role="status">
              {t("flightEditor.airportHistory.reviewFailed", {
                defaultValue:
                  "Lookup unavailable. You can still select an airport above and save your flight.",
              })}
            </p>
          ) : null}
          {researchState === "ready" && !research.length ? (
            <p>{t("flightEditor.noAirportResults")}</p>
          ) : null}
          {research.map((entry) => (
            <div key={entry.referenceId}>
              {entry.airportId ? (
                <button
                  type="button"
                  onClick={() => chooseCode(value, entry.airportId!)}
                >
                  {entry.name} · {entry.country}
                </button>
              ) : (
                <span>
                  {entry.name} · {entry.country}
                </span>
              )}
            </div>
          ))}
        </details>
      ) : null}
      {open && historical.length ? (
        <div
          className="airport-options airport-history-options"
          role="group"
          aria-label={t("flightEditor.airportHistory.searchGroup")}
        >
          {historical.map((result) => {
            const code = historicalCode(result, date)!;
            return (
              <button
                key={result.airportId}
                type="button"
                data-history-kind={result.kind}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseCode(code, result.airportId)}
              >
                <strong>{code}</strong>
                <span>{result.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
      {open && results.length ? (
        <div className="airport-options" id={listId} role="listbox">
          {results.length ? (
            results.map((airport, index) => {
              const cityGroup = airportCityGroupForAirport(airport.iata);
              const cityName = cityGroup
                ? airportCityGroupName(cityGroup, locale)
                : localizedText(airport.city, locale);
              return (
                <button
                  id={`${listId}-${airport.iata}`}
                  key={airport.iata}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseAirport(airport)}
                >
                  <strong>{airport.iata}</strong>
                  <span>{localizedText(airport.name, locale)}</span>
                  <small>
                    {cityName}
                    {cityGroup
                      ? ` · ${t("flightEditor.multiAirportCount", { count: cityGroup.airportCodes.length })}`
                      : ""}
                    {` · ${localizedText(airport.countryName, locale)}`}
                  </small>
                </button>
              );
            })
          ) : (
            <p>{t("flightEditor.noAirportResults")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
