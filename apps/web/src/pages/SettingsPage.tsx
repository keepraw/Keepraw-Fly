import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import type { KeeprawFlyDocument, ProfileName } from "@keepraw-fly/schema";
import type { ViewerSettings } from "../storage/types";
import { ImportControl } from "../components/ImportControl";

interface SettingsPageProps {
  document: KeeprawFlyDocument | null;
  isDemo: boolean;
  settings: ViewerSettings;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
  onExport?: () => void | Promise<void>;
  onClear?: () => void | Promise<void>;
  onSettingsChange: (settings: ViewerSettings) => void | Promise<void>;
  onProfileChange: (name: ProfileName | undefined) => void | Promise<void>;
}

type SettingsIconName = "data" | "display" | "profile" | "advanced";

function SettingsIcon({ name }: { name: SettingsIconName }) {
  const paths: Record<SettingsIconName, ReactNode> = {
    data: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" /></>,
    display: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
    profile: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21c.7-4.2 3.2-6.5 7.5-6.5s6.8 2.3 7.5 6.5" /></>,
    advanced: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>;
}

function SectionHeading({
  icon,
  number,
  title,
  titleId,
}: {
  icon: SettingsIconName;
  number: string;
  title: string;
  titleId: string;
}) {
  return (
    <div className="settings-section-heading">
      <span className="settings-section-icon"><SettingsIcon name={icon} /></span>
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
}: SettingsPageProps) {
  const { t } = useTranslation();
  const profileName = document?.profile.name;

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

  return (
    <main className="settings-page" id="main-content" tabIndex={-1}>
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
            <div><span>{t("settings.importTitle")}</span><small>{t("settings.importDescription")}</small><ImportControl existingDocument={document} onBackup={onExport} onImport={onImport} variant="settings" /></div>
            <div><span>{t("settings.exportTitle")}</span><small>{t(isDemo ? "settings.exportDescriptionDemo" : "settings.exportDescription")}</small><button className="settings-action" type="button" disabled={!onExport} onClick={() => void onExport?.()}>{t("actions.export")}</button></div>
            <div><span>{t("settings.clearTitle")}</span><small>{t("settings.clearDescription")}</small><button className="settings-action danger-action" type="button" disabled={!onClear} onClick={() => {
              if (onClear && window.confirm(t("settings.clearConfirmation"))) void onClear();
            }}>{t("actions.clearData")}</button></div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-display">
          <SectionHeading icon="display" number="02" title={t("settings.display")} titleId="settings-display" />
          <div className="settings-panel settings-fields">
            <label><span>{t("settings.language")}</span><select value={settings.language} onChange={(event) => updateSetting("language", event.target.value as ViewerSettings["language"])}><option value="en">English</option><option value="zh-CN">简体中文</option></select></label>
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

        <section className="settings-section" aria-labelledby="settings-advanced">
          <SectionHeading icon="advanced" number="04" title={t("settings.advanced")} titleId="settings-advanced" />
          <div className="settings-panel">
            <label className="toggle-row">
              <span><strong>{t("settings.powerUserMode")}</strong><small>{t("settings.powerUserDescription")}</small></span>
              <input type="checkbox" role="switch" checked={settings.powerUserMode} onChange={(event) => updateSetting("powerUserMode", event.target.checked)} />
            </label>
            {settings.powerUserMode ? <p className="advanced-note">{t("settings.advancedPlaceholder")}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
