import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import { airlines, type SupportedLocale } from "@keepraw-fly/core";
import { AirportCombobox } from "./AirportCombobox";
import {
  createDefaultDraft,
  flightFromDraft,
  flightToDraft,
  splitFlightNumberInput,
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
  const airlineListId = useId();
  const airlineOptions = useMemo(
    () => [...airlines].sort((left, right) => left.name[locale].localeCompare(right.name[locale], locale)),
    [locale],
  );
  const selectedAirline = airlineOptions.find((airline) => airline.iata === draft.airlineCode);
  const fullFlightNumber = draft.airlineCode && draft.serviceNumber
    ? `${draft.airlineCode}${draft.serviceNumber}`
    : null;

  function update<Key extends keyof FlightDraft>(key: Key, value: FlightDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function updateServiceNumber(value: string) {
    const normalized = value.toUpperCase();
    const pastedIdentity = splitFlightNumberInput(normalized);
    setDraft((current) => pastedIdentity
      ? { ...current, ...pastedIdentity }
      : { ...current, serviceNumber: normalized });
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
      const message = caught instanceof Error ? caught.message : "";
      setError(message === "arrival-before-departure"
        ? t("flightEditor.arrivalBeforeDeparture")
        : message === "actual-arrival-before-departure"
          ? t("flightEditor.actualArrivalBeforeDeparture")
          : message === "incomplete-actual-time"
          ? t("flightEditor.incompleteActualTime")
          : message === "invalid-airline-code"
            ? t("flightEditor.invalidAirlineCode")
            : message === "invalid-service-number"
              ? t("flightEditor.invalidServiceNumber")
              : message === "unknown-airport"
                ? t("flightEditor.unknownAirport")
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
              <span>{t("flightEditor.airlineCode")}</span>
              <input
                required
                list={airlineListId}
                maxLength={3}
                value={draft.airlineCode}
                onChange={(event) => update("airlineCode", event.target.value.toUpperCase().replace(/\s+/g, ""))}
                placeholder="MU"
                autoFocus
              />
              <datalist id={airlineListId}>
                {airlineOptions.map((airline) => <option value={airline.iata} key={airline.iata}>{airline.name[locale]}</option>)}
              </datalist>
              <small className="editor-field-hint">
                {selectedAirline
                  ? `${selectedAirline.iata} · ${selectedAirline.name[locale]}`
                  : t("flightEditor.airlineCodeHint")}
              </small>
            </label>
            <label>
              <span>{t("flightEditor.serviceNumber")}</span>
              <input required value={draft.serviceNumber} onChange={(event) => updateServiceNumber(event.target.value)} placeholder="589" />
              <small className="editor-field-hint">
                {fullFlightNumber
                  ? t("flightEditor.fullFlightNumber", { number: fullFlightNumber })
                  : t("flightEditor.serviceNumberHint")}
              </small>
            </label>
            <AirportCombobox label={t("flightEditor.origin")} locale={locale} value={draft.originIata} onChange={(iata) => update("originIata", iata)} />
            <AirportCombobox label={t("flightEditor.destination")} locale={locale} value={draft.destinationIata} onChange={(iata) => update("destinationIata", iata)} />
          </div>

          <fieldset className="editor-schedule">
            <legend>{t("flightEditor.schedule")}</legend>
            <label><span>{t("flightEditor.departureDate")}</span><input required type="date" value={draft.serviceDate} onChange={(event) => update("serviceDate", event.target.value)} /></label>
            <label><span>{t("flightEditor.departureTime")}</span><input required type="time" value={draft.departureTime} onChange={(event) => update("departureTime", event.target.value)} /></label>
            <label><span>{t("flightEditor.arrivalDate")}</span><input required type="date" value={draft.arrivalDate} onChange={(event) => update("arrivalDate", event.target.value)} /></label>
            <label><span>{t("flightEditor.arrivalTime")}</span><input required type="time" value={draft.arrivalTime} onChange={(event) => update("arrivalTime", event.target.value)} /></label>
          </fieldset>
          <p className="editor-time-note">{t("flightEditor.localTimeNote")}</p>

          <details className="editor-optional">
            <summary>
              <span>{t("flightEditor.optionalFacts")}</span>
              <small>{t("flightEditor.optionalFactsDescription")}</small>
            </summary>

            <fieldset className="editor-schedule editor-actual-times">
              <legend>{t("flightEditor.actualTimes")}</legend>
              <label><span>{t("flightEditor.actualDepartureDate")}</span><input type="date" value={draft.actualDepartureDate} onChange={(event) => update("actualDepartureDate", event.target.value)} /></label>
              <label><span>{t("flightEditor.actualDepartureTime")}</span><input type="time" value={draft.actualDepartureTime} onChange={(event) => update("actualDepartureTime", event.target.value)} /></label>
              <label><span>{t("flightEditor.actualArrivalDate")}</span><input type="date" value={draft.actualArrivalDate} onChange={(event) => update("actualArrivalDate", event.target.value)} /></label>
              <label><span>{t("flightEditor.actualArrivalTime")}</span><input type="time" value={draft.actualArrivalTime} onChange={(event) => update("actualArrivalTime", event.target.value)} /></label>
            </fieldset>

            <fieldset className="editor-facts-grid">
              <legend>{t("flightEditor.airportFacts")}</legend>
              <label><span>{t("flightEditor.originTerminal")}</span><input value={draft.originTerminal} onChange={(event) => update("originTerminal", event.target.value)} /></label>
              <label><span>{t("flightEditor.originGate")}</span><input value={draft.originGate} onChange={(event) => update("originGate", event.target.value)} /></label>
              <label><span>{t("flightEditor.destinationTerminal")}</span><input value={draft.destinationTerminal} onChange={(event) => update("destinationTerminal", event.target.value)} /></label>
              <label><span>{t("flightEditor.destinationGate")}</span><input value={draft.destinationGate} onChange={(event) => update("destinationGate", event.target.value)} /></label>
            </fieldset>

            <fieldset className="editor-facts-grid">
              <legend>{t("flightEditor.onboardFacts")}</legend>
              <label><span>{t("flightEditor.aircraftType")}</span><input value={draft.aircraftType} onChange={(event) => update("aircraftType", event.target.value.toUpperCase())} placeholder="B789" /></label>
              <label><span>{t("flightEditor.aircraftRegistration")}</span><input value={draft.aircraftRegistration} onChange={(event) => update("aircraftRegistration", event.target.value.toUpperCase())} /></label>
              <label><span>{t("flightEditor.seat")}</span><input value={draft.seat} onChange={(event) => update("seat", event.target.value.toUpperCase())} placeholder="12A" /></label>
              <label>
                <span>{t("flightEditor.cabin")}</span>
                <select value={draft.cabin} onChange={(event) => update("cabin", event.target.value)}>
                  <option value="">{t("flightEditor.notRecorded")}</option>
                  <option value="economy">{t("flightEditor.cabins.economy")}</option>
                  <option value="premium economy">{t("flightEditor.cabins.premiumEconomy")}</option>
                  <option value="business">{t("flightEditor.cabins.business")}</option>
                  <option value="first">{t("flightEditor.cabins.first")}</option>
                </select>
              </label>
            </fieldset>
          </details>
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
