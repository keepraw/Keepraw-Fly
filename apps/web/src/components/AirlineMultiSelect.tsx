import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  airlineNames,
  canonicalAirlineCode,
  resolveAirline,
  searchAirlines,
  type AirlineReference,
  type SupportedLocale,
} from "@keepraw-fly/core";

interface AirlineMultiSelectProps {
  label: string;
  locale: SupportedLocale;
  value: readonly string[];
  onChange: (codes: string[]) => void;
}

export function AirlineMultiSelect({ label, locale, value, onChange }: AirlineMultiSelectProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedCodes = useMemo(() => new Set(value), [value]);
  const results = useMemo(() => searchAirlines(query)
    .filter((airline) => !selectedCodes.has(canonicalAirlineCode(airline)))
    .slice(0, 8), [query, selectedCodes]);

  useEffect(() => setActiveIndex(0), [query, locale]);

  function chooseAirline(airline: AirlineReference) {
    const code = canonicalAirlineCode(airline);
    if (!selectedCodes.has(code)) onChange([...value, code]);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function removeAirline(code: string) {
    onChange(value.filter((item) => item !== code));
    inputRef.current?.focus();
  }

  return (
    <div className="airline-multi-select">
      <label htmlFor={inputId}>{label}</label>
      <div className="airline-chip-input" onClick={() => inputRef.current?.focus()}>
        {value.map((code) => {
          const airline = resolveAirline(code);
          const name = airline ? airlineNames(airline, locale)[0] : code;
          return <span className="airline-chip" data-airline-code={code} key={code}>
            <strong>{code}</strong><i aria-hidden="true">·</i><span>{name}</span>
            <button type="button" onClick={(event) => { event.stopPropagation(); removeAirline(code); }} aria-label={t("settings.removeAssociatedAirline", { code, name })}>×</button>
          </span>;
        })}
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && Boolean(query)}
          aria-activedescendant={open && results[activeIndex] ? `${listId}-${canonicalAirlineCode(results[activeIndex])}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={query}
          placeholder={t("settings.airlineSearchPlaceholder")}
          onFocus={() => setOpen(Boolean(query.trim()))}
          onBlur={() => setOpen(false)}
          onChange={(event) => { setQuery(event.target.value); setOpen(Boolean(event.target.value.trim())); }}
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
              chooseAirline(results[activeIndex]);
            } else if (event.key === "Backspace" && !query && value.length) {
              removeAirline(value.at(-1)!);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
      </div>
      {open && query.trim() ? <div className="airline-options" id={listId} role="listbox">
        {results.length ? results.map((airline, index) => {
          const code = canonicalAirlineCode(airline);
          const [primaryName, secondaryName] = airlineNames(airline, locale);
          return <button
            id={`${listId}-${code}`}
            key={code}
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => { event.preventDefault(); chooseAirline(airline); }}
          >
            <strong>{code}</strong><span>{primaryName}</span><small>{airline.icao} · {secondaryName}</small>
          </button>;
        }) : <p>{t("settings.noAirlineResults")}</p>}
      </div> : null}
    </div>
  );
}
