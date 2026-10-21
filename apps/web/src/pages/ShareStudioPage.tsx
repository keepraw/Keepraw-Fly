import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import type { DistanceUnit, SupportedLocale } from "@keepraw-fly/core";
import { PageShell } from "../components/PageShell";
import {
  buildPosterModel,
  posterYears,
  type PosterAspect,
  type PosterPrivacy,
  type PosterTemplate,
} from "../share/poster-data";
import { buildPosterCopy, type PosterCopy } from "../share/poster-copy";
import {
  createPosterLayout,
  defaultPosterAspect,
} from "../share/poster-layout";
import {
  downloadPosterBlob,
  exportPosterPng,
  posterFilename,
  renderPosterToCanvas,
} from "../share/poster-export";
import {
  prepareShareFonts,
  shareFontFamily,
  shareLocaleForLanguage,
  type ShareFonts,
} from "../share/share-text";
import type { ShareScope } from "../share/share-model";

interface ShareStudioPageProps {
  document: KeeprawFlyDocument;
  locale: SupportedLocale;
  distanceUnit: DistanceUnit;
  onBack: () => void;
}

type ExportState =
  | { status: "idle" }
  | { status: "exporting" }
  | { status: "done"; width: number; height: number }
  | { status: "error" };

/** Every glyph the poster may draw, so unicode-range webfont subsets load. */
function copySample(copy: PosterCopy) {
  return [
    copy.title,
    copy.scopeLabel,
    copy.distance.label,
    copy.distance.unit ?? "",
    copy.flights.label,
    copy.duration.label,
    copy.duration.value,
    copy.chart.title,
    copy.chart.emptyText,
    ...copy.chart.labels,
    ...copy.secondary.map((stat) => stat.label),
    ...copy.highlights.flatMap((stat) => [
      stat.label,
      stat.value,
      stat.unit ?? "",
    ]),
    ...(copy.airports?.rows.map((row) => row.name) ?? []),
    copy.airports?.title ?? "",
    ...copy.notes,
    copy.span?.label ?? "",
    copy.map.note ?? "",
    copy.activeMonths?.label ?? "",
    copy.stamp.bottom,
  ].join("");
}

/** Phones open on 3:4, wider screens on 4:3; the user can switch. */
function initialAspect(): PosterAspect {
  const narrow =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 760px)").matches;
  return defaultPosterAspect(narrow);
}

export function ShareStudioPage({
  document,
  locale,
  distanceUnit,
  onBack,
}: ShareStudioPageProps) {
  const { t } = useTranslation();
  const years = useMemo(
    () => posterYears(document.flights),
    [document.flights],
  );
  const [template, setTemplate] = useState<PosterTemplate>("passport");
  const [scope, setScope] = useState<ShareScope>({ kind: "lifetime" });
  const [aspect, setAspect] = useState<PosterAspect>(initialAspect);
  // Each step is its own explicit opt-in; both start off.
  const [showRoutes, setShowRoutes] = useState(false);
  const [showAirports, setShowAirports] = useState(false);
  const privacy: PosterPrivacy = !showRoutes
    ? "overview"
    : showAirports
      ? "airports"
      : "routes";
  const [exportState, setExportState] = useState<ExportState>({
    status: "idle",
  });
  const exportingRef = useRef(false);

  // A year that no longer has flights (archive edited elsewhere) is invalid.
  const yearValid = scope.kind === "lifetime" || years.includes(scope.year);
  const blocked = !years.length
    ? t("share.noFlights")
    : !yearValid && scope.kind === "year"
      ? t("share.noYearFlights", { year: scope.year })
      : template === "year" && scope.kind === "lifetime"
        ? t("share.yearRequired")
        : null;

  const model = useMemo(
    () =>
      buildPosterModel(document.flights, { template, scope, privacy, locale }),
    [document.flights, template, scope, privacy, locale],
  );
  const copy = useMemo(
    () => buildPosterCopy(model, t, locale, distanceUnit),
    [model, t, locale, distanceUnit],
  );
  const layout = useMemo(
    () => createPosterLayout(template, aspect),
    [template, aspect],
  );

  const shareLocale = shareLocaleForLanguage(locale);
  const sample = useMemo(() => copySample(copy), [copy]);
  const [fonts, setFonts] = useState<ShareFonts>(() => ({
    locale: shareLocale,
    family: shareFontFamily(shareLocale, false),
    status: "fallback",
  }));
  const [fontsReady, setFontsReady] = useState(false);
  const fontsRequest = useRef<Promise<ShareFonts> | null>(null);
  useEffect(() => {
    let active = true;
    setFontsReady(false);
    const request = prepareShareFonts(shareLocale, { sample });
    fontsRequest.current = request;
    void request.then((result) => {
      if (!active) return;
      setFonts(result);
      setFontsReady(true);
    });
    return () => {
      active = false;
    };
  }, [shareLocale, sample]);

  function chooseTemplate(next: PosterTemplate) {
    setTemplate(next);
    setExportState({ status: "idle" });
    if (next === "year" && scope.kind === "lifetime" && years[0] !== undefined)
      setScope({ kind: "year", year: years[0] });
  }

  // Preview: same draw function and layout, rendered at display resolution.
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setFrameWidth(frame.clientWidth);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [blocked]);
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || blocked || !frameWidth) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.max(
      270,
      Math.min(layout.width, Math.round(frameWidth * ratio)),
    );
    try {
      const report = renderPosterToCanvas(
        canvas,
        { layout, copy, fonts },
        pixelWidth,
      );
      canvas.dataset.mapRoutes = String(report.map.routes);
      canvas.dataset.mapAirports = String(report.map.airports);
      canvas.dataset.previewReady = fontsReady ? "true" : "false";
    } catch {
      canvas.dataset.previewReady = "error";
    }
  }, [layout, copy, fonts, fontsReady, frameWidth, blocked]);

  async function download() {
    if (blocked || exportingRef.current) return;
    exportingRef.current = true;
    setExportState({ status: "exporting" });
    try {
      const ready = await (fontsRequest.current ??
        prepareShareFonts(shareLocale, { sample }));
      const result = await exportPosterPng({ layout, copy, fonts: ready });
      downloadPosterBlob(
        result.blob,
        posterFilename({ template, scope, aspect }),
      );
      setExportState({
        status: "done",
        width: result.width,
        height: result.height,
      });
    } catch {
      setExportState({ status: "error" });
    } finally {
      exportingRef.current = false;
    }
  }

  const optionGroup = <T extends string>(
    name: string,
    legend: string,
    value: T,
    options: Array<{
      value: T;
      label: string;
      hint?: string;
      disabled?: boolean;
    }>,
    onChange: (value: T) => void,
  ) => (
    <fieldset className="share-studio-field">
      <legend>{legend}</legend>
      <div
        className={`share-studio-options${options.some((o) => o.hint) ? " share-studio-options--stacked" : ""}`}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className="share-studio-option"
            data-checked={option.value === value}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={option.disabled}
              onChange={() => {
                setExportState({ status: "idle" });
                onChange(option.value);
              }}
            />
            <span className="share-studio-option-label">{option.label}</span>
            {option.hint ? (
              <span className="share-studio-option-hint">{option.hint}</span>
            ) : null}
          </label>
        ))}
      </div>
    </fieldset>
  );

  const scopeValue = scope.kind === "lifetime" ? "lifetime" : "year";
  const status =
    exportState.status === "exporting"
      ? t("share.exporting")
      : exportState.status === "done"
        ? t("share.exported", {
            width: exportState.width,
            height: exportState.height,
          })
        : exportState.status === "error"
          ? t("share.exportFailed")
          : "";

  return (
    <PageShell className="share-studio-page">
      <header className="share-studio-heading">
        <button className="share-studio-back" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span>
          {t("share.back")}
        </button>
        <h1>{t("share.studioTitle")}</h1>
        <p>{t("share.studioDescription")}</p>
      </header>
      <div className="share-studio-layout">
        <section
          className="share-studio-preview"
          aria-label={t("share.preview")}
        >
          <div
            className="share-studio-frame"
            ref={frameRef}
            data-aspect={aspect}
            data-template={template}
          >
            {blocked ? (
              <p className="share-studio-blocked" role="alert">
                {blocked}
              </p>
            ) : (
              <canvas
                ref={previewRef}
                className="share-studio-canvas"
                role="img"
                aria-label={t("share.previewLabel", {
                  title: copy.title,
                  scope: copy.scopeLabel,
                })}
                data-template={template}
                data-aspect={aspect}
                data-privacy={privacy}
              />
            )}
          </div>
        </section>
        <form
          className="share-studio-controls"
          aria-label={t("share.settingsLabel")}
          onSubmit={(event) => {
            event.preventDefault();
            void download();
          }}
        >
          {optionGroup(
            "share-template",
            t("share.template"),
            template,
            [
              { value: "passport", label: t("share.templatePassport") },
              { value: "year", label: t("share.templateYear") },
            ],
            chooseTemplate,
          )}
          <fieldset className="share-studio-field">
            <legend>{t("share.range")}</legend>
            <div className="share-studio-options">
              <label
                className="share-studio-option"
                data-checked={scopeValue === "lifetime"}
              >
                <input
                  type="radio"
                  name="share-range"
                  value="lifetime"
                  checked={scopeValue === "lifetime"}
                  disabled={template === "year"}
                  onChange={() => {
                    setExportState({ status: "idle" });
                    setScope({ kind: "lifetime" });
                  }}
                />
                <span className="share-studio-option-label">
                  {t("share.lifetime")}
                </span>
              </label>
              <label
                className="share-studio-option"
                data-checked={scopeValue === "year"}
              >
                <input
                  type="radio"
                  name="share-range"
                  value="year"
                  checked={scopeValue === "year"}
                  disabled={!years.length}
                  onChange={() => {
                    setExportState({ status: "idle" });
                    if (years[0] !== undefined)
                      setScope({ kind: "year", year: years[0] });
                  }}
                />
                <span className="share-studio-option-label">
                  {t("share.year")}
                </span>
              </label>
            </div>
            {scope.kind === "year" ? (
              <label className="share-studio-select">
                <span className="sr-only">{t("share.year")}</span>
                <select
                  value={scope.year}
                  onChange={(event) => {
                    setExportState({ status: "idle" });
                    setScope({
                      kind: "year",
                      year: Number(event.target.value),
                    });
                  }}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {template === "year" ? (
              <p className="share-studio-note">{t("share.yearRequired")}</p>
            ) : null}
          </fieldset>
          {optionGroup(
            "share-aspect",
            t("share.aspect"),
            aspect,
            [
              {
                value: "3:4",
                label: t("share.aspectPortrait"),
                hint: t("share.aspectPortraitHint"),
              },
              {
                value: "4:3",
                label: t("share.aspectLandscape"),
                hint: t("share.aspectLandscapeHint"),
              },
            ],
            setAspect,
          )}
          <fieldset className="share-studio-field">
            <legend>{t("share.privacy")}</legend>
            <div className="share-studio-options share-studio-options--stacked">
              <label
                className="share-studio-option share-studio-toggle"
                data-checked={showRoutes}
              >
                <input
                  type="checkbox"
                  name="share-routes"
                  checked={showRoutes}
                  onChange={(event) => {
                    setExportState({ status: "idle" });
                    setShowRoutes(event.target.checked);
                    // Revoking routes also revokes the airport grant.
                    if (!event.target.checked) setShowAirports(false);
                  }}
                />
                <span className="share-studio-option-label">
                  {t("share.privacyRoutes")}
                </span>
                <span className="share-studio-option-hint">
                  {t("share.privacyRoutesHint")}
                </span>
              </label>
              <label
                className="share-studio-option share-studio-toggle"
                data-checked={showAirports}
              >
                <input
                  type="checkbox"
                  name="share-airports"
                  checked={showAirports}
                  disabled={!showRoutes}
                  onChange={(event) => {
                    setExportState({ status: "idle" });
                    setShowAirports(event.target.checked);
                  }}
                />
                <span className="share-studio-option-label">
                  {t("share.privacyAirports")}
                </span>
                <span className="share-studio-option-hint">
                  {t("share.privacyAirportsHint")}
                </span>
              </label>
            </div>
            <p className="share-studio-note" data-privacy-note={privacy}>
              {t(
                privacy === "overview"
                  ? "share.privacyOverviewHint"
                  : "share.privacyLocalHint",
              )}
            </p>
          </fieldset>
          <div className="share-studio-actions">
            <button
              className="button-primary share-studio-download"
              type="submit"
              disabled={Boolean(blocked) || exportState.status === "exporting"}
            >
              {t("share.download")}
            </button>
            <p
              className="share-studio-status"
              role="status"
              aria-live="polite"
              data-status={exportState.status}
            >
              {status}
            </p>
            {fontsReady && fonts.status === "fallback" ? (
              <p className="share-studio-note">{t("share.fontFallback")}</p>
            ) : null}
          </div>
        </form>
      </div>
    </PageShell>
  );
}
