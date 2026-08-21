import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import {
  groupFlightsByYear,
  searchFlights,
  type SupportedLocale,
} from "@keepraw-fly/core";
import { FlightRow } from "../components/FlightRow";

interface FlightsPageProps {
  document: KeeprawFlyDocument;
  locale: SupportedLocale;
}

export function FlightsPage({ document, locale }: FlightsPageProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const groups = useMemo(
    () => groupFlightsByYear(searchFlights(document.flights, query)),
    [document.flights, query],
  );

  return (
    <main className="flights-page" id="main-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{t("flights.archive")}</p>
          <h1>{t("nav.flights")}</h1>
        </div>
        <p className="flight-count">
          {t("flights.count", { count: document.flights.length })}
        </p>
      </div>

      <div className="search-field">
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <label className="sr-only" htmlFor="flight-search">
          {t("flights.searchLabel")}
        </label>
        <input
          id="flight-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("flights.searchPlaceholder")}
          autoComplete="off"
        />
        {query ? (
          <button
            className="clear-search"
            type="button"
            onClick={() => setQuery("")}
            aria-label={t("actions.clearSearch")}
          >
            ×
          </button>
        ) : null}
      </div>

      {groups.length ? (
        <div className="flight-groups" aria-live="polite">
          {groups.map((group) => (
            <section className="flight-year" key={group.year}>
              <div className="year-heading">
                <h2>{group.year}</h2>
                <span>{t("flights.count", { count: group.flights.length })}</span>
              </div>
              <div className="flight-list">
                {group.flights.map((flight) => (
                  <FlightRow key={flight.id} flight={flight} locale={locale} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="no-results" role="status">
          <h2>{t("flights.noResultsTitle")}</h2>
          <p>{t("flights.noResultsDescription", { query })}</p>
        </div>
      )}
    </main>
  );
}

