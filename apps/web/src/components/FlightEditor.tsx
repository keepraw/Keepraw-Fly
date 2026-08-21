import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { airlines, airports, type SupportedLocale } from "@keepraw-fly/core";
import {
  createDefaultDraft,
  flightFromDraft,
  flightToDraft,
  type FlightDraft,
} from "../data/flight-editor";

interface FlightEditorProps {
  flight?: KeeprawFlight;
  locale: SupportedLocale;
  onSave: (flight: KeeprawFlight) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onCancel: () => void;
}

export function FlightEditor({ flight, locale, onSave, onDelete, onCancel }: FlightEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<FlightDraft>(() =>
    flight ? flightToDraft(flight) : createDefaultDraft(),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const airportOptions = useMemo(
    () => [...airports].sort((left, right) => left.city[locale].localeCompare(right.city[locale], locale)),
    [locale],
  );
  const airlineOptions = useMemo(
    () => [...airlines].sort((left, right) => left.name[locale].localeCompare(right.name[locale], locale)),
    [locale],
  );

  function update<Key extends keyof FlightDraft>(key: Key, value: FlightDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.originIata === draft.destinationIata) {
      setError(t("flightEditor.sameAirport"));
      return;
    }
    try {
      const nextFlight = flightFromDraft(draft, flight);
      setBusy(true);
      await onSave(nextFlight);
    } catch (caught) {
      setError(caught instanceof Error && caught.message === "arrival-before-departure"
        ? t("flightEditor.arrivalBeforeDeparture")
        : t("flightEditor.invalidFlight"));
      setBusy(false);
    }
  }

  return (
    <div className="editor-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <section className="flight-editor" role="dialog" aria-modal="true" aria-labelledby="flight-editor-title">
        <header className="editor-heading">
          <div>
            <p className="eyebrow">{t("flightEditor.eyebrow")}</p>
            <h2 id="flight-editor-title">{t(flight ? "flightEditor.editTitle" : "flightEditor.addTitle")}</h2>
          </div>
          <button type="button" className="editor-close" onClick={onCancel} aria-label={t("actions.cancel")}>×</button>
        </header>

        <form onSubmit={submit}>
          <div className="editor-grid">
            <label>
              <span>{t("flightEditor.flightNumber")}</span>
              <input required value={draft.flightNumber} onChange={(event) => update("flightNumber", event.target.value)} placeholder="MU 589" autoFocus />
            </label>
            <label>
              <span>{t("flightEditor.airline")}</span>
              <select required value={draft.airlineIata} onChange={(event) => update("airlineIata", event.target.value)}>
                <option value="">{t("flightEditor.chooseAirline")}</option>
                {airlineOptions.map((airline) => <option value={airline.iata} key={airline.iata}>{airline.iata} · {airline.name[locale]}</option>)}
              </select>
            </label>
            <label>
              <span>{t("flightEditor.origin")}</span>
              <select required value={draft.originIata} onChange={(event) => update("originIata", event.target.value)}>
                <option value="">{t("flightEditor.chooseAirport")}</option>
                {airportOptions.map((airport) => <option value={airport.iata} key={airport.iata}>{airport.iata} · {airport.city[locale]}</option>)}
              </select>
            </label>
            <label>
              <span>{t("flightEditor.destination")}</span>
              <select required value={draft.destinationIata} onChange={(event) => update("destinationIata", event.target.value)}>
                <option value="">{t("flightEditor.chooseAirport")}</option>
                {airportOptions.map((airport) => <option value={airport.iata} key={airport.iata}>{airport.iata} · {airport.city[locale]}</option>)}
              </select>
            </label>
          </div>

          <fieldset className="editor-schedule">
            <legend>{t("flightEditor.schedule")}</legend>
            <label><span>{t("flightEditor.departureDate")}</span><input required type="date" value={draft.serviceDate} onChange={(event) => update("serviceDate", event.target.value)} /></label>
            <label><span>{t("flightEditor.departureTime")}</span><input required type="time" value={draft.departureTime} onChange={(event) => update("departureTime", event.target.value)} /></label>
            <label><span>{t("flightEditor.arrivalDate")}</span><input required type="date" value={draft.arrivalDate} onChange={(event) => update("arrivalDate", event.target.value)} /></label>
            <label><span>{t("flightEditor.arrivalTime")}</span><input required type="time" value={draft.arrivalTime} onChange={(event) => update("arrivalTime", event.target.value)} /></label>
          </fieldset>
          <p className="editor-time-note">{t("flightEditor.localTimeNote")}</p>
          {error ? <p className="editor-error" role="alert">{error}</p> : null}

          <footer className="editor-actions">
            {flight && onDelete ? <button className="editor-delete" type="button" onClick={() => {
              if (window.confirm(t("flightEditor.deleteConfirmation"))) void onDelete();
            }}>{t("actions.deleteFlight")}</button> : <span />}
            <div>
              <button className="button-secondary" type="button" onClick={onCancel}>{t("actions.cancel")}</button>
              <button className="button-primary" type="submit" disabled={busy}>{busy ? t("actions.saving") : t("actions.saveFlight")}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
