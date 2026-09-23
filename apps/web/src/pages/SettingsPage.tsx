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
import { AviationIcon, type AviationIconName } from "../components/AviationPrimitives";
import { ImportControl } from "../components/ImportControl";
import { CsvImportControl } from "../components/CsvImportControl";
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

function SectionHeading({
  icon,
  number,
  title,
  titleId,
}: {
  icon: AviationIconName;
  number: string;
  title: string;
  titleId: string;
}) {
  return (
    <div className="settings-section-heading">
      <span className="settings-section-icon"><AviationIcon name={icon} /></span>
      <div><p className="eyebrow">{number}</p><h2 id={titleId}>{title}</h2></div>
    </div>
  );
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
  const persistRequestAttempted = useRef(false);
  const profileName = document?.profile.name;
  const memberships = document ? frequentFlyerMemberships(document) : [];

  useEffect(() => {
    let active = true;
    void persistentStorageState().then((state) => { if (active) setPersistentState(state); });
    return () => { active = false; };
  }, []);

  async function protectLocalData() {
    if (persistRequestAttempted.current || persistentState === "granted") return;
    persistRequestAttempted.current = true;
    setPersistentState(await requestPersistentStorage());
  }

  function updateSetting<Key extends keyof ViewerSettings>(
    key: Key,
    value: ViewerSettings[Key],
  ) {
    void onSettingsChange({ ...settings, [key]: value });
  }

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
    void onMembershipsChange([...memberships, {
      id: `membership-${crypto.randomUUID()}`,
      programId: "custom",
      memberNumber: "",
      associatedAirlines: [],
    }]);
  }

  function updateAssociatedAirlines(membership: FrequentFlyerMembership, codes: string[]) {
    updateMembership(membership.id, normalizeMembershipAirlines(codes, membership.defaultAirline));
  }

  function airlineOptionLabel(code: string): string {
    const airline = resolveAirline(code);
    return airline ? `${code} · ${airlineNames(airline, settings.language)[0]}` : code;
  }

  return (
    <PageShell className="settings-page">
      <header className="settings-heading">
        <div className="settings-heading-copy">
          <p className="eyebrow">{t("settings.viewerPreferences")}</p>
          <h1>{t("nav.settings")}</h1>
          <p>{t("settings.description")}</p>
        </div>
        <div className="settings-route-mark" aria-hidden="true">
          <span className="settings-route-glow" />
          <svg viewBox="0 0 320 160">
            <path className="settings-route-grid" d="M20 40h280M20 80h280M20 120h280M80 12v136M160 12v136M240 12v136" />
            <path className="settings-route-line" d="M29 121C81 36 138 142 201 70c31-35 58-22 91-42" />
            <circle cx="29" cy="121" r="5" />
            <circle cx="201" cy="70" r="5" />
            <circle cx="292" cy="28" r="5" />
          </svg>
        </div>
      </header>

      <div className="settings-sections">
        <section className="settings-section" aria-labelledby="settings-data">
          <SectionHeading icon="data" number="01" title={t("settings.data")} titleId="settings-data" />
          <div className="settings-panel data-actions">
            <div><span>{t("settings.storageProtectionTitle")}</span><small>{t(`settings.storageProtection.${persistentState}`)}</small>{persistentState === "available" ? <button className="settings-action" type="button" onClick={() => void protectLocalData()}>{t("settings.enableStorageProtection")}</button> : null}</div>
            <div><span>{t("settings.importTitle")}</span><small>{t("settings.importDescription")}</small><ImportControl existingDocument={document} onImport={onImport} variant="settings" /></div>
            <div><span>{t("settings.csvImportTitle")}</span><small>{t("settings.csvImportDescription")}</small><CsvImportControl document={document} onImport={onImport} /></div>
            <div><span>{t("settings.exportTitle")}</span><small>{t(isDemo ? "settings.exportDescriptionDemo" : "settings.exportDescription")}</small><button className="settings-action" type="button" disabled={!onExport} onClick={() => void onExport?.()}>{t("actions.export")}</button></div>
            <div><span>{t("settings.clearTitle")}</span><small>{t("settings.clearDescription")}</small><button className="settings-action danger-action" type="button" disabled={!onClear} onClick={() => setConfirmClear(true)}>{t("actions.clearData")}</button></div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-display">
          <SectionHeading icon="display" number="02" title={t("settings.display")} titleId="settings-display" />
          <div className="settings-panel settings-fields">
            <label><span>{t("settings.language")}</span><select value={settings.language} onChange={(event) => updateSetting("language", event.target.value as ViewerSettings["language"])}><option value="en">{t("settings.languages.en")}</option><option value="zh-CN">{t("settings.languages.zhCN")}</option><option value="zh-TW">{t("settings.languages.zhTW")}</option></select></label>
            <label><span>{t("settings.appearance")}</span><select value={settings.appearance} onChange={(event) => updateSetting("appearance", event.target.value as ViewerSettings["appearance"])}><option value="system">{t("settings.system")}</option><option value="light">{t("settings.light")}</option><option value="dark">{t("settings.dark")}</option></select></label>
            <label><span>{t("settings.distance")}</span><select value={settings.distanceUnit} onChange={(event) => updateSetting("distanceUnit", event.target.value as ViewerSettings["distanceUnit"])}><option value="miles">{t("settings.miles")}</option><option value="kilometers">{t("settings.kilometers")}</option></select></label>
            <label><span>{t("settings.timeFormat")}</span><select value={settings.timeFormat} onChange={(event) => updateSetting("timeFormat", event.target.value as ViewerSettings["timeFormat"])}><option value="24-hour">{t("settings.twentyFourHour")}</option><option value="12-hour">{t("settings.twelveHour")}</option></select></label>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-profile">
          <SectionHeading icon="profile" number="03" title={t("settings.profile")} titleId="settings-profile" />
          <div className="settings-panel settings-fields">
            <label><span>{t("settings.nativeName")}</span><input type="text" disabled={!document} value={profileName?.native ?? ""} onChange={(event) => updateName("native", event.target.value)} /></label>
            <label><span>{t("settings.romanizedName")}</span><input type="text" disabled={!document} value={profileName?.romanized ?? ""} onChange={(event) => updateName("romanized", event.target.value)} /></label>
            <fieldset>
              <legend>{t("settings.primaryName")}</legend>
              <div className="radio-row">
                <label><input type="radio" name="primary-name" value="native" checked={profileName?.primary === "native"} disabled={!profileName?.native} onChange={() => void onProfileChange({ ...profileName!, primary: "native" })} />{t("settings.native")}</label>
                <label><input type="radio" name="primary-name" value="romanized" checked={profileName?.primary === "romanized"} disabled={!profileName?.romanized} onChange={() => void onProfileChange({ ...profileName!, primary: "romanized" })} />{t("settings.romanized")}</label>
              </div>
            </fieldset>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-loyalty">
          <SectionHeading icon="profile" number="04" title={t("settings.frequentFlyerProfiles")} titleId="settings-loyalty" />
          <div className="settings-panel membership-editor">
            <p className="settings-helper">{t("settings.frequentFlyerDescription")}</p>
            {memberships.map((membership) => (
              <fieldset className="membership-row" key={membership.id}>
                <legend>{frequentFlyerProgramName(membership, settings.language) || t("settings.newMembership")}</legend>
                <label><span>{t("settings.programName")}</span><input value={membership.programName ?? frequentFlyerProgramName(membership, settings.language)} onChange={(event) => updateMembership(membership.id, {
                  programId: frequentFlyerProgramId(event.target.value),
                  programName: event.target.value || undefined,
                })} /></label>
                <label><span>{t("settings.memberNumber")}</span><input value={membership.memberNumber} onChange={(event) => updateMembership(membership.id, { memberNumber: event.target.value })} /></label>
                <label><span>{t("settings.tier")}</span><input value={membership.tier ?? ""} onChange={(event) => updateMembership(membership.id, { tier: event.target.value })} /></label>
                <AirlineMultiSelect
                  label={t("settings.associatedAirlines")}
                  locale={settings.language}
                  value={membership.associatedAirlines}
                  onChange={(codes) => updateAssociatedAirlines(membership, codes)}
                />
                <label><span>{t("settings.defaultAirline")}</span><select
                  disabled={!membership.associatedAirlines.length}
                  value={membership.defaultAirline ?? ""}
                  onChange={(event) => updateMembership(membership.id, normalizeMembershipAirlines(membership.associatedAirlines, event.target.value || null))}
                >
                  {membership.associatedAirlines.length !== 1 ? <option value="">{t("settings.noDefaultAirline")}</option> : null}
                  {membership.associatedAirlines.map((code) => <option value={code} key={code}>{airlineOptionLabel(code)}</option>)}
                </select></label>
                <button
                  className="button-secondary membership-delete"
                  type="button"
                  disabled={document?.flights.some((flight) => flight.frequentFlyer?.membershipId === membership.id)}
                  title={document?.flights.some((flight) => flight.frequentFlyer?.membershipId === membership.id) ? t("settings.membershipInUse") : undefined}
                  onClick={() => void onMembershipsChange(memberships.filter((item) => item.id !== membership.id))}
                >{t("settings.removeMembership")}</button>
              </fieldset>
            ))}
            <button className="button-secondary" type="button" disabled={!document} onClick={addMembership}>{t("settings.addMembership")}</button>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-advanced">
          <SectionHeading icon="advanced" number="05" title={t("settings.advanced")} titleId="settings-advanced" />
          <div className="settings-panel">
            <label className="toggle-row">
              <span><strong>{t("settings.powerUserMode")}</strong><small>{t("settings.powerUserDescription")}</small></span>
              <input type="checkbox" role="switch" checked={settings.powerUserMode} onChange={(event) => updateSetting("powerUserMode", event.target.checked)} />
            </label>
            {settings.powerUserMode ? <p className="advanced-note">{t("settings.advancedPlaceholder")}</p> : null}
          </div>
        </section>
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
