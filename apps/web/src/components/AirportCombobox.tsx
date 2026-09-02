import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  airportByIata,
  airportCityGroupForAirport,
  airportCityGroupName,
  searchAirports,
  type AirportReference,
  type SupportedLocale,
} from "@keepraw-fly/core";

interface AirportComboboxProps {
  label: string;
  locale: SupportedLocale;
  value: string;
  onChange: (iata: string) => void;
}

export function AirportCombobox({ label, locale, value, onChange }: AirportComboboxProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => searchAirports(query, locale), [query, locale]);
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

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);
    const exactAirport = airportByIata.get(nextQuery.trim().toUpperCase());
    onChange(exactAirport?.iata ?? "");
    setOpen(true);
  }

  return (
    <div className="airport-combobox">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        required
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && Boolean(query.trim())}
        aria-activedescendant={open && results[activeIndex] ? `${listId}-${results[activeIndex].iata}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={query}
        placeholder={t("flightEditor.airportSearchPlaceholder")}
        onFocus={() => setOpen(true)}
        onChange={(event) => updateQuery(event.target.value)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && results.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((current) => Math.min(current + 1, results.length - 1));
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
        {selectedAirport
          ? `${selectedAirport.iata} · ${selectedAirport.name[locale]} · ${selectedCityGroup ? airportCityGroupName(selectedCityGroup, locale) : selectedAirport.city[locale]}`
          : t("flightEditor.airportSearchHint")}
      </small>
      {open && query.trim() ? (
        <div className="airport-options" id={listId} role="listbox">
          {results.length ? results.map((airport, index) => {
            const cityGroup = airportCityGroupForAirport(airport.iata);
            const cityName = cityGroup
              ? airportCityGroupName(cityGroup, locale)
              : airport.city[locale];
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
              <span>{airport.name[locale]}</span>
              <small>
                {cityName}
                {cityGroup ? ` · ${t("flightEditor.multiAirportCount", { count: cityGroup.airportCodes.length })}` : ""}
                {` · ${airport.countryName[locale]}`}
              </small>
            </button>
            );
          }) : <p>{t("flightEditor.noAirportResults")}</p>}
        </div>
      ) : null}
    </div>
  );
}
