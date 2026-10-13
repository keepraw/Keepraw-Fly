import { localeRegistry, supportedLanguages } from "../locales/registry";
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
import {
  persistentStorageState,
  requestPersistentStorage,
  type PersistentStorageState,
} from "../storage/browser";

interface SettingsPageProps {
  initialCategory?: "general" | "data";
  document: KeeprawFlyDocument | null;
  isDemo: boolean;
  settings: ViewerSettings;
  onImport: (document: KeeprawFlyDocument) => void | Promise<void>;
  onExport?: () => void | Promise<void>;
  onClear?: () => void | Promise<void>;
  onSettingsChange: (settings: ViewerSettings) => void | Promise<void>;
  onProfileChange: (name: ProfileName | undefined) => void | Promise<void>;
  onMembershipsChange: (
    memberships: readonly FrequentFlyerMembership[],
  ) => void | Promise<void>;
}

export function SettingsPage({
  initialCategory = "general",
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
  const [persistentState, setPersistentState] =
    useState<PersistentStorageState>("checking");
  const [protectingLocalData, setProtectingLocalData] = useState(false);
  const [protectionFeedback, setProtectionFeedback] = useState<Exclude<
    PersistentStorageState,
    "checking"
  > | null>(null);
  const [expandedMembershipId, setExpandedMembershipId] = useState<
    string | null
  >(null);
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const categoryContentRef = useRef<HTMLDivElement>(null);
  const categories = [
    { id: "general", label: "settings.general" },
    { id: "profile", label: "settings.profile" },
    { id: "memberships", label: "settings.frequentFlyerProfiles" },
    { id: "data", label: "settings.dataAndBackup" },
    { id: "advanced", label: "settings.advanced" },
    { id: "danger", label: "settings.dangerZone" },
  ];
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
    ? new Intl.DateTimeFormat(settings.language, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(settings.lastBackupAt))
    : null;

  function updateName(field: "native" | "romanized", value: string) {
    if (!document) return;
    const native = field === "native" ? value.trimStart() : profileName?.native;
    const romanized =
      field === "romanized" ? value.trimStart() : profileName?.romanized;
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

  function updateMembership(
    id: string,
    patch: Partial<FrequentFlyerMembership>,
  ) {
    void onMembershipsChange(
      memberships.map((membership) =>
        membership.id === id ? { ...membership, ...patch } : membership,
      ),
    );
  }

  function addMembership() {
    const id = `membership-${crypto.randomUUID()}`;
    void onMembershipsChange([
      ...memberships,
      {
        id,
        programId: "custom",
        memberNumber: "",
        associatedAirlines: [],
      },
    ]);
    setExpandedMembershipId(id);
  }

  function updateAssociatedAirlines(
    membership: FrequentFlyerMembership,
    codes: string[],
  ) {
    updateMembership(
      membership.id,
      normalizeMembershipAirlines(codes, membership.defaultAirline),
    );
  }

  function airlineOptionLabel(code: string): string {
    const airline = resolveAirline(code);
    return airline
      ? `${code} · ${airlineNames(airline, settings.language)[0]}`
      : code;
  }

  function maskMemberNumber(memberNumber: string): string {
    if (memberNumber.length <= 8) return memberNumber;
    return `${memberNumber.slice(0, 4)}••••${memberNumber.slice(-4)}`;
  }

  function showCategory(category: string) {
    setActiveCategory(category);
    categoryContentRef.current?.scrollIntoView({ block: "start" });
  }

  return (
    <PageShell className="settings-page settings-compact settings-information">
      <div className="settings-content">
        <header className="settings-page-heading">
          <h1>{t("nav.settings")}</h1>
        </header>
        <div className="settings-layout">
          <nav
            className="settings-category-navigation"
            aria-label={t("nav.settings")}
          >
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-current={
                  activeCategory === category.id ? "true" : undefined
                }
                aria-controls={`settings-category-${category.id}`}
                onClick={() => showCategory(category.id)}
              >
                {t(category.label)}
              </button>
            ))}
          </nav>
          <div className="settings-category-content" ref={categoryContentRef}>
            <div className="settings-sections">
              <section
                className="settings-section"
                id="settings-category-general"
                data-active={activeCategory === "general"}
                aria-labelledby="settings-display"
              >
                <h2 className="settings-section-title" id="settings-display">
                  {t("settings.general")}
                </h2>
                <div className="settings-panel settings-fields settings-display-fields settings-item-list">
                  <div className="settings-row settings-item settings-preference">
                    <div className="settings-item-copy">
                      <h3 className="settings-item-title settings-row-label">
                        <label htmlFor="settings-language">
                          {t("settings.language")}
                        </label>
                      </h3>
                    </div>
                    <select
                      id="settings-language"
                      className="settings-row-control"
                      value={settings.language}
                      onChange={(event) =>
                        updateSetting(
                          "language",
                          event.target.value as ViewerSettings["language"],
                        )
                      }
                    >
                      {supportedLanguages.map((language) => (
                        <option key={language} value={language}>
                          {localeRegistry[language].label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="settings-row settings-item settings-preference">
                    <div className="settings-item-copy">
                      <h3 className="settings-item-title settings-row-label">
                        <label htmlFor="settings-appearance">
                          {t("settings.appearance")}
                        </label>
                      </h3>
                    </div>
                    <select
                      id="settings-appearance"
                      className="settings-row-control"
                      value={settings.appearance}
                      onChange={(event) =>
                        updateSetting(
                          "appearance",
                          event.target.value as ViewerSettings["appearance"],
                        )
                      }
                    >
                      <option value="system">{t("settings.system")}</option>
                      <option value="light">{t("settings.light")}</option>
                      <option value="dark">{t("settings.dark")}</option>
                    </select>
                  </div>
                  <div className="settings-row settings-item settings-preference">
                    <div className="settings-item-copy">
                      <h3 className="settings-item-title settings-row-label">
                        <label htmlFor="settings-distance">
                          {t("settings.distance")}
                        </label>
                      </h3>
                    </div>
                    <select
                      id="settings-distance"
                      className="settings-row-control"
                      value={settings.distanceUnit}
                      onChange={(event) =>
                        updateSetting(
                          "distanceUnit",
                          event.target.value as ViewerSettings["distanceUnit"],
                        )
                      }
                    >
                      <option value="miles">{t("settings.miles")}</option>
                      <option value="kilometers">
                        {t("settings.kilometers")}
                      </option>
                    </select>
                  </div>
                  <div className="settings-row settings-item settings-preference">
                    <div className="settings-item-copy">
                      <h3 className="settings-item-title settings-row-label">
                        <label htmlFor="settings-time-format">
                          {t("settings.timeFormat")}
                        </label>
                      </h3>
                    </div>
                    <select
                      id="settings-time-format"
                      className="settings-row-control"
                      value={settings.timeFormat}
                      onChange={(event) =>
                        updateSetting(
                          "timeFormat",
                          event.target.value as ViewerSettings["timeFormat"],
                        )
                      }
                    >
                      <option value="24-hour">
                        {t("settings.twentyFourHour")}
                      </option>
                      <option value="12-hour">
                        {t("settings.twelveHour")}
                      </option>
                    </select>
                  </div>
                  <div className="settings-row settings-item settings-preference">
                    <div className="settings-item-copy">
                      <h3
                        className="settings-item-title settings-row-label"
                        id="settings-solar-label"
                      >
                        <label htmlFor="settings-solar">
                          {t("settings.solarMode")}
                        </label>
                      </h3>
                      <p id="settings-solar-hint">
                        {t("settings.solarModeHint")}
                      </p>
                    </div>
                    <select
                      id="settings-solar"
                      className="settings-row-control"
                      value={settings.solarMode}
                      title={t("settings.solarModeHint")}
                      aria-labelledby="settings-solar-label"
                      aria-describedby="settings-solar-hint"
                      onChange={(event) =>
                        updateSetting(
                          "solarMode",
                          event.target.value as ViewerSettings["solarMode"],
                        )
                      }
                    >
                      <option value="fixed">{t("settings.solarFixed")}</option>
                      <option value="realtime">
                        {t("settings.solarRealtime")}
                      </option>
                    </select>
                  </div>
                </div>
              </section>

              <section
                className="settings-section"
                id="settings-category-profile"
                data-active={activeCategory === "profile"}
                aria-labelledby="settings-profile"
              >
                <h2 className="settings-section-title" id="settings-profile">
                  {t("settings.profile")}
                </h2>
                <div className="settings-panel settings-fields settings-profile-fields settings-item-list">
                  <div className="settings-row settings-item settings-preference">
                    <div className="settings-item-copy">
                      <h3 className="settings-item-title settings-row-label">
                        <label htmlFor="settings-native-name">
                          {t("settings.nativeName")}
                        </label>
                      </h3>
                    </div>
                    <input
                      id="settings-native-name"
                      className="settings-row-control"
                      type="text"
                      disabled={!document}
                      value={profileName?.native ?? ""}
                      onChange={(event) =>
                        updateName("native", event.target.value)
                      }
                    />
                  </div>
                  <div className="settings-row settings-item settings-preference">
                    <div className="settings-item-copy">
                      <h3 className="settings-item-title settings-row-label">
                        <label htmlFor="settings-romanized-name">
                          {t("settings.romanizedName")}
                        </label>
                      </h3>
                    </div>
                    <input
                      id="settings-romanized-name"
                      className="settings-row-control"
                      type="text"
                      disabled={!document}
                      value={profileName?.romanized ?? ""}
                      onChange={(event) =>
                        updateName("romanized", event.target.value)
                      }
                    />
                  </div>
                  <div className="settings-row settings-item settings-preference">
                    <div className="settings-item-copy">
                      <h3
                        className="settings-item-title settings-row-label"
                        id="settings-primary-label"
                      >
                        {t("settings.primaryName")}
                      </h3>
                    </div>
                    <fieldset className="settings-name-choice settings-row-control">
                      <legend className="sr-only">
                        {t("settings.primaryName")}
                      </legend>
                      <div className="radio-row">
                        <label>
                          <input
                            type="radio"
                            name="primary-name"
                            value="native"
                            checked={profileName?.primary === "native"}
                            disabled={!profileName?.native}
                            onChange={() =>
                              void onProfileChange({
                                ...profileName!,
                                primary: "native",
                              })
                            }
                          />
                          {t("settings.native")}
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="primary-name"
                            value="romanized"
                            checked={profileName?.primary === "romanized"}
                            disabled={!profileName?.romanized}
                            onChange={() =>
                              void onProfileChange({
                                ...profileName!,
                                primary: "romanized",
                              })
                            }
                          />
                          {t("settings.romanized")}
                        </label>
                      </div>
                    </fieldset>
                  </div>
                </div>
              </section>

              <section
                className="settings-section"
                id="settings-category-memberships"
                data-active={activeCategory === "memberships"}
                aria-labelledby="settings-loyalty"
              >
                <h2 className="settings-section-title" id="settings-loyalty">
                  {t("settings.frequentFlyerProfiles")}
                </h2>
                <div className="settings-panel membership-editor">
                  <p className="settings-helper">
                    {t("settings.frequentFlyerDescription")}
                  </p>
                  {memberships.map((membership) => {
                    const programName =
                      frequentFlyerProgramName(membership, settings.language) ||
                      t("settings.newMembership");
                    const expanded = expandedMembershipId === membership.id;
                    return (
                      <div
                        className={`settings-membership${expanded ? " is-expanded" : ""}`}
                        key={membership.id}
                      >
                        <div className="settings-membership-summary">
                          <div className="settings-membership-summary-copy">
                            <h3 className="settings-item-title settings-membership-identity">
                              <strong>{programName}</strong>
                            </h3>
                            <p className="settings-membership-airline-summary">
                              {membership.defaultAirline
                                ? airlineOptionLabel(membership.defaultAirline)
                                : t("settings.noDefaultAirline")}
                            </p>
                            <p className="settings-membership-number">
                              {t("settings.memberNumberSummary", {
                                number: maskMemberNumber(
                                  membership.memberNumber,
                                ),
                              })}
                            </p>
                          </div>
                          <button
                            className="button-secondary settings-membership-edit"
                            type="button"
                            aria-expanded={expanded}
                            aria-controls={
                              expanded
                                ? `settings-membership-editor-${membership.id}`
                                : undefined
                            }
                            onClick={() =>
                              setExpandedMembershipId(
                                expanded ? null : membership.id,
                              )
                            }
                          >
                            {t(
                              expanded
                                ? "settings.collapseMembership"
                                : "settings.editMembership",
                            )}
                          </button>
                        </div>
                        {expanded ? (
                          <fieldset
                            className="settings-membership-editor-fields"
                            id={`settings-membership-editor-${membership.id}`}
                          >
                            <legend className="settings-editor-title">
                              {t("settings.editMembership")} · {programName}
                            </legend>
                            <div className="settings-membership-grid">
                              <label>
                                <span>{t("settings.programName")}</span>
                                <input
                                  value={
                                    membership.programName ??
                                    frequentFlyerProgramName(
                                      membership,
                                      settings.language,
                                    )
                                  }
                                  onChange={(event) =>
                                    updateMembership(membership.id, {
                                      programId: frequentFlyerProgramId(
                                        event.target.value,
                                      ),
                                      programName:
                                        event.target.value || undefined,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                <span>{t("settings.memberNumber")}</span>
                                <input
                                  value={membership.memberNumber}
                                  onChange={(event) =>
                                    updateMembership(membership.id, {
                                      memberNumber: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                <span>{t("settings.tier")}</span>
                                <input
                                  value={membership.tier ?? ""}
                                  onChange={(event) =>
                                    updateMembership(membership.id, {
                                      tier: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                <span>{t("settings.defaultAirline")}</span>
                                <select
                                  disabled={
                                    !membership.associatedAirlines.length
                                  }
                                  value={membership.defaultAirline ?? ""}
                                  onChange={(event) =>
                                    updateMembership(
                                      membership.id,
                                      normalizeMembershipAirlines(
                                        membership.associatedAirlines,
                                        event.target.value || null,
                                      ),
                                    )
                                  }
                                >
                                  {membership.associatedAirlines.length !==
                                  1 ? (
                                    <option value="">
                                      {t("settings.noDefaultAirline")}
                                    </option>
                                  ) : null}
                                  {membership.associatedAirlines.map((code) => (
                                    <option value={code} key={code}>
                                      {airlineOptionLabel(code)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className="settings-membership-airlines">
                                <AirlineMultiSelect
                                  label={t("settings.associatedAirlines")}
                                  locale={settings.language}
                                  value={membership.associatedAirlines}
                                  onChange={(codes) =>
                                    updateAssociatedAirlines(membership, codes)
                                  }
                                />
                              </div>
                            </div>
                            <div className="settings-membership-actions">
                              <button
                                className="button-secondary membership-delete"
                                type="button"
                                disabled={document?.flights.some(
                                  (flight) =>
                                    flight.frequentFlyer?.membershipId ===
                                    membership.id,
                                )}
                                title={
                                  document?.flights.some(
                                    (flight) =>
                                      flight.frequentFlyer?.membershipId ===
                                      membership.id,
                                  )
                                    ? t("settings.membershipInUse")
                                    : undefined
                                }
                                onClick={() =>
                                  void onMembershipsChange(
                                    memberships.filter(
                                      (item) => item.id !== membership.id,
                                    ),
                                  )
                                }
                              >
                                {t("settings.removeMembership")}
                              </button>
                            </div>
                          </fieldset>
                        ) : null}
                      </div>
                    );
                  })}
                  <div className="settings-membership-add">
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={!document}
                      onClick={addMembership}
                    >
                      {t("settings.addMembership")}
                    </button>
                  </div>
                </div>
              </section>

              <section
                className="settings-section"
                id="settings-category-data"
                data-active={activeCategory === "data"}
                aria-labelledby="settings-data"
              >
                <h2 className="settings-section-title" id="settings-data">
                  {t("settings.dataAndBackup")}
                </h2>
                <div className="settings-panel settings-data-panel settings-operations">
                  <section
                    className="settings-backup-summary settings-operation"
                    aria-labelledby="settings-export-title"
                  >
                    <div className="settings-operation-copy">
                      <h3
                        className="settings-item-title"
                        id="settings-export-title"
                      >
                        {t("settings.exportTitle")}
                      </h3>
                      <p>{t("settings.backupDescription")}</p>
                      <small>{t("settings.localDataDescription")}</small>
                      <strong className="settings-backup-status">
                        {lastBackup
                          ? t("settings.lastBackup", { date: lastBackup })
                          : t("settings.noBackupYet")}
                      </strong>
                    </div>
                    <div className="settings-operation-actions">
                      <button
                        className="settings-action"
                        type="button"
                        disabled={!onExport}
                        onClick={() => void onExport?.()}
                      >
                        {t("settings.exportJson")}
                      </button>
                      {isDemo ? (
                        <small className="settings-export-note">
                          {t("settings.exportDescriptionDemo")}
                        </small>
                      ) : null}
                    </div>
                  </section>
                  <section
                    className="settings-import-row settings-operation"
                    id="settings-import"
                    aria-labelledby="settings-json-title"
                  >
                    <div className="settings-operation-copy">
                      <h3
                        className="settings-item-title"
                        id="settings-json-title"
                      >
                        {t("settings.importTitle")}
                      </h3>
                      <p>{t("settings.restoreDescription")}</p>
                      <small>{t("settings.importDescription")}</small>
                    </div>
                    <ImportControl
                      existingDocument={document}
                      onImport={onImport}
                      variant="settings"
                    />
                  </section>
                  <section
                    className="settings-import-row settings-operation"
                    aria-labelledby="settings-csv-title"
                  >
                    <div className="settings-operation-copy">
                      <h3
                        className="settings-item-title"
                        id="settings-csv-title"
                      >
                        {t("settings.csvImportTitle")}
                      </h3>
                      <p>{t("settings.csvDescription")}</p>
                      <small>{t("settings.csvImportDescription")}</small>
                    </div>
                    <CsvImportControl document={document} onImport={onImport} />
                  </section>
                  <section
                    className="settings-import-row settings-operation"
                    aria-labelledby="settings-flighty-title"
                  >
                    <div className="settings-operation-copy">
                      <h3
                        className="settings-item-title"
                        id="settings-flighty-title"
                      >
                        {t("settings.flightyImportTitle")}
                      </h3>
                      <small>{t("settings.flightyImportDescription")}</small>
                    </div>
                    <FlightyImportControl
                      document={document}
                      onImport={onImport}
                    />
                  </section>
                  <section
                    className="settings-operation settings-operation--storage"
                    aria-labelledby="settings-storage-title"
                  >
                    <div className="settings-operation-copy">
                      <h3
                        className="settings-item-title"
                        id="settings-storage-title"
                      >
                        {t("settings.storageProtectionTitle")}
                      </h3>
                      <small>
                        {t("settings.storageProtectionDescription")}
                      </small>
                      <strong
                        className={`settings-storage-status${persistentState === "granted" ? " is-protected" : ""}`}
                        role="status"
                        aria-live="polite"
                      >
                        {t(`settings.storageProtection.${persistentState}`)}
                      </strong>
                      {protectionFeedback ? (
                        <small role="status" aria-live="polite">
                          {t(
                            `settings.storageProtectionRequest.${protectionFeedback}`,
                          )}
                        </small>
                      ) : null}
                    </div>
                    <div className="settings-operation-actions settings-protection-actions">
                      <button
                        className="settings-action"
                        type="button"
                        disabled={
                          protectingLocalData ||
                          persistentState === "granted" ||
                          persistentState === "checking" ||
                          persistentState === "unsupported"
                        }
                        onClick={() => void protectLocalData()}
                      >
                        {t(
                          persistentState === "granted"
                            ? "settings.storageProtection.granted"
                            : persistentState === "checking"
                              ? "settings.storageProtection.checking"
                              : protectingLocalData
                                ? "settings.requestingStorageProtection"
                                : "settings.enableStorageProtection",
                        )}
                      </button>
                    </div>
                  </section>
                </div>
              </section>

              <section
                className="settings-section"
                id="settings-category-advanced"
                data-active={activeCategory === "advanced"}
                aria-labelledby="settings-advanced"
              >
                <h2 className="settings-section-title" id="settings-advanced">
                  {t("settings.advanced")}
                </h2>
                <div className="settings-panel">
                  <div className="settings-item settings-item--toggle">
                    <div className="settings-item-copy">
                      <h3 className="settings-item-title">
                        <label htmlFor="settings-power-user">
                          {t("settings.powerUserMode")}
                        </label>
                      </h3>
                      <p id="settings-power-description">
                        {t("settings.powerUserDescription")}
                      </p>
                    </div>
                    <label
                      className="settings-switch-control"
                      htmlFor="settings-power-user"
                    >
                      <input
                        id="settings-power-user"
                        aria-label={t("settings.powerUserMode")}
                        aria-describedby="settings-power-description"
                        type="checkbox"
                        role="switch"
                        checked={settings.powerUserMode}
                        onChange={(event) =>
                          updateSetting("powerUserMode", event.target.checked)
                        }
                      />
                    </label>
                  </div>
                  {settings.powerUserMode ? (
                    <p className="settings-advanced-note">
                      {t("settings.advancedPlaceholder")}
                    </p>
                  ) : null}
                </div>
              </section>

              <section
                className="settings-section settings-danger-zone"
                id="settings-category-danger"
                data-active={activeCategory === "danger"}
                aria-labelledby="settings-danger"
              >
                <h2 className="settings-section-title" id="settings-danger">
                  {t("settings.dangerZone")}
                </h2>
                <div className="settings-panel">
                  <div className="settings-operation">
                    <div className="settings-operation-copy">
                      <h3 className="settings-item-title">
                        {t("settings.clearTitle")}
                      </h3>
                      <small>{t("settings.clearDescription")}</small>
                    </div>
                    <div className="settings-operation-actions">
                      <button
                        className="settings-action danger-action"
                        type="button"
                        disabled={!onClear}
                        onClick={() => setConfirmClear(true)}
                      >
                        {t("actions.clearData")}
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
            <p className="settings-font-credit">
              {t("settings.fontCredit")}{" "}
              <a
                href="https://hyperos.mi.com/font-download/MiSans字体知识产权许可协议.pdf"
                target="_blank"
                rel="noopener noreferrer"
                referrerPolicy="no-referrer"
              >
                {t("settings.fontLicense")}
              </a>
              <br />
              {t("settings.fontNetwork")}
            </p>
          </div>
        </div>
      </div>
      {confirmClear ? (
        <ConfirmationDialog
          themeScope="settings"
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
