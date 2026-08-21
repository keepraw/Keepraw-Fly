import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument, ProfileName } from "@keepraw-fly/schema";
import type { ViewerSettings } from "../storage/types";
import { ImportControl } from "../components/ImportControl";

interface SettingsPageProps {
  document: KeeprawFlyDocument;
  settings: ViewerSettings;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
  onExport: () => void;
  onClear: () => void | Promise<void>;
  onSettingsChange: (settings: ViewerSettings) => void | Promise<void>;
  onProfileChange: (name: ProfileName | undefined) => void | Promise<void>;
}

export function SettingsPage({
  document,
  settings,
  onImport,
  onExport,
  onClear,
  onSettingsChange,
  onProfileChange,
}: SettingsPageProps) {
  const { t } = useTranslation();
  const profileName = document.profile.name;

  function updateSetting<Key extends keyof ViewerSettings>(
    key: Key,
    value: ViewerSettings[Key],
  ) {
    void onSettingsChange({ ...settings, [key]: value });
  }

  function updateName(field: "native" | "romanized", value: string) {
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
    <main className="settings-page" id="main-content">
      <header className="settings-heading">
        <p className="eyebrow">{t("settings.viewerPreferences")}</p>
        <h1>{t("nav.settings")}</h1>
        <p>{t("settings.description")}</p>
      </header>

      <div className="settings-sections">
        <section className="settings-section" aria-labelledby="settings-data">
          <div><p className="eyebrow">01</p><h2 id="settings-data">{t("settings.data")}</h2></div>
          <div className="settings-panel data-actions">
            <div><span>{t("settings.importTitle")}</span><small>{t("settings.importDescription")}</small><ImportControl onImport={onImport} variant="settings" /></div>
            <div><span>{t("settings.exportTitle")}</span><small>{t("settings.exportDescription")}</small><button className="settings-action" type="button" onClick={onExport}>{t("actions.export")}</button></div>
            <div><span>{t("settings.clearTitle")}</span><small>{t("settings.clearDescription")}</small><button className="settings-action danger-action" type="button" onClick={() => {
              if (window.confirm(t("settings.clearConfirmation"))) void onClear();
            }}>{t("actions.clearData")}</button></div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-display">
          <div><p className="eyebrow">02</p><h2 id="settings-display">{t("settings.display")}</h2></div>
          <div className="settings-panel settings-fields">
            <label><span>{t("settings.language")}</span><select value={settings.language} onChange={(event) => updateSetting("language", event.target.value as ViewerSettings["language"])}><option value="en">English</option><option value="zh-CN">简体中文</option></select></label>
            <label><span>{t("settings.appearance")}</span><select value={settings.appearance} onChange={(event) => updateSetting("appearance", event.target.value as ViewerSettings["appearance"])}><option value="system">{t("settings.system")}</option><option value="light">{t("settings.light")}</option><option value="dark">{t("settings.dark")}</option></select></label>
            <label><span>{t("settings.distance")}</span><select value={settings.distanceUnit} onChange={(event) => updateSetting("distanceUnit", event.target.value as ViewerSettings["distanceUnit"])}><option value="miles">{t("settings.miles")}</option><option value="kilometers">{t("settings.kilometers")}</option></select></label>
            <label><span>{t("settings.timeFormat")}</span><select value={settings.timeFormat} onChange={(event) => updateSetting("timeFormat", event.target.value as ViewerSettings["timeFormat"])}><option value="24-hour">{t("settings.twentyFourHour")}</option><option value="12-hour">{t("settings.twelveHour")}</option></select></label>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="settings-profile">
          <div><p className="eyebrow">03</p><h2 id="settings-profile">{t("settings.profile")}</h2></div>
          <div className="settings-panel settings-fields">
            <label><span>{t("settings.nativeName")}</span><input type="text" value={profileName?.native ?? ""} onChange={(event) => updateName("native", event.target.value)} /></label>
            <label><span>{t("settings.romanizedName")}</span><input type="text" value={profileName?.romanized ?? ""} onChange={(event) => updateName("romanized", event.target.value)} /></label>
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
          <div><p className="eyebrow">04</p><h2 id="settings-advanced">{t("settings.advanced")}</h2></div>
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
