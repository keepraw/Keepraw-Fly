import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import type { DistanceUnit, SupportedLocale } from "@keepraw-fly/core";
import { buildPosterModel } from "../share/poster-data";
import { buildPosterCopy, type PosterCopy } from "../share/poster-copy";
import { createPosterLayout } from "../share/poster-layout";
import { exportPosterPng } from "../share/poster-export";
import {
  PASSPORT_PROFILE_KEY,
  loadPassportProfile,
  savePassportProfile,
  normalizePassportName,
} from "../storage/passport-profile";
import {
  prepareShareFonts,
  shareLocaleForLanguage,
  type ShareFonts,
} from "../share/share-text";

interface FlightPassportShareDialogProps {
  document: KeeprawFlyDocument;
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
  onClose: () => void;
}

type ShareState =
  | { status: "generating" }
  | {
      status: "ready";
      url: string;
      width: number;
      height: number;
      routes: number;
      airports: number;
      truncated: number;
      fonts: ShareFonts["status"];
    }
  | { status: "error" };

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/** Every glyph the poster may draw, so unicode-range webfont subsets load. */
function copySample(copy: PosterCopy) {
  return [
    copy.holder.name,
    copy.recordTitle,
    copy.disclaimer,
    copy.brand,
    copy.title,
    copy.issuer,
    copy.distance.label,
    copy.distance.value,
    copy.distance.unit ?? "",
    copy.flights.label,
    copy.duration.label,
    copy.duration.value,
    copy.duration.unit ?? "",
    ...copy.secondary.map((stat) => stat.label),
    ...copy.notes,
    copy.span?.label ?? "",
    copy.map.note ?? "",
  ].join("");
}

/**
 * Share: generates the full-resolution Flight Passport PNG on this device and
 * shows it as a real <img> backed by a Blob URL, so the browser's own "Save
 * image as…" (desktop) and long-press save (phones) work unchanged. Nothing
 * here intercepts contextmenu or touch events on the image.
 */
export function FlightPassportShareDialog({
  document: archive,
  locale,
  distanceUnit,
  onClose,
}: FlightPassportShareDialogProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [identity, setIdentity] = useState(loadPassportProfile);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(identity.profile.name);
  const [saveFailed, setSaveFailed] = useState(false);

  // Always the complete archive: never Passport's year, search or airport.
  const model = useMemo(() => buildPosterModel(archive.flights), [archive]);
  const copy = useMemo(
    () => buildPosterCopy(model, t, locale, distanceUnit, identity.profile),
    [model, t, locale, distanceUnit, identity.profile],
  );
  const layout = useMemo(() => createPosterLayout(), []);
  const empty = model.statistics.flights === 0;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ShareState>({ status: "generating" });

  useEffect(() => {
    if (empty) return;
    let active = true;
    let url: string | null = null;
    setState({ status: "generating" });
    const shareLocale = shareLocaleForLanguage(locale);
    void (async () => {
      const fonts = await prepareShareFonts(shareLocale, {
        sample: copySample(copy),
      });
      const result = await exportPosterPng({ layout, copy, fonts });
      if (!active) return;
      url = URL.createObjectURL(result.blob);
      setState({
        status: "ready",
        url,
        width: result.width,
        height: result.height,
        routes: result.report.map.routes,
        airports: result.report.map.airports,
        truncated: result.report.truncated.length,
        fonts: fonts.status,
      });
    })().catch(() => {
      if (active) setState({ status: "error" });
    });
    // The URL lives exactly as long as the <img> that shows it: released on
    // close, unmount or retry, never before the image has been replaced.
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [empty, attempt, copy, layout, locale]);

  useEffect(() => {
    const returnFocus =
      window.document.activeElement instanceof HTMLElement
        ? window.document.activeElement
        : null;
    const appRoot = window.document.getElementById("root");
    const rootWasInert = appRoot?.inert ?? false;
    const previousAriaHidden = appRoot?.getAttribute("aria-hidden") ?? null;
    const html = window.document.documentElement;
    const previousOverflow = html.style.overflow;
    if (appRoot) {
      appRoot.inert = true;
      appRoot.setAttribute("aria-hidden", "true");
    }
    html.style.overflow = "hidden";
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && window.document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && window.document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialogRef.current.contains(window.document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.document.removeEventListener("keydown", handleKeyDown, true);
      html.style.overflow = previousOverflow;
      if (appRoot) {
        appRoot.inert = rootWasInert;
        if (previousAriaHidden === null) appRoot.removeAttribute("aria-hidden");
        else appRoot.setAttribute("aria-hidden", previousAriaHidden);
      }
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);

  // Keep local edits in sync when another tab saves the souvenir profile.
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== PASSPORT_PROFILE_KEY) return;
      setIdentity(loadPassportProfile());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const sizeLabel = `${layout.width} × ${layout.height}`;

  return createPortal(
    <div
      className="share-overlay-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        // Only a press on the backdrop itself closes; the image never does.
        if (event.button === 0 && event.target === event.currentTarget)
          onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="share-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-layout="top-bottom"
        data-editing={editing}
        data-status={empty ? "empty" : state.status}
      >
        <h2 id={titleId} className="sr-only">
          {copy.title}
        </h2>
        <div className="share-overlay-toolbar">
          <span aria-hidden="true">
            KEEPRAW FLY <small>/ DIGITAL TRAVEL JOURNAL</small>
          </span>
          <button
            type="button"
            className="share-profile-edit"
            onClick={() => {
              setDraftName(identity.profile.name);
              setSaveFailed(false);
              setEditing(!editing);
            }}
            aria-expanded={editing}
            aria-controls={editing ? "passport-profile-form" : undefined}
          >
            {t("share.journal.editName")}
          </button>
          <button
            ref={closeRef}
            className="share-overlay-close"
            type="button"
            aria-label={t("share.close")}
            onClick={onClose}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        {editing ? (
          <form
            id="passport-profile-form"
            className="share-profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              const name = normalizePassportName(draftName);
              if (!name) return;
              const profile = { ...identity.profile, name };
              if (!savePassportProfile(profile)) {
                setSaveFailed(true);
                return;
              }
              setIdentity({ profile, persisted: true });
              setEditing(false);
              closeRef.current?.focus();
            }}
          >
            <label htmlFor="passport-holder-name">
              {t("share.journal.holderName")}
            </label>
            <div className="share-profile-input-row">
              <input
                id="passport-holder-name"
                value={draftName}
                autoFocus
                autoComplete="off"
                maxLength={128}
                onChange={(event) => setDraftName(event.target.value)}
                aria-describedby="passport-name-hint"
              />
              <button
                type="submit"
                disabled={!normalizePassportName(draftName)}
              >
                {t("share.journal.saveName")}
              </button>
            </div>
            <p id="passport-name-hint">{t("share.journal.nameHint")}</p>
            {saveFailed ? (
              <p role="alert">{t("share.journal.storageError")}</p>
            ) : null}
          </form>
        ) : null}
        {!identity.persisted ? (
          <p className="share-profile-warning" role="status">
            {t("share.journal.storageError")}
          </p>
        ) : null}
        <div className="share-overlay-stage">
          {empty ? (
            <p className="share-overlay-message" role="alert">
              {t("share.noFlights")}
            </p>
          ) : state.status === "ready" ? (
            <img
              className="share-overlay-image"
              src={state.url}
              width={state.width}
              height={state.height}
              alt={t("share.imageAlt", {
                title: copy.title,
                size: sizeLabel,
              })}
              data-width={state.width}
              data-height={state.height}
              data-map-routes={state.routes}
              data-map-airports={state.airports}
              data-truncated={state.truncated}
              data-fonts={state.fonts}
            />
          ) : state.status === "error" ? (
            <div className="share-overlay-message" role="alert">
              <p>{t("share.exportFailed")}</p>
              <button
                className="button-primary share-overlay-retry"
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t("actions.retry")}
              </button>
            </div>
          ) : (
            <p
              className="share-overlay-message share-overlay-loading"
              role="status"
              aria-live="polite"
            >
              <span className="share-overlay-spinner" aria-hidden="true" />
              {t("share.generating")}
            </p>
          )}
        </div>
        <div className="sr-only" aria-live="polite">
          <p>
            {copy.holder.name} · {copy.holder.number}
          </p>
          <p>
            FIRST FLIGHT: {copy.firstFlight} · RECORD PERIOD:{" "}
            {copy.recordPeriod}
          </p>
          <p>
            {[
              copy.distance,
              copy.flights,
              copy.duration,
              ...copy.secondary,
              copy.routes,
            ]
              .map((stat) => `${stat.label}: ${stat.value} ${stat.unit ?? ""}`)
              .join(" · ")}
          </p>
          <p>{copy.disclaimer}</p>
        </div>
        {state.status === "ready" && !empty ? (
          <p className="share-overlay-hint">
            {state.fonts === "fallback"
              ? t("share.fontFallback")
              : t("share.saveHint")}
          </p>
        ) : null}
      </section>
    </div>,
    window.document.body,
  );
}
