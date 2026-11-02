import { useEffect, useId, useMemo, useState } from "react";
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
import {
  loadAirportHistoryCodes,
  loadAirportHistorySearchIndex,
  useAirportHistoryVersion,
} from "../data/airport-history";

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
  if (result.kind === "candidate")
    return result.scheme === "IATA" ? result.code : null;
  const iata = result.assignments.filter((row) => row.scheme === "IATA");
  const atDate = date
    ? iata.find((row) => assignmentDateRelation(date, row) !== "excluded")
    : undefined;
  return (atDate ?? iata[0])?.code ?? null;
}

interface AirportComboboxProps {
  label: string;
  locale: SupportedLocale;
  value: string;
  onChange: (iata: string) => void;
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
  onChange,
  required = true,
  preferredCodes = [],
  date,
  role = "origin",
}: AirportComboboxProps) {
  const historyVersion = useAirportHistoryVersion();
  const { t } = useTranslation();
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
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
    [query, date, historyVersion],
  );
  const identity = useMemo(
    () => (value ? resolveEndpointIdentity(value, date || null, role) : null),
    [value, date, role, historyVersion],
  );
  useEffect(() => {
    if (value) void loadAirportHistoryCodes([value]);
  }, [value]);
  const selectedAirport = airportByIata.get(value);
  const selectedCityGroup = selectedAirport
    ? airportCityGroupForAirport(selectedAirport.iata)
    : undefined;

  useEffect(() => {
    if (value) setQuery(value);
  }, [value]);

  useEffect(() => setActiveIndex(0), [query, locale]);

  function chooseAirport(airport: AirportReference) {
    setQuery(airport.iata);
    onChange(airport.iata);
    setOpen(false);
  }

  function chooseCode(code: string) {
    setQuery(code);
    onChange(code);
    setOpen(false);
  }

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    // An exact directory code, or any well-formed code no directory knows: the
    // flight keeps the code and its historical identity is resolved by date.
    onChange(keepableCode(nextQuery) ?? "");
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
          void loadAirportHistorySearchIndex();
        }}
        onChange={(event) => updateQuery(event.target.value)}
        onBlur={() => setOpen(false)}
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
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <small className="editor-field-hint">
        {identity && value && date && !identity.confirmed ? (
          <span
            className="airport-history-hint"
            data-airport-history={identity.status}
          >
            {t(`flightEditor.airportHistory.${identity.status}`, {
              code: value,
              sites: identity.possiblePositions.length,
            })}
          </span>
        ) : identity?.differsFromCurrentDirectory && identity.name ? (
          <span
            className="airport-history-hint"
            data-airport-history="historical"
          >
            {t("flightEditor.airportHistory.historicalSite", {
              code: value,
              name: localizedText(identity.name, locale),
            })}
          </span>
        ) : selectedAirport ? (
          `${selectedAirport.iata} · ${localizedText(selectedAirport.name, locale)} · ${selectedCityGroup ? airportCityGroupName(selectedCityGroup, locale) : localizedText(selectedAirport.city, locale)}`
        ) : preferredCodes.length ? (
          t("flightEditor.airportRecentHint")
        ) : (
          t("flightEditor.airportSearchHint")
        )}
      </small>
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
                key={
                  result.kind === "formal"
                    ? result.airportId
                    : `${result.code}|${result.siteId}`
                }
                type="button"
                data-history-kind={result.kind}
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseCode(code);
                }}
              >
                <strong>{code}</strong>
                <span>
                  {result.kind === "formal" ? result.matchedName : result.name}
                </span>
                <small>
                  {t(
                    result.kind === "formal"
                      ? "flightEditor.airportHistory.formalOption"
                      : "flightEditor.airportHistory.candidateOption",
                  )}
                </small>
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
                  onMouseDown={(event) => {
                    event.preventDefault();
                    chooseAirport(airport);
                  }}
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
