import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  KeeprawFlight,
  KeeprawFlyDocument,
  ProfileName,
} from "@keepraw-fly/schema";
import demoData from "@keepraw-fly/core/demo";
import { AppHeader, type Page } from "./components/AppHeader";
import { EmptyState } from "./components/EmptyState";
import { PageShell } from "./components/PageShell";
import { DemoBanner } from "./components/DemoBanner";
import { FlightEditor } from "./components/FlightEditor";
import { ConfirmationDialog } from "./components/ConfirmationDialog";
import { FlightDetailPage } from "./pages/FlightDetailPage";
import { PassportPage } from "./pages/PassportPage";
import { FlightPassportShareDialog } from "./components/FlightPassportShareDialog";
import {
  initialPassportView,
  passportVisibleFlights,
  type PassportViewState,
} from "./data/passport-exploration";
import { SettingsPage } from "./pages/SettingsPage";
import { RecoveryPage } from "./pages/RecoveryPage";
import { downloadKeeprawFly, type ExportKind } from "./data/export";
import { documentWithoutFlight, flightById } from "./data/archive";
import { createEmptyDocument } from "./data/flight-editor";
import { browserStorage } from "./storage/browser";
import type { ArchiveKind, ArchiveLoadResult } from "./storage/adapter";
import {
  createPersistenceQueue,
  type PersistenceState,
} from "./storage/persistence";
import { defaultViewerSettings, type ViewerSettings } from "./storage/types";
import { loadChineseWebfonts } from "./typography/load-webfonts";
import { applyAppearance, initialAppearance } from "./appearance";
import { changeUiLanguage } from "./i18n";
import { warmLocaleCache } from "./locales/resources";
import {
  frequentFlyerMemberships,
  recentAirportCodes,
  withFrequentFlyerMemberships,
  type FrequentFlyerMembership,
} from "@keepraw-fly/core";

const demoDocument = demoData as KeeprawFlyDocument;
// DEV is replaced at build time: the experiment and its assets are absent from
// the normal production bundle and never replace PassportRouteMap.
const GlobeLab = import.meta.env.DEV
  ? lazy(() => import("./globe/GlobeLab"))
  : null;
type DocumentSnapshot = {
  document: KeeprawFlyDocument;
  kind: ArchiveKind;
} | null;
export type ArchiveLoadState =
  | Exclude<ArchiveLoadResult, { status: "valid" }>
  | {
      readonly status: "valid";
      readonly kind: ArchiveKind;
      readonly updatedAt: string;
      // The current document belongs to document state, not the load outcome.
      // Reject full results even when passed as structurally compatible variables.
      readonly document?: never;
    }
  | { readonly status: "loading" | "read-error" };

export function App() {
  const { i18n, t } = useTranslation();
  const [document, setDocumentState] = useState<KeeprawFlyDocument | null>(
    null,
  );
  const documentRevisionRef = useRef(0);
  const [archiveKind, setArchiveKind] = useState<ArchiveKind | null>(null);
  const [archiveLoad, setArchiveLoad] = useState<ArchiveLoadState>({
    status: "loading",
  });
  // Update synchronously with load outcomes: event callbacks and queued writes
  // must not rely on the render that happened to create their closure.
  const archiveLoadRef = useRef(archiveLoad);
  const archiveConflictRef = useRef(false);
  const conflictDraftRef = useRef<DocumentSnapshot>(null);
  const [confirmConflictReload, setConfirmConflictReload] = useState(false);
  const [conflictReloadFailed, setConflictReloadFailed] = useState(false);
  const recoveryArchive =
    archiveLoad.status === "invalid" ||
    archiveLoad.status === "unsupported-version"
      ? archiveLoad
      : null;
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const recoveryOperationRef = useRef(false);
  const [settings, setSettings] = useState<ViewerSettings>(() => ({
    ...defaultViewerSettings(),
    appearance: initialAppearance(),
  }));
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [languageLoadError, setLanguageLoadError] = useState(false);
  const [languageRetry, setLanguageRetry] = useState(0);
  const [documentPersistence, setDocumentPersistence] =
    useState<PersistenceState>({ status: "idle" });
  const [settingsPersistence, setSettingsPersistence] =
    useState<PersistenceState>({ status: "idle" });
  const [documentWrites] = useState(() =>
    createPersistenceQueue<DocumentSnapshot>(
      (snapshot) =>
        snapshot
          ? browserStorage.saveDocument(snapshot.document, snapshot.kind)
          : browserStorage.clearDocument(),
      (state) => {
        if (state.status === "conflict") archiveConflictRef.current = true;
        setDocumentPersistence(state);
        if (state.status === "saved") setStorageError(null);
      },
      canWriteDocument,
    ),
  );
  const [settingsWrites] = useState(() =>
    createPersistenceQueue<ViewerSettings>(
      (snapshot) => browserStorage.saveSettings(snapshot),
      setSettingsPersistence,
    ),
  );
  const [page, setPage] = useState<Page>(pageFromHash);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsInitialCategory, setSettingsInitialCategory] = useState<
    "general" | "data"
  >("general");
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [passportView, setPassportView] =
    useState<PassportViewState>(initialPassportView);
  const [editorFlightId, setEditorFlightId] = useState<string | "new" | null>(
    null,
  );
  const [duplicateTemplate, setDuplicateTemplate] =
    useState<KeeprawFlight | null>(null);
  const [confirmDemoExport, setConfirmDemoExport] = useState(false);
  const editorReturnFocusRef = useRef<HTMLElement | null>(null);

  const locale = i18n.language;
  const selectedFlight = useMemo(
    () => flightById(document, selectedFlightId),
    [document, selectedFlightId],
  );
  const editedFlight = useMemo(
    () =>
      editorFlightId && editorFlightId !== "new"
        ? flightById(document, editorFlightId)
        : undefined,
    [document, editorFlightId],
  );
  const preferredAirportCodes = useMemo(
    () => recentAirportCodes(document?.flights ?? []),
    [document?.flights],
  );
  const memberships = useMemo(
    () => (document ? frequentFlyerMemberships(document) : []),
    [document],
  );
  const visibleFlights = useMemo(
    () => passportVisibleFlights(document?.flights ?? [], passportView),
    [document?.flights, passportView],
  );
  const flightIndex = visibleFlights.findIndex(
    (flight) => flight.id === selectedFlightId,
  );
  const previousFlight =
    flightIndex > 0 ? visibleFlights[flightIndex - 1] : undefined;
  const nextFlight =
    flightIndex >= 0 ? visibleFlights[flightIndex + 1] : undefined;

  function openFlight(flightId: string) {
    setPassportView((view) => ({
      ...view,
      flightId: null,
      scrollFlightId: flightId,
    }));
    setSelectedFlightId(flightId);
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
        if (archiveResult.status === "fulfilled")
          applyArchiveLoad(archiveResult.value);
        else updateArchiveLoad({ status: "read-error" });
        if (settingsResult.status === "fulfilled" && settingsResult.value)
          setSettings(settingsResult.value);
        if (settingsResult.status === "rejected") setStorageError("storage");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function setDocument(nextDocument: KeeprawFlyDocument | null) {
    // Invalidate suspended flight saves immediately, before React renders.
    documentRevisionRef.current += 1;
    setDocumentState(nextDocument);
  }

  function updateArchiveLoad(result: ArchiveLoadState) {
    archiveLoadRef.current = result;
    setArchiveLoad(result);
  }

  function canWriteDocument() {
    const { status } = archiveLoadRef.current;
    return (
      (status === "empty" || status === "valid") &&
      !archiveConflictRef.current &&
      !recoveryOperationRef.current
    );
  }

  function canRecoverDocument() {
    const { status } = archiveLoadRef.current;
    return status === "invalid" || status === "unsupported-version";
  }

  function applyArchiveLoad(result: ArchiveLoadResult) {
    updateArchiveLoad(
      result.status === "valid"
        ? {
            status: result.status,
            kind: result.kind,
            updatedAt: result.updatedAt,
          }
        : result,
    );
    setDocument(result.status === "valid" ? result.document : null);
    setArchiveKind(result.status === "empty" ? null : result.kind);
  }

  async function runRecoveryOperation(operation: () => Promise<void>) {
    if (recoveryOperationRef.current) return;
    recoveryOperationRef.current = true;
    setRecoveryBusy(true);
    try {
      await operation();
    } catch (error) {
      if (error instanceof Error && error.message === "archive-conflict") {
        archiveConflictRef.current = true;
        setDocumentPersistence({ status: "conflict" });
      }
      throw error;
    } finally {
      recoveryOperationRef.current = false;
      setRecoveryBusy(false);
    }
  }

  async function retryArchiveLoad() {
    if (archiveLoadRef.current.status !== "read-error" && !canRecoverDocument())
      return;
    await runRecoveryOperation(async () => {
      // A rejection keeps the unknown state or previously read recovery source.
      applyArchiveLoad(await browserStorage.loadDocument());
    });
  }

  async function importRecoveryBackup(nextDocument: KeeprawFlyDocument) {
    if (!canRecoverDocument()) return;
    await runRecoveryOperation(async () => {
      // The recovery UI confirms replacement. Keep the raw source visible until
      // IndexedDB has committed the explicitly selected, validated backup.
      await browserStorage.saveDocument(nextDocument, "personal");
      applyArchiveLoad({
        status: "valid",
        document: nextDocument,
        kind: "personal",
        updatedAt: new Date().toISOString(),
      });
      setStorageError(null);
      setPassportView(initialPassportView);
      setPage("passport");
      setSelectedFlightId(null);
      window.location.hash = "passport";
    });
  }

  async function clearRecoveryArchive() {
    if (!canRecoverDocument()) return;
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
    let active = true;
    setLanguageLoadError(false);
    void changeUiLanguage(settings.language).catch(() => {
      if (active) setLanguageLoadError(true);
    });
    if (loaded) loadChineseWebfonts(settings.language, window.document);
    return () => {
      active = false;
    };
  }, [settings.language, loaded, languageRetry]);

  useEffect(() => {
    if (!loaded) return;
    // Do not compete with a slow airport/archive startup. StrictMode cleanup
    // also prevents duplicate background timers.
    const timer = window.setTimeout(() => {
      void warmLocaleCache();
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    applyAppearance(settings.appearance);
    delete window.document.documentElement.dataset.startupTheme;
  }, [loaded, settings.appearance]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [page, selectedFlightId]);

  // Leaving Passport closes the share overlay; returning never reopens it.
  useEffect(() => {
    setShareOpen(false);
  }, [page, selectedFlightId]);

  useEffect(() => {
    if (retiredPassportHashes.has(window.location.hash.slice(1))) {
      window.history.replaceState(null, "", "#passport");
    }
    const handleHashChange = () => {
      const nextPage = pageFromLocationHash();
      if (nextPage) {
        if (retiredPassportHashes.has(window.location.hash.slice(1))) {
          window.history.replaceState(null, "", "#passport");
        }
        setPage(nextPage);
        if (nextPage !== "settings") setSettingsInitialCategory("general");
        setSelectedFlightId(null);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const hasUnsavedChanges =
    documentPersistence.status === "saving" ||
    documentPersistence.status === "error" ||
    documentPersistence.status === "conflict" ||
    settingsPersistence.status === "saving" ||
    settingsPersistence.status === "error";

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
    if (!canWriteDocument()) return Promise.resolve(false);
    conflictDraftRef.current = { document: nextDocument, kind: nextKind };
    setDocument(nextDocument);
    setArchiveKind(nextKind);
    return documentWrites.save({ document: nextDocument, kind: nextKind });
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

  function updateMemberships(
    nextMemberships: readonly FrequentFlyerMembership[],
  ) {
    if (!document) return;
    storeDocument(withFrequentFlyerMemberships(document, nextMemberships));
  }

  function clearDocument() {
    if (!canWriteDocument()) return;
    // Preserve the local content even if this clear loses a cross-tab race.
    if (document)
      conflictDraftRef.current = { document, kind: archiveKind ?? "personal" };
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
    if (!canWriteDocument()) return;
    setPassportView(initialPassportView);
    editorReturnFocusRef.current =
      window.document.activeElement instanceof HTMLElement
        ? window.document.activeElement
        : null;
    storeDocument(createEmptyDocument(), "personal");
    setPage("passport");
    setSelectedFlightId(null);
    setEditorFlightId("new");
    setDuplicateTemplate(null);
    window.location.hash = "passport";
  }

  async function importArchive(nextDocument: KeeprawFlyDocument) {
    if (!canWriteDocument()) throw new Error("archive-conflict");
    setPassportView(initialPassportView);
    const saved = storeDocument(nextDocument, "personal");
    setPage("passport");
    setSelectedFlightId(null);
    window.location.hash = "passport";
    // Do not let a late commit navigate away from the user's next page.
    // The importer still receives a rejection if the archive was not committed.
    if (!(await saved)) throw new Error("archive-not-saved");
  }

  function openDemoArchive() {
    if (!canWriteDocument()) return;
    setPassportView(initialPassportView);
    storeDocument(structuredClone(demoDocument), "demo");
    setPage("passport");
    setSelectedFlightId(null);
    window.location.hash = "passport";
  }

  async function saveFlight(flight: KeeprawFlight) {
    const sourceRevision = documentRevisionRef.current;
    if (!document || !canWriteDocument()) throw new Error("invalid-flight");
    const existingIndex = document.flights.findIndex(
      (item) => item.id === flight.id,
    );
    const flights =
      existingIndex === -1
        ? [...document.flights, flight]
        : document.flights.map((item) =>
            item.id === flight.id ? flight : item,
          );
    const nextDocument = { ...document, flights };
    const { validateKeeprawFly } = await import("@keepraw-fly/validator");
    // Reject before changing UI state or the retryable persistence snapshot.
    // The editor catches this error and keeps the user's draft open.
    if (
      sourceRevision !== documentRevisionRef.current ||
      !canWriteDocument() ||
      !validateKeeprawFly(nextDocument).valid
    )
      throw new Error("invalid-flight");
    storeDocument(nextDocument);
    setEditorFlightId(null);
    setDuplicateTemplate(null);
    openFlight(flight.id);
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

  async function exportDocument(kind: ExportKind = "backup") {
    if (!document) return;
    if (kind === "shareable") {
      // Not a backup: it neither restores the archive nor updates lastBackupAt.
      await downloadKeeprawFly(document, "shareable");
      return;
    }
    if (archiveKind === "demo") {
      setConfirmDemoExport(true);
      return;
    }
    await downloadKeeprawFly(document);
    storeSettings({ ...settings, lastBackupAt: new Date().toISOString() });
  }

  async function reloadAfterConflict() {
    setConflictReloadFailed(false);
    await runRecoveryOperation(async () => {
      const result = await browserStorage.loadDocument();
      // Keep the conflict and unload guard until reading succeeds. Pending
      // snapshots remain invalidated while the new base is being read.
      await documentWrites.reset();
      applyArchiveLoad(result);
      conflictDraftRef.current = null;
      archiveConflictRef.current = false;
      setEditorFlightId(null);
      setDuplicateTemplate(null);
      setSelectedFlightId(null);
      setConfirmConflictReload(false);
    }).catch(() => {
      setConflictReloadFailed(true);
      setConfirmConflictReload(false);
      setDocumentPersistence({ status: "conflict" });
    });
  }

  if (!loaded) {
    return (
      <main
        className="loading-screen"
        id="main-content"
        aria-label={t("app.loading")}
      >
        <span>K</span>
      </main>
    );
  }

  if (
    GlobeLab &&
    window.location.pathname === "/globe-lab" &&
    canWriteDocument()
  ) {
    return (
      <Suspense
        fallback={<main className="loading-screen">{t("app.loading")}</main>}
      >
        <GlobeLab
          document={document ?? demoDocument}
          settings={settings}
          isDemo={!document || archiveKind === "demo"}
          onSettingsChange={storeSettings}
        />
      </Suspense>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("app.skipToContent")}
      </a>
      <AppHeader
        currentPage={page}
        onNavigate={(nextPage) => {
          setSettingsInitialCategory("general");
          setPage(nextPage);
          setSelectedFlightId(null);
        }}
        detailActions={
          selectedFlight
            ? {
                onPrevious: previousFlight
                  ? () => openFlight(previousFlight.id)
                  : undefined,
                onNext: nextFlight
                  ? () => openFlight(nextFlight.id)
                  : undefined,
                onBack: () => {
                  setSelectedFlightId(null);
                  setPage("passport");
                  window.location.hash = "passport";
                },
                onDuplicate: () => {
                  editorReturnFocusRef.current =
                    window.document.activeElement instanceof HTMLElement
                      ? window.document.activeElement
                      : null;
                  setDuplicateTemplate(selectedFlight);
                  setEditorFlightId("new");
                },
                onEdit: () => {
                  editorReturnFocusRef.current =
                    window.document.activeElement instanceof HTMLElement
                      ? window.document.activeElement
                      : null;
                  setEditorFlightId(selectedFlight.id);
                },
              }
            : undefined
        }
      />
      <div className="persistence-status" role="status">
        {documentPersistence.status === "saving" ||
        settingsPersistence.status === "saving"
          ? t("actions.saving")
          : null}
      </div>
      {documentPersistence.status === "conflict" ? (
        <div className="page-notices">
          <div className="storage-warning" role="alert">
            <span>{t("app.archiveConflict")}</span>
            {conflictDraftRef.current || document ? (
              <button
                type="button"
                onClick={() => {
                  const draft = conflictDraftRef.current?.document ?? document;
                  if (draft) void downloadKeeprawFly(draft);
                }}
              >
                {t("app.exportConflictDraft")}
              </button>
            ) : null}
            <button
              type="button"
              disabled={recoveryBusy}
              onClick={() => setConfirmConflictReload(true)}
            >
              {t("app.loadSavedArchive")}
            </button>
            {conflictReloadFailed ? (
              <span>{t("app.storageUnavailable")}</span>
            ) : null}
          </div>
        </div>
      ) : null}
      {languageLoadError ? (
        <div className="page-notices" role="alert">
          <span>{t("app.languageLoadFailed")}</span>
          <button
            type="button"
            className="button-secondary"
            onClick={() => setLanguageRetry((value) => value + 1)}
          >
            {t("actions.retry")}
          </button>
        </div>
      ) : null}
      {storageError ||
      documentPersistence.status === "error" ||
      settingsPersistence.status === "error" ||
      (document && archiveKind === "demo") ? (
        <div className="page-notices">
          {documentPersistence.status === "error" ? (
            <div className="storage-warning" role="alert">
              <span>{t("app.changesNotSaved")}</span>
              <button
                type="button"
                onClick={() => {
                  void documentWrites.retry();
                }}
              >
                {t("actions.retry")}
              </button>
            </div>
          ) : storageError ? (
            <div className="storage-warning" role="alert">
              {t("app.storageUnavailable")}
            </div>
          ) : null}
          {settingsPersistence.status === "error" ? (
            <div className="storage-warning" role="alert">
              <span>{t("app.settingsNotSaved")}</span>
              <button
                type="button"
                onClick={() => {
                  void settingsWrites.retry();
                }}
              >
                {t("actions.retry")}
              </button>
            </div>
          ) : null}
          {document && archiveKind === "demo" ? (
            <DemoBanner
              compact={Boolean(selectedFlight) || page === "passport"}
              onCreateArchive={createArchive}
            />
          ) : null}
        </div>
      ) : null}
      {archiveLoad.status === "read-error" ? (
        <PageShell className="settings-page recovery-page">
          <div
            className="settings-content recovery-content"
            aria-busy={recoveryBusy}
          >
            <header className="recovery-heading">
              <h1>{t("recovery.readFailedTitle")}</h1>
              <p className="recovery-description" role="alert">
                {t("recovery.readFailedDescription")}
              </p>
            </header>
            <div className="recovery-actions">
              <button
                className="button-primary"
                type="button"
                disabled={recoveryBusy}
                onClick={() => void retryArchiveLoad().catch(() => {})}
              >
                {t("actions.retry")}
              </button>
            </div>
          </div>
        </PageShell>
      ) : recoveryArchive ? (
        <RecoveryPage
          archive={recoveryArchive}
          busy={recoveryBusy}
          onRetry={retryArchiveLoad}
          onImport={importRecoveryBackup}
          onClear={clearRecoveryArchive}
        />
      ) : page === "settings" ? (
        <SettingsPage
          initialCategory={settingsInitialCategory}
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
          appearance={settings.appearance}
          solarMode={settings.solarMode}
        />
      ) : page === "passport" ? (
        <PassportPage
          view={passportView}
          onViewChange={setPassportView}
          document={document}
          locale={locale}
          distanceUnit={settings.distanceUnit}
          timeFormat={settings.timeFormat}
          appearance={settings.appearance}
          solarMode={settings.solarMode}
          onOpenFlight={openFlight}
          onOpenShare={() => setShareOpen(true)}
          onAddFlight={() => {
            editorReturnFocusRef.current =
              window.document.activeElement instanceof HTMLElement
                ? window.document.activeElement
                : null;
            setDuplicateTemplate(null);
            setEditorFlightId("new");
          }}
          onOpenImport={() => {
            setSettingsInitialCategory("data");
            setPage("settings");
            window.location.hash = "settings";
            window.requestAnimationFrame(() =>
              window.requestAnimationFrame(() =>
                window.document
                  .getElementById("settings-import")
                  ?.scrollIntoView({ block: "start" }),
              ),
            );
          }}
        />
      ) : null}
      {document &&
      editorFlightId &&
      (editorFlightId === "new" || editedFlight) ? (
        <FlightEditor
          key={`${editorFlightId}-${duplicateTemplate?.id ?? "blank"}`}
          flight={
            editorFlightId === "new"
              ? (duplicateTemplate ?? undefined)
              : editedFlight
          }
          isDuplicate={editorFlightId === "new" && Boolean(duplicateTemplate)}
          preferredAirportCodes={preferredAirportCodes}
          returnFocus={editorReturnFocusRef.current}
          locale={locale}
          memberships={memberships}
          onSave={saveFlight}
          archiveConflict={documentPersistence.status === "conflict"}
          onDelete={editorFlightId === "new" ? undefined : deleteEditedFlight}
          onCancel={() => {
            setEditorFlightId(null);
            setDuplicateTemplate(null);
          }}
        />
      ) : null}
      {document && shareOpen && page === "passport" && !selectedFlight ? (
        <FlightPassportShareDialog
          document={document}
          locale={locale}
          distanceUnit={settings.distanceUnit}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
      {confirmDemoExport ? (
        <ConfirmationDialog
          themeScope={page === "settings" ? "settings" : undefined}
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
      {confirmConflictReload ? (
        <ConfirmationDialog
          title={t("app.loadSavedArchive")}
          description={t("app.discardConflictDraft")}
          confirmLabel={t("app.loadSavedArchive")}
          cancelLabel={t("actions.cancel")}
          onCancel={() => setConfirmConflictReload(false)}
          onConfirm={() => void reloadAfterConflict()}
        />
      ) : null}
    </div>
  );
}

function pageFromHash(): Page {
  return pageFromLocationHash() ?? "passport";
}

/** Retired hashes that now land on Passport: the old flight list and the
 * removed Share Studio page (sharing is an overlay on Passport). */
const retiredPassportHashes = new Set(["flights", "share"]);

function pageFromLocationHash(): Page | null {
  const hash = window.location.hash.slice(1);
  if (retiredPassportHashes.has(hash)) return "passport";
  return hash === "passport" || hash === "settings" ? hash : null;
}
