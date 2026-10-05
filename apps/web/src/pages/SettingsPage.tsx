import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument, ProfileName } from "@keepraw-fly/schema";
import {
  frequentFlyerMemberships,
  frequentFlyerProgramId,
  frequentFlyerProgramName,
  airlineNames,
  normalizeMembershipAirlines,
  resolveAirline,
  type FrequentFlyerMembership,
} from "@keepraw-fly/core";
import type { ViewerSettings } from "../storage/types";
import { ImportControl } from "../components/ImportControl";
import { CsvImportControl } from "../components/CsvImportControl";
import { FlightyImportControl } from "../components/FlightyImportControl";
import { PageShell } from "../components/PageShell";
import { AirlineMultiSelect } from "../components/AirlineMultiSelect";
import { ConfirmationDialog } from "../components/ConfirmationDialog";
import { persistentStorageState, requestPersistentStorage, type PersistentStorageState } from "../storage/browser";

interface SettingsPageProps {
  document: KeeprawFlyDocument | null;
  isDemo: boolean;
  settings: ViewerSettings;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
  onExport?: () => void | Promise<void>;
  onClear?: () => void | Promise<void>;
  onSettingsChange: (settings: ViewerSettings) => void | Promise<void>;
  onProfileChange: (name: ProfileName | undefined) => void | Promise<void>;
  onMembershipsChange: (memberships: readonly FrequentFlyerMembership[]) => void | Promise<void>;
}

export function SettingsPage({
  document,
  isDemo,
  settings,
  onImport,
  onExport,
  onClear,
  onSettingsChange,
  onProfileChange,
  onMembershipsChange,
}: SettingsPageProps) {
  const { t } = useTranslation();
  const [confirmClear, setConfirmClear] = useState(false);
  const [persistentState, setPersistentState] = useState<PersistentStorageState>("checking");
  const [protectingLocalData, setProtectingLocalData] = useState(false);
  const [protectionFeedback, setProtectionFeedback] = useState<Exclude<PersistentStorageState, "checking"> | null>(null);
  const [expandedMembershipId, setExpandedMembershipId] = useState<string | null>(null);
  const persistRequestInFlight = useRef(false);
  const protectionReadVersion = useRef(0);
  const profileName = document?.profile.name;
  const memberships = document ? frequentFlyerMemberships(document) : [];

  useEffect(() => {
    let active = true;
    function refreshProtection() {
      if (persistRequestInFlight.current) return;
      const version = ++protectionReadVersion.current;
      void persistentStorageState().then((state) => {
        if (!active || version !== protectionReadVersion.current) return;
        setPersistentState(state);
        if (state === "granted") setProtectionFeedback(null);
      });
    }
    function visible() {
      if (window.document.visibilityState === "visible") refreshProtection();
    }
    refreshProtection();
    window.addEventListener("focus", refreshProtection);
    window.document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshProtection);
      window.document.removeEventListener("visibilitychange", visible);
    };
  }, []);

  async function protectLocalData() {
    if (persistRequestInFlight.current || persistentState === "granted") return;
    ++protectionReadVersion.current;
    persistRequestInFlight.current = true;
    setProtectingLocalData(true);
    setProtectionFeedback(null);
    try {
      const result = await requestPersistentStorage();
      setPersistentState(result);
      setProtectionFeedback(result);
    } finally {
      persistRequestInFlight.current = false;
      setProtectingLocalData(false);
    }
  }

  function updateSetting<Key extends keyof ViewerSettings>(
    key: Key,
    value: ViewerSettings[Key],
  ) {
    void onSettingsChange({ ...settings, [key]: value });
  }

  const lastBackup = settings.lastBackupAt
    ? new Intl.DateTimeFormat(settings.language, { dateStyle: "medium", timeStyle: "short" }).format(new Date(settings.lastBackupAt))
    : null;

  function updateName(field: "native" | "romanized", value: string) {
    if (!document) return;
    const native = field === "native" ? value.trimStart() : profileName?.native;
    const romanized = field === "romanized" ? value.trimStart() : profileName?.romanized;
    if (!native && !romanized) {
      void onProfileChange(undefined);
      return;
    }
    let primary = profileName?.primary;
    if (primary === "native" && !native) primary = "romanized";
    if (primary === "romanized" && !romanized) primary = "native";
    void onProfileChange({
      ...(native ? { native } : {}),
      ...(romanized ? { romanized } : {}),
      ...(primary ? { primary } : {}),
    });
  }

  function updateMembership(id: string, patch: Partial<FrequentFlyerMembership>) {
    void onMembershipsChange(memberships.map((membership) => membership.id === id ? { ...membership, ...patch } : membership));
  }

  function addMembership() {
    const id = `membership-${crypto.randomUUID()}`;
    void onMembershipsChange([...memberships, {
      id,
      programId: "custom",
      memberNumber: "",
      associatedAirlines: [],
    }]);
    setExpandedMembershipId(id);
  }

  function updateAssociatedAirlines(membership: FrequentFlyerMembership, codes: string[]) {
    updateMembership(membership.id, normalizeMembershipAirlines(codes, membership.defaultAirline));
  }

  function airlineOptionLabel(code: string): string {
    const airline = resolveAirline(code);
    return airline ? `${code} · ${airlineNames(airline, settings.language)[0]}` : code;
  }

  function maskMemberNumber(memberNumber: string): string {
    if (memberNumber.length <= 8) return memberNumber;
    return `${memberNumber.slice(0, 4)}••••${memberNumber.slice(-4)}`;
  }

  return (
    <PageShell className="settings-page">
      <div className="settings-content">
        <header className="settings-page-heading">
          <h1>{t("nav.settings")}</h1>
        </header>
        <div className="settings-sections">
          <section className="settings-section" aria-labelledby="settings-display">
            <h2 className="settings-section-title" id="settings-display">{t("settings.general")}</h2>
            <div className="settings-panel settings-fields settings-display-fields">
              <label className="settings-row">
                <span className="settings-row-label">{t("settings.language")}</span>
                <select className="settings-row-control" value={settings.language} onChange={(event) => updateSetting("language", event.target.value as ViewerSettings["language"])}>
                  <option value="en">{t("settings.languages.en")}</option>
                  <option value="zh-CN">{t("settings.languages.zhCN")}</option>
                  <option value="zh-TW">{t("settings.languages.zhTW")}</option>
                </select>
              </label>
              <label className="settings-row">
                <span className="settings-row-label">{t("settings.appearance")}</span>
                <select className="settings-row-control" value={settings.appearance} onChange={(event) => updateSetting("appearance", event.target.value as ViewerSettings["appearance"])}>
                  <option value="system">{t("settings.system")}</option>
                  <option value="light">{t("settings.light")}</option>
                  <option value="dark">{t("settings.dark")}</option>
                </select>
              </label>
              <label className="settings-row">
                <span className="settings-row-label">{t("settings.distance")}</span>
                <select className="settings-row-control" value={settings.distanceUnit} onChange={(event) => updateSetting("distanceUnit", event.target.value as ViewerSettings["distanceUnit"])}>
                  <option value="miles">{t("settings.miles")}</option>
                  <option value="kilometers">{t("settings.kilometers")}</option>
                </select>
              </label>
              <label className="settings-row">
                <span className="settings-row-label">{t("settings.timeFormat")}</span>
                <select className="settings-row-control" value={settings.timeFormat} onChange={(event) => updateSetting("timeFormat", event.target.value as ViewerSettings["timeFormat"])}>
                  <option value="24-hour">{t("settings.twentyFourHour")}</option>
                  <option value="12-hour">{t("settings.twelveHour")}</option>
                </select>
              </label>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="settings-profile">
            <h2 className="settings-section-title" id="settings-profile">{t("settings.profile")}</h2>
            <div className="settings-panel settings-fields settings-profile-fields">
              <label className="settings-row">
                <span className="settings-row-label">{t("settings.nativeName")}</span>
                <input className="settings-row-control" type="text" disabled={!document} value={profileName?.native ?? ""} onChange={(event) => updateName("native", event.target.value)} />
              </label>
              <label className="settings-row">
                <span className="settings-row-label">{t("settings.romanizedName")}</span>
                <input className="settings-row-control" type="text" disabled={!document} value={profileName?.romanized ?? ""} onChange={(event) => updateName("romanized", event.target.value)} />
              </label>
              <div className="settings-row">
                <span className="settings-row-label" aria-hidden="true">{t("settings.primaryName")}</span>
                <fieldset className="settings-name-choice settings-row-control">
                  <legend className="sr-only">{t("settings.primaryName")}</legend>
                  <div className="radio-row">
                    <label><input type="radio" name="primary-name" value="native" checked={profileName?.primary === "native"} disabled={!profileName?.native} onChange={() => void onProfileChange({ ...profileName!, primary: "native" })} />{t("settings.native")}</label>
                    <label><input type="radio" name="primary-name" value="romanized" checked={profileName?.primary === "romanized"} disabled={!profileName?.romanized} onChange={() => void onProfileChange({ ...profileName!, primary: "romanized" })} />{t("settings.romanized")}</label>
                  </div>
                </fieldset>
              </div>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="settings-loyalty">
            <h2 className="settings-section-title" id="settings-loyalty">{t("settings.frequentFlyerProfiles")}</h2>
            <div className="settings-panel membership-editor">
              <p className="settings-helper">{t("settings.frequentFlyerDescription")}</p>
              <p className="settings-helper settings-membership-mobile-note">{t("settings.frequentFlyerDesktopNote")}</p>
              {memberships.map((membership) => {
                const programName = frequentFlyerProgramName(membership, settings.language) || t("settings.newMembership");
                const expanded = expandedMembershipId === membership.id;
                return (
                  <div className={`settings-membership${expanded ? " is-expanded" : ""}`} key={membership.id}>
                  <div className="settings-membership-summary">
                    <div className="settings-membership-summary-copy">
                      <strong>{programName}</strong>
                      <span>{t("settings.memberNumberSummary", { number: maskMemberNumber(membership.memberNumber) })}</span>
                      {membership.tier ? <span>{membership.tier}</span> : null}
                      <span>{t("settings.defaultAirlineSummary", { airline: membership.defaultAirline ? airlineOptionLabel(membership.defaultAirline) : t("settings.noDefaultAirline") })}</span>
                      {membership.associatedAirlines.length ? <span className="settings-membership-airline-summary">{membership.associatedAirlines.map(airlineOptionLabel).join(" · ")}</span> : null}
                    </div>
                    <button className="button-secondary settings-membership-edit" type="button" aria-expanded={expanded} onClick={() => setExpandedMembershipId(expanded ? null : membership.id)}>{t(expanded ? "settings.collapseMembership" : "settings.editMembership")}</button>
                  </div>
                  {expanded ? <fieldset className="settings-membership-editor-fields">
                    <legend className="sr-only">{programName}</legend>
                    <div className="settings-membership-grid">
                    <label><span>{t("settings.programName")}</span><input value={membership.programName ?? frequentFlyerProgramName(membership, settings.language)} onChange={(event) => updateMembership(membership.id, {
                      programId: frequentFlyerProgramId(event.target.value),
                      programName: event.target.value || undefined,
                    })} /></label>
                    <label><span>{t("settings.memberNumber")}</span><input value={membership.memberNumber} onChange={(event) => updateMembership(membership.id, { memberNumber: event.target.value })} /></label>
                    <label><span>{t("settings.tier")}</span><input value={membership.tier ?? ""} onChange={(event) => updateMembership(membership.id, { tier: event.target.value })} /></label>
                    <label><span>{t("settings.defaultAirline")}</span><select
                      disabled={!membership.associatedAirlines.length}
                      value={membership.defaultAirline ?? ""}
                      onChange={(event) => updateMembership(membership.id, normalizeMembershipAirlines(membership.associatedAirlines, event.target.value || null))}
                    >
                      {membership.associatedAirlines.length !== 1 ? <option value="">{t("settings.noDefaultAirline")}</option> : null}
                      {membership.associatedAirlines.map((code) => <option value={code} key={code}>{airlineOptionLabel(code)}</option>)}
                    </select></label>
                    <div className="settings-membership-airlines">
                      <AirlineMultiSelect
                        label={t("settings.associatedAirlines")}
                        locale={settings.language}
                        value={membership.associatedAirlines}
                        onChange={(codes) => updateAssociatedAirlines(membership, codes)}
                      />
                    </div>
                  </div>
                  <div className="settings-membership-actions">
                    <button
                      className="button-secondary membership-delete"
                      type="button"
                      disabled={document?.flights.some((flight) => flight.frequentFlyer?.membershipId === membership.id)}
                      title={document?.flights.some((flight) => flight.frequentFlyer?.membershipId === membership.id) ? t("settings.membershipInUse") : undefined}
                      onClick={() => void onMembershipsChange(memberships.filter((item) => item.id !== membership.id))}
                    >{t("settings.removeMembership")}</button>
                  </div>
                  </fieldset> : null}
                  </div>
                );
              })}
              <div className="settings-membership-add">
                <button className="button-secondary" type="button" disabled={!document} onClick={addMembership}>{t("settings.addMembership")}</button>
              </div>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="settings-data">
            <h2 className="settings-section-title" id="settings-data">{t("settings.dataAndBackup")}</h2>
            <div className="settings-panel settings-data-panel">
              <div className="settings-backup-summary">
                <div className="settings-row-copy">
                  <span className="settings-row-label">{t("settings.localDataTitle")}</span>
                  <small>{t("settings.localDataDescription")}</small>
                  <strong className="settings-backup-status">{lastBackup ? t("settings.lastBackup", { date: lastBackup }) : t("settings.noBackupYet")}</strong>
                </div>
                <div className="settings-row-control">
                  <button className="settings-action" type="button" disabled={!onExport} onClick={() => void onExport?.()}>{t("settings.exportJson")}</button>
                  {isDemo ? <small className="settings-export-note">{t("settings.exportDescriptionDemo")}</small> : null}
                </div>
              </div>
              <div className="settings-import-row" id="settings-import">
                <div className="settings-row-copy">
                  <span className="settings-row-label">{t("settings.importTitle")}</span>
                  <small>{t("settings.importDescription")}</small>
                </div>
                <ImportControl existingDocument={document} onImport={onImport} variant="settings" />
              </div>
              <div className="settings-import-row">
                <div className="settings-row-copy">
                  <span className="settings-row-label">{t("settings.csvImportTitle")}</span>
                  <small>{t("settings.csvImportDescription")}</small>
                </div>
                <CsvImportControl document={document} onImport={onImport} />
              </div>
              <div className="settings-import-row">
                <div className="settings-row-copy">
                  <span className="settings-row-label">{t("settings.flightyImportTitle")}</span>
                  <small>{t("settings.flightyImportDescription")}</small>
                </div>
                <FlightyImportControl document={document} onImport={onImport} />
              </div>
              <div className="settings-row">
                <div className="settings-row-copy">
                  <span className="settings-row-label">{t("settings.storageProtectionTitle")}</span>
                  <small>{t("settings.storageProtectionDescription")}</small>
                  <strong className={`settings-storage-status${persistentState === "granted" ? " is-protected" : ""}`} role="status" aria-live="polite">
                    {t(`settings.storageProtection.${persistentState}`)}
                  </strong>
                  {protectionFeedback ? <small role="status" aria-live="polite">{t(`settings.storageProtectionRequest.${protectionFeedback}`)}</small> : null}
                </div>
                <div className="settings-row-control settings-protection-actions">
                  <button
                    className="settings-action"
                    type="button"
                    disabled={protectingLocalData || persistentState === "granted" || persistentState === "checking" || persistentState === "unsupported"}
                    onClick={() => void protectLocalData()}
                  >
                    {t(persistentState === "granted"
                      ? "settings.storageProtection.granted"
                      : persistentState === "checking"
                        ? "settings.storageProtection.checking"
                        : protectingLocalData
                          ? "settings.requestingStorageProtection"
                          : "settings.enableStorageProtection")}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="settings-section" aria-labelledby="settings-advanced">
            <h2 className="settings-section-title" id="settings-advanced">{t("settings.advanced")}</h2>
            <div className="settings-panel">
              <label className="settings-row settings-toggle-row">
                <span className="settings-row-copy"><strong className="settings-row-label">{t("settings.powerUserMode")}</strong><small>{t("settings.powerUserDescription")}</small></span>
                <span className="settings-row-control settings-switch-control"><input type="checkbox" role="switch" checked={settings.powerUserMode} onChange={(event) => updateSetting("powerUserMode", event.target.checked)} /></span>
              </label>
              {settings.powerUserMode ? <p className="settings-advanced-note">{t("settings.advancedPlaceholder")}</p> : null}
            </div>
          </section>

          <section className="settings-section settings-danger-zone" aria-labelledby="settings-danger">
            <h2 className="settings-section-title" id="settings-danger">{t("settings.dangerZone")}</h2>
            <div className="settings-panel">
              <div className="settings-row">
                <div className="settings-row-copy">
                  <span className="settings-row-label">{t("settings.clearTitle")}</span>
                  <small>{t("settings.clearDescription")}</small>
                </div>
                <div className="settings-row-control"><button className="settings-action danger-action" type="button" disabled={!onClear} onClick={() => setConfirmClear(true)}>{t("actions.clearData")}</button></div>
              </div>
            </div>
          </section>
        </div>
      </div>
      {confirmClear ? (
        <ConfirmationDialog
          title={t("settings.clearTitle")}
          description={t("settings.clearConfirmation")}
          confirmLabel={t("actions.clearData")}
          cancelLabel={t("actions.cancel")}
          tone="danger"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            setConfirmClear(false);
            void onClear?.();
          }}
        />
      ) : null}
    </PageShell>
  );
}
