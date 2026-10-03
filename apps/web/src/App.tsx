import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight, KeeprawFlyDocument, ProfileName } from "@keepraw-fly/schema";
import demoData from "@keepraw-fly/core/demo";
import { AppHeader, type Page } from "./components/AppHeader";
import { EmptyState } from "./components/EmptyState";
import { DemoBanner } from "./components/DemoBanner";
import { FlightEditor } from "./components/FlightEditor";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { FlightDetailPage } from "./pages/FlightDetailPage";
import { PassportPage } from "./pages/PassportPage";
import { initialPassportView, passportVisibleFlights, type PassportViewState } from "./data/passport-exploration";
import { SettingsPage } from "./pages/SettingsPage";
import { RecoveryPage } from "./pages/RecoveryPage";
import { downloadKeeprawFly } from "./data/export";
import { documentWithoutFlight, flightById } from "./data/archive";
import { createEmptyDocument } from "./data/flight-editor";
import { browserStorage } from "./storage/browser";
import type { ArchiveKind, ArchiveLoadResult } from "./storage/adapter";
import { createPersistenceQueue, type PersistenceState } from "./storage/persistence";
import { defaultViewerSettings, type ViewerSettings } from "./storage/types";
import {
  frequentFlyerMemberships,
  recentAirportCodes,
  withFrequentFlyerMemberships,
  type FrequentFlyerMembership,
} from "@keepraw-fly/core";

const demoDocument = demoData as KeeprawFlyDocument;
type DocumentSnapshot = { document: KeeprawFlyDocument; kind: ArchiveKind } | null;
type RecoveryArchive = Extract<ArchiveLoadResult, { status: "invalid" | "unsupported-version" }>;

export function App() {
  const { i18n, t } = useTranslation();
  const [document, setDocument] = useState<KeeprawFlyDocument | null>(null);
  const [archiveKind, setArchiveKind] = useState<ArchiveKind | null>(null);
  const [recoveryArchive, setRecoveryArchive] = useState<RecoveryArchive | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const recoveryOperationRef = useRef(false);
  const [settings, setSettings] = useState<ViewerSettings>(defaultViewerSettings);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [documentPersistence, setDocumentPersistence] = useState<PersistenceState>({ status: "idle" });
  const [settingsPersistence, setSettingsPersistence] = useState<PersistenceState>({ status: "idle" });
  const [documentWrites] = useState(() => createPersistenceQueue<DocumentSnapshot>(
    (snapshot) => snapshot
      ? browserStorage.saveDocument(snapshot.document, snapshot.kind)
      : browserStorage.clearDocument(),
    (state) => {
      setDocumentPersistence(state);
      if (state.status === "saved") setStorageError(null);
    },
  ));
  const [settingsWrites] = useState(() => createPersistenceQueue<ViewerSettings>(
    (snapshot) => browserStorage.saveSettings(snapshot),
    setSettingsPersistence,
  ));
  const [page, setPage] = useState<Page>(pageFromHash);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [passportView, setPassportView] = useState<PassportViewState>(initialPassportView);
  const [editorFlightId, setEditorFlightId] = useState<string | "new" | null>(null);
  const [duplicateTemplate, setDuplicateTemplate] = useState<KeeprawFlight | null>(null);
  const [confirmDemoExport, setConfirmDemoExport] = useState(false);
  const editorReturnFocusRef = useRef<HTMLElement | null>(null);

  const locale = useMemo(() => settings.language, [settings.language]);
  const selectedFlight = useMemo(
    () => flightById(document, selectedFlightId),
    [document, selectedFlightId],
  );
  const editedFlight = useMemo(
    () => editorFlightId && editorFlightId !== "new"
      ? flightById(document, editorFlightId)
      : undefined,
    [document, editorFlightId],
  );
  const preferredAirportCodes = useMemo(
    () => recentAirportCodes(document?.flights ?? []),
    [document?.flights],
  );
  const memberships = useMemo(() => document ? frequentFlyerMemberships(document) : [], [document]);
  const visibleFlights = useMemo(() => passportVisibleFlights(document?.flights ?? [], passportView), [document?.flights, passportView]);
  const flightIndex = visibleFlights.findIndex((flight) => flight.id === selectedFlightId);
  const previousFlight = flightIndex > 0 ? visibleFlights[flightIndex - 1] : undefined;
  const nextFlight = flightIndex >= 0 ? visibleFlights[flightIndex + 1] : undefined;

  function openAdjacentFlight(flight: KeeprawFlight | undefined) {
    if (!flight) return;
    setPassportView((view) => ({ ...view, flightId: flight.id }));
    setSelectedFlightId(flight.id);
  }

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      browserStorage.loadDocument(),
      browserStorage.loadSettings(),
    ])
      .then(([archiveResult, settingsResult]) => {
        if (!active) return;
        // A preferences read failure must not hide an existing unreadable archive.
        if (archiveResult.status === "fulfilled") applyArchiveLoad(archiveResult.value);
        if (settingsResult.status === "fulfilled" && settingsResult.value) setSettings(settingsResult.value);
        if (archiveResult.status === "rejected" || settingsResult.status === "rejected") setStorageError("storage");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function applyArchiveLoad(result: ArchiveLoadResult) {
    setDocument(result.status === "valid" ? result.document : null);
    setArchiveKind(result.status === "empty" ? null : result.kind);
    setRecoveryArchive(result.status === "invalid" || result.status === "unsupported-version" ? result : null);
  }

  async function runRecoveryOperation(operation: () => Promise<void>) {
    if (recoveryOperationRef.current) return;
    recoveryOperationRef.current = true;
    setRecoveryBusy(true);
    try {
      await operation();
    } finally {
      recoveryOperationRef.current = false;
      setRecoveryBusy(false);
    }
  }

  async function retryArchiveLoad() {
    await runRecoveryOperation(async () => {
      try {
        applyArchiveLoad(await browserStorage.loadDocument());
        setStorageError(null);
      } catch (error) {
        setStorageError("storage");
        throw error;
      }
    });
  }

  async function importRecoveryBackup(nextDocument: KeeprawFlyDocument) {
    await runRecoveryOperation(async () => {
      // The recovery UI confirms replacement. Keep the raw source visible until
      // IndexedDB has committed the explicitly selected, validated backup.
      await browserStorage.saveDocument(nextDocument, "personal");
      setDocument(nextDocument);
      setArchiveKind("personal");
      setRecoveryArchive(null);
      setStorageError(null);
      setPassportView(initialPassportView);
      setPage("passport");
      setSelectedFlightId(null);
      window.location.hash = "passport";
    });
  }

  async function clearRecoveryArchive() {
    await runRecoveryOperation(async () => {
      await browserStorage.clearDocument();
      applyArchiveLoad({ status: "empty" });
      setStorageError(null);
      setPage("passport");
      setSelectedFlightId(null);
      window.location.hash = "passport";
    });
  }

  useEffect(() => {
    void i18n.changeLanguage(settings.language);
    documentElementLanguage(settings.language);
  }, [i18n, settings.language]);

  useEffect(() => {
    if (settings.appearance === "system") {
      delete window.document.documentElement.dataset.theme;
    } else {
      window.document.documentElement.dataset.theme = settings.appearance;
    }
  }, [settings.appearance]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [page, selectedFlightId]);

  useEffect(() => {
    if (window.location.hash === "#flights") {
      window.history.replaceState(null, "", "#passport");
    }
    const handleHashChange = () => {
      const nextPage = pageFromLocationHash();
      if (nextPage) {
        if (window.location.hash === "#flights") {
          window.history.replaceState(null, "", "#passport");
        }
        setPage(nextPage);
        setSelectedFlightId(null);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const hasUnsavedChanges = documentPersistence.status === "saving" || documentPersistence.status === "error"
    || settingsPersistence.status === "saving" || settingsPersistence.status === "error";

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const preventUnsavedExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnsavedExit);
    return () => window.removeEventListener("beforeunload", preventUnsavedExit);
  }, [hasUnsavedChanges]);

  function storeDocument(
    nextDocument: KeeprawFlyDocument,
    nextKind: ArchiveKind = archiveKind ?? "personal",
  ) {
    if (recoveryArchive) return;
    setDocument(nextDocument);
    setArchiveKind(nextKind);
    void documentWrites.save({ document: nextDocument, kind: nextKind });
  }

  function storeSettings(nextSettings: ViewerSettings) {
    setSettings(nextSettings);
    void settingsWrites.save(nextSettings);
  }

  function updateProfile(name: ProfileName | undefined) {
    if (!document) return;
    storeDocument({
      ...document,
      profile: name ? { ...document.profile, name } : {},
    });
  }

  function updateMemberships(nextMemberships: readonly FrequentFlyerMembership[]) {
    if (!document) return;
    storeDocument(withFrequentFlyerMemberships(document, nextMemberships));
  }

  function clearDocument() {
    // Deletion shares the write queue so an older save cannot resurrect the archive.
    setDocument(null);
    setArchiveKind(null);
    void documentWrites.save(null);
    setPage("passport");
    window.location.hash = "passport";
    setSelectedFlightId(null);
    setEditorFlightId(null);
    setDuplicateTemplate(null);
  }

  function createArchive() {
    setPassportView(initialPassportView);
    editorReturnFocusRef.current = window.document.activeElement instanceof HTMLElement
      ? window.document.activeElement
      : null;
    storeDocument(createEmptyDocument(), "personal");
    setPage("passport");
    setSelectedFlightId(null);
    setEditorFlightId("new");
    setDuplicateTemplate(null);
    window.location.hash = "passport";
  }

  function importArchive(nextDocument: KeeprawFlyDocument) {
    setPassportView(initialPassportView);
    storeDocument(nextDocument, "personal");
    setPage("passport");
    setSelectedFlightId(null);
    window.location.hash = "passport";
  }

  function openDemoArchive() {
    setPassportView(initialPassportView);
    storeDocument(structuredClone(demoDocument), "demo");
    setPage("passport");
    setSelectedFlightId(null);
    window.location.hash = "passport";
  }

  function saveFlight(flight: KeeprawFlight) {
    if (!document) return;
    const existingIndex = document.flights.findIndex((item) => item.id === flight.id);
    const flights = existingIndex === -1
      ? [...document.flights, flight]
      : document.flights.map((item) => item.id === flight.id ? flight : item);
    storeDocument({ ...document, flights });
    setEditorFlightId(null);
    setDuplicateTemplate(null);
    setSelectedFlightId(flight.id);
    setPage("passport");
    window.history.replaceState(null, "", "#passport");
  }

  function deleteEditedFlight() {
    if (!document || !editorFlightId || editorFlightId === "new") return;
    const deletedFlightId = editorFlightId;
    setEditorFlightId(null);
    if (selectedFlightId === deletedFlightId) setSelectedFlightId(null);
    storeDocument(documentWithoutFlight(document, deletedFlightId));
  }

  async function exportDocument() {
    if (!document) return;
    if (archiveKind === "demo") {
      setConfirmDemoExport(true);
      return;
    }
    await downloadKeeprawFly(document);
    storeSettings({ ...settings, lastBackupAt: new Date().toISOString() });
  }

  if (!loaded) {
    return <main className="loading-screen" id="main-content" aria-label={t("app.loading")}><span>K</span></main>;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">{t("app.skipToContent")}</a>
      <AppHeader
        currentPage={page}
        onNavigate={(nextPage) => {
          setPage(nextPage);
          setSelectedFlightId(null);
        }}
        detailActions={selectedFlight ? {
          onPrevious: previousFlight ? () => openAdjacentFlight(previousFlight) : undefined,
          onNext: nextFlight ? () => openAdjacentFlight(nextFlight) : undefined,
          onBack: () => {
            setSelectedFlightId(null);
            setPage("passport");
            window.location.hash = "passport";
          },
          onDuplicate: () => {
            editorReturnFocusRef.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
            setDuplicateTemplate(selectedFlight);
            setEditorFlightId("new");
          },
          onEdit: () => {
            editorReturnFocusRef.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
            setEditorFlightId(selectedFlight.id);
          },
        } : undefined}
      />
      <div className="persistence-status" role="status">
        {documentPersistence.status === "saving" || settingsPersistence.status === "saving" ? t("actions.saving") : null}
      </div>
      {storageError || documentPersistence.status === "error" || settingsPersistence.status === "error" || (document && archiveKind === "demo") ? (
        <div className="page-notices">
          {documentPersistence.status === "error" ? (
            <div className="storage-warning" role="alert">
              <span>{t("app.changesNotSaved")}</span>
              <button type="button" onClick={() => { void documentWrites.retry(); }}>{t("actions.retry")}</button>
            </div>
          ) : storageError ? <div className="storage-warning" role="alert">{t("app.storageUnavailable")}</div> : null}
          {settingsPersistence.status === "error" ? (
            <div className="storage-warning" role="alert">
              <span>{t("app.settingsNotSaved")}</span>
              <button type="button" onClick={() => { void settingsWrites.retry(); }}>{t("actions.retry")}</button>
            </div>
          ) : null}
          {document && archiveKind === "demo" ? (
            <DemoBanner compact={Boolean(selectedFlight) || page === "passport"} onCreateArchive={createArchive} />
          ) : null}
        </div>
      ) : null}
      {recoveryArchive ? (
        <RecoveryPage
          archive={recoveryArchive}
          busy={recoveryBusy}
          onRetry={retryArchiveLoad}
          onImport={importRecoveryBackup}
          onClear={clearRecoveryArchive}
        />
      ) : page === "settings" ? (
        <SettingsPage
          document={document}
          isDemo={archiveKind === "demo"}
          settings={settings}
          onImport={importArchive}
          onExport={document ? exportDocument : undefined}
          onClear={document ? clearDocument : undefined}
          onSettingsChange={storeSettings}
          onProfileChange={updateProfile}
          onMembershipsChange={updateMemberships}
        />
      ) : !document ? (
        <EmptyState
          onCreateArchive={createArchive}
          onTryDemo={openDemoArchive}
          onImport={importArchive}
        />
      ) : selectedFlight ? (
        <FlightDetailPage
          flight={selectedFlight}
          memberships={memberships}
          locale={locale}
          distanceUnit={settings.distanceUnit}
          timeFormat={settings.timeFormat}
        />
      ) : page === "passport" ? (
        <PassportPage
          view={passportView}
          onViewChange={setPassportView}
          document={document}
          locale={locale}
          distanceUnit={settings.distanceUnit}
          timeFormat={settings.timeFormat}
          onOpenFlight={(flightId) => {
            setSelectedFlightId(flightId);
          }}
          onAddFlight={() => {
            editorReturnFocusRef.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
            setDuplicateTemplate(null);
            setEditorFlightId("new");
          }}
          onOpenImport={() => {
            setPage("settings");
            window.location.hash = "settings";
            window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.document.getElementById("settings-import")?.scrollIntoView({ block: "start" })));
          }}
        />
      ) : null}
      {document && editorFlightId && (editorFlightId === "new" || editedFlight) ? (
        <FlightEditor
          key={`${editorFlightId}-${duplicateTemplate?.id ?? "blank"}`}
          flight={editorFlightId === "new"
            ? duplicateTemplate ?? undefined
            : editedFlight}
          isDuplicate={editorFlightId === "new" && Boolean(duplicateTemplate)}
          preferredAirportCodes={preferredAirportCodes}
          returnFocus={editorReturnFocusRef.current}
          locale={locale}
          memberships={memberships}
          onSave={saveFlight}
          onDelete={editorFlightId === "new" ? undefined : deleteEditedFlight}
          onCancel={() => { setEditorFlightId(null); setDuplicateTemplate(null); }}
        />
      ) : null}
      {confirmDemoExport ? (
        <ConfirmationDialog
          title={t("demo.exportTitle")}
          description={t("demo.exportConfirmation")}
          confirmLabel={t("actions.export")}
          cancelLabel={t("actions.cancel")}
          onCancel={() => setConfirmDemoExport(false)}
          onConfirm={async () => {
            setConfirmDemoExport(false);
            if (document) await downloadKeeprawFly(document);
          }}
        />
      ) : null}
    </div>
  );
}

function documentElementLanguage(language: ViewerSettings["language"]) {
  window.document.documentElement.lang = language;
}

function pageFromHash(): Page {
  return pageFromLocationHash() ?? "passport";
}

function pageFromLocationHash(): Page | null {
  const hash = window.location.hash.slice(1);
  if (hash === "flights") return "passport";
  return hash === "passport" || hash === "settings" ? hash : null;
}
