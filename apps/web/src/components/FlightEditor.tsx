import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight } from "@keepraw-fly/schema";
import {
  airlineNames,
  autoMatchedMembership,
  isStandardTicketNumber,
  membershipsForAirline,
  resolveAirline,
  type FrequentFlyerMembership,
  type SupportedLocale,
} from "@keepraw-fly/core";
import { AirportCombobox } from "./AirportCombobox";
import {
  createDefaultDraft,
  flightFromDraft,
  flightToDraft,
  normalizeFlightNumberInput,
  splitFlightNumberInput,
  type FlightDraft,
} from "../data/flight-editor";

interface FlightEditorProps {
  flight?: KeeprawFlight;
  locale: SupportedLocale;
  onSave: (flight: KeeprawFlight) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onCancel: () => void;
  isDuplicate?: boolean;
  preferredAirportCodes?: readonly string[];
  returnFocus?: HTMLElement | null;
  memberships?: readonly FrequentFlyerMembership[];
}

export function FlightEditor({ flight, locale, onSave, onDelete, onCancel, isDuplicate = false, preferredAirportCodes = [], returnFocus, memberships = [] }: FlightEditorProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<FlightDraft>(() =>
    flight ? flightToDraft(flight, { duplicate: isDuplicate, memberships }) : createDefaultDraft(),
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const errorId = useId();
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
      )].filter((element) => !element.hidden);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.setTimeout(() => {
        if (!document.querySelector('[role="dialog"]') && returnFocus?.isConnected) {
          returnFocus.focus();
        }
      }, 0);
    };
  }, [onCancel, returnFocus]);
  const identity = splitFlightNumberInput(draft.flightNumber);
  const selectedAirline = identity ? resolveAirline(identity.airline) : undefined;
  const airlineNamePair = selectedAirline ? airlineNames(selectedAirline, locale) : null;
  const matchingMemberships = identity ? membershipsForAirline(memberships, identity.airline) : [];

  function update<Key extends keyof FlightDraft>(key: Key, value: FlightDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function updateFlightNumber(value: string) {
    const upper = value.toUpperCase();
    const parsed = splitFlightNumberInput(upper);
    setDraft((current) => {
      if (!parsed) return { ...current, flightNumber: upper };
      const currentMembership = memberships.find((item) => item.id === current.frequentFlyerMembershipId);
      if (currentMembership && membershipsForAirline([currentMembership], parsed.airline).length) {
        return { ...current, flightNumber: upper };
      }
      const match = autoMatchedMembership(memberships, parsed.airline);
      return match ? {
        ...current,
        flightNumber: upper,
        frequentFlyerMembershipId: match.id,
        frequentFlyerProgramName: match.programName,
        frequentFlyerMemberNumber: match.memberNumber,
        frequentFlyerTier: match.tier ?? "",
      } : {
        ...current,
        flightNumber: upper,
        frequentFlyerMembershipId: "",
        frequentFlyerProgramName: "",
        frequentFlyerMemberNumber: "",
        frequentFlyerTier: "",
      };
    });
    setError(null);
  }

  function selectMembership(id: string) {
    const membership = memberships.find((item) => item.id === id);
    setDraft((current) => membership ? {
      ...current,
      frequentFlyerMembershipId: membership.id,
      frequentFlyerProgramName: membership.programName,
      frequentFlyerMemberNumber: membership.memberNumber,
      frequentFlyerTier: membership.tier ?? "",
    } : {
      ...current,
      frequentFlyerMembershipId: "",
      frequentFlyerProgramName: "",
      frequentFlyerMemberNumber: "",
      frequentFlyerTier: "",
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.originIata === draft.destinationIata) {
      setError(t("flightEditor.sameAirport"));
      return;
    }
    try {
      const nextFlight = flightFromDraft(draft, isDuplicate ? undefined : flight);
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
          : message === "invalid-flight-number"
            ? t("flightEditor.invalidFlightNumber")
              : message === "invalid-booking-class"
                ? t("flightEditor.invalidBookingClass")
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
      <section ref={dialogRef} className="flight-editor" role="dialog" aria-modal="true" aria-labelledby="flight-editor-title">
        <div className="editor-heading">
          <div>
            <p className="eyebrow">{t("flightEditor.eyebrow")}</p>
            <h2 id="flight-editor-title">{t(isDuplicate ? "flightEditor.duplicateTitle" : flight ? "flightEditor.editTitle" : "flightEditor.addTitle")}</h2>
          </div>
          <button type="button" className="editor-close" onClick={onCancel} aria-label={t("actions.cancel")}>×</button>
        </div>

        <form onSubmit={submit} aria-describedby={error ? errorId : undefined}>
          <div className="editor-grid">
            <p className="editor-group-title">{t("flightEditor.flightSection")}</p>
            <label className="editor-field-wide">
              <span>{t("flightEditor.flightNumber")}</span>
              <input
                required
                value={draft.flightNumber}
                onChange={(event) => updateFlightNumber(event.target.value)}
                onBlur={() => update("flightNumber", normalizeFlightNumberInput(draft.flightNumber))}
                placeholder="ZH9911"
                autoFocus
              />
              <small className="editor-field-hint">
                {airlineNamePair
                  ? `${selectedAirline!.iata} / ${selectedAirline!.icao} · ${airlineNamePair[0]} · ${airlineNamePair[1]}`
                  : identity ? t("flightEditor.unknownAirlineHint") : t("flightEditor.flightNumberHint")}
              </small>
            </label>
            <p className="editor-group-title">{t("flightEditor.routeSection")}</p>
            <AirportCombobox label={t("flightEditor.origin")} locale={locale} value={draft.originIata} onChange={(iata) => update("originIata", iata)} preferredCodes={preferredAirportCodes} />
            <AirportCombobox label={t("flightEditor.destination")} locale={locale} value={draft.destinationIata} onChange={(iata) => update("destinationIata", iata)} preferredCodes={preferredAirportCodes} />
          </div>

          <fieldset className="editor-schedule">
            <legend>{t("flightEditor.schedule")}</legend>
            <label><span>{t("flightEditor.departureDate")}</span><input required type="date" value={draft.serviceDate} onChange={(event) => update("serviceDate", event.target.value)} /></label>
            <label><span>{t("flightEditor.departureTime")}</span><input required type="time" value={draft.departureTime} onChange={(event) => update("departureTime", event.target.value)} /></label>
            <label><span>{t("flightEditor.arrivalDate")}</span><input required type="date" value={draft.arrivalDate} onChange={(event) => update("arrivalDate", event.target.value)} /></label>
            <label><span>{t("flightEditor.arrivalTime")}</span><input required type="time" value={draft.arrivalTime} onChange={(event) => update("arrivalTime", event.target.value)} /></label>
          </fieldset>
          <p className="editor-time-note">{t("flightEditor.localTimeNote")}</p>

          <fieldset className="editor-facts-grid editor-travel-grid">
            <legend>{t("flightEditor.ticketAndLoyalty")}</legend>
            <label>
              <span>{t("flightEditor.ticketNumber")}</span>
              <input value={draft.ticketNumber} onChange={(event) => update("ticketNumber", event.target.value)} placeholder="781-1234567890" />
              {draft.ticketNumber && !isStandardTicketNumber(draft.ticketNumber) ? <small className="editor-field-warning">{t("flightEditor.nonstandardTicket")}</small> : null}
            </label>
            <label>
              <span>{t("flightEditor.frequentFlyerPlan")}</span>
              <select value={draft.frequentFlyerMembershipId} onChange={(event) => selectMembership(event.target.value)}>
                <option value="">{t("flightEditor.noFrequentFlyer")}</option>
                {memberships.map((membership) => <option value={membership.id} key={membership.id}>{membership.programName} · {membership.memberNumber}</option>)}
              </select>
              {matchingMemberships.length > 1 && !draft.frequentFlyerMembershipId ? <small className="editor-field-hint">{t("flightEditor.multipleMemberships")}</small> : null}
            </label>
            <label><span>{t("flightEditor.memberNumber")}</span><input value={draft.frequentFlyerMemberNumber} readOnly /></label>
            <label><span>{t("flightEditor.tier")}</span><input value={draft.frequentFlyerTier} onChange={(event) => update("frequentFlyerTier", event.target.value)} /></label>
          </fieldset>

          <details className="editor-optional">
            <summary>
              <span>{t("flightEditor.flightInformation")}</span>
              <small>{t("flightEditor.optionalFactsDescription")}</small>
            </summary>

            <fieldset className="editor-schedule editor-actual-times">
              <legend>{t("flightEditor.actualTimes")}</legend>
              <label><span>{t("flightEditor.actualDepartureDate")}</span><input type="date" value={draft.actualDepartureDate} onChange={(event) => update("actualDepartureDate", event.target.value)} /></label>
              <label><span>{t("flightEditor.actualDepartureTime")}</span><input type="time" value={draft.actualDepartureTime} onChange={(event) => update("actualDepartureTime", event.target.value)} /></label>
              <label><span>{t("flightEditor.actualArrivalDate")}</span><input type="date" value={draft.actualArrivalDate} onChange={(event) => update("actualArrivalDate", event.target.value)} /></label>
              <label><span>{t("flightEditor.actualArrivalTime")}</span><input type="time" value={draft.actualArrivalTime} onChange={(event) => update("actualArrivalTime", event.target.value)} /></label>
            </fieldset>

            <fieldset className="editor-facts-grid editor-airport-grid">
              <legend>{t("flightEditor.airportFacts")}</legend>
              <label><span>{t("flightEditor.originTerminal")}</span><input value={draft.originTerminal} onChange={(event) => update("originTerminal", event.target.value)} /></label>
              <label><span>{t("flightEditor.originGate")}</span><input value={draft.originGate} onChange={(event) => update("originGate", event.target.value)} /></label>
              <label><span>{t("flightEditor.destinationTerminal")}</span><input value={draft.destinationTerminal} onChange={(event) => update("destinationTerminal", event.target.value)} /></label>
            </fieldset>

            <fieldset className="editor-facts-grid editor-baggage-grid">
              <legend>{t("flightEditor.baggageFacts")}</legend>
              <label>
                <span>{t("flightEditor.checkedBaggage")}</span>
                <select
                  value={draft.baggageStatus}
                  onChange={(event) => update("baggageStatus", event.target.value as FlightDraft["baggageStatus"])}
                >
                  <option value="">{t("flightEditor.notRecorded")}</option>
                  <option value="not-checked">{t("flightEditor.noCheckedBaggage")}</option>
                  <option value="checked">{t("flightEditor.hasCheckedBaggage")}</option>
                </select>
              </label>
              {draft.baggageStatus === "checked" ? <label>
                <span>{t("flightEditor.baggageCarousel")}</span>
                <input value={draft.baggageCarousel} onChange={(event) => update("baggageCarousel", event.target.value.toUpperCase())} />
              </label> : null}
            </fieldset>

            <fieldset className="editor-facts-grid editor-onboard-grid">
              <legend>{t("flightEditor.onboardFacts")}</legend>
              <label><span>{t("flightEditor.aircraftType")}</span><input value={draft.aircraftType} onChange={(event) => update("aircraftType", event.target.value.toUpperCase())} placeholder="B789" /></label>
              <label><span>{t("flightEditor.aircraftRegistration")}</span><input value={draft.aircraftRegistration} onChange={(event) => update("aircraftRegistration", event.target.value.toUpperCase())} /></label>
              <label><span>{t("flightEditor.seat")}</span><input value={draft.seat} onChange={(event) => update("seat", event.target.value.toUpperCase())} placeholder="12A" /></label>
              <label>
                <span>{t("flightEditor.bookingClass")}</span>
                <input
                  maxLength={1}
                  pattern="[A-Za-z]"
                  value={draft.bookingClass}
                  onChange={(event) => update("bookingClass", event.target.value.toUpperCase())}
                  placeholder="P"
                />
              </label>
              <label>
                <span>{t("flightEditor.cabinClass")}</span>
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
          {error ? <p className="editor-error" id={errorId} role="alert">{error}</p> : null}

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
