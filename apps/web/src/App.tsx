import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import type {
  KeeprawFlight,
  KeeprawFlyDocument,
  ProfileName,
} from "@keepraw-fly/schema";
import demoData from "@keepraw-fly/core/demo";
import { AppHeader, PrimaryTabBar } from "./components/AppHeader";
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
import {
  formatExplorationQuery,
  parseExplorationQuery,
} from "./data/exploration-query";
import { SettingsPage } from "./pages/SettingsPage";
import { ImportPage } from "./pages/ImportPage";
import { RecoveryPage } from "./pages/RecoveryPage";
import { downloadKeeprawFly, type ExportKind } from "./data/export";
import { ImportFileError, importLimitValues } from "./data/import-limits";
import { documentWithoutFlight, flightById } from "./data/archive";
import { createEmptyDocument } from "./data/flight-editor";
import { browserStorage } from "./storage/browser";
import type { ArchiveKind, ArchiveLoadResult } from "./storage/adapter";
import {
  createPersistenceQueue,
  createSettingsPersistenceQueue,
  type PersistenceState,
} from "./storage/persistence";
import { defaultViewerSettings, type ViewerSettings } from "./storage/types";
import { loadChineseWebfonts } from "./typography/load-webfonts";
import {
  applyAppearance,
  initialAppearance,
  initialSkin,
  resolveAppearance,
} from "./appearance";
import { resolveSkin, skinMapTheme } from "./skins/registry";
import {
  isLandingFragment,
  PRIMARY_VIEWS,
  formatRoute,
  parseRoute,
  sameRoute,
  type PrimaryView,
  type Route,
} from "./routing";
import { changeUiLanguage } from "./i18n";
import { warmLocaleCache } from "./locales/resources";
import {
  frequentFlyerMemberships,
  recentAirportCodes,
  withFrequentFlyerMemberships,
  type FrequentFlyerMembership,
} from "@keepraw-fly/core";

const demoDocument = demoData as KeeprawFlyDocument;
const LARGE_IMPORT_FLIGHT_COUNT = 10_000;
type DocumentSnapshot = {
  document: KeeprawFlyDocument;
  kind: ArchiveKind;
} | null;
type FlightEditorSession =
  | { kind: "create"; template?: KeeprawFlight }
  | { kind: "edit"; flightId: string };
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

function useSystemDark(): boolean {
  const query = "(prefers-color-scheme: dark)";
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia?.(query);
      media?.addEventListener("change", notify);
      return () => media?.removeEventListener("change", notify);
    },
    () => window.matchMedia?.(query).matches ?? false,
  );
}

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
    skin: initialSkin(),
  }));
  const skin = resolveSkin(settings.skin);
  const landingView = skin.landingView;
  const systemDark = useSystemDark();
  const mapTheme = skinMapTheme(
    skin,
    resolveAppearance(settings.appearance, () => ({ matches: systemDark })),
  );
  // Readable from event handlers that outlive a render.
  const landingViewRef = useRef(landingView);
  landingViewRef.current = landingView;
  // True while the address names no view and the user has not navigated: the
  // stored skin, once read, may then still choose a different landing view.
  const landingPendingRef = useRef(isLandingFragment(window.location.hash));
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
    createSettingsPersistenceQueue(
      (patch) => browserStorage.saveSettings(patch),
      setSettingsPersistence,
    ),
  );
  const [route, setRouteState] = useState<Route>(
    () =>
      parseRoute(window.location.hash, landingView) ?? { view: landingView },
  );
  // The route as last set, readable from event handlers before a render.
  const routeRef = useRef(route);
  function setRoute(next: Route) {
    routeRef.current = next;
    setRouteState(next);
  }
  const selectedFlightId = route.view === "flight" ? route.flightId : null;
  // The primary view to return to from Flight or Settings.
  const lastPrimaryViewRef = useRef<PrimaryView>(
    primaryView(route.view) ?? landingView,
  );
  const [flightNotFound, setFlightNotFound] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [passportView, setPassportView] = useState<PassportViewState>(() => ({
    ...initialPassportView,
    ...(parseExplorationQuery(window.location.hash) ?? historyExploration()),
  }));
  // The exploration state as last set, readable from event handlers.
  const passportViewRef = useRef(passportView);
  passportViewRef.current = passportView;
  const [editor, setEditor] = useState<FlightEditorSession | null>(null);
  const [confirmDemoExport, setConfirmDemoExport] = useState(false);
  const [exportError, setExportError] = useState<
    "too-many-records" | "file-too-large" | "download-failed" | null
  >(null);
  const editorReturnFocusRef = useRef<HTMLElement | null>(null);

  const locale = i18n.language;
  const selectedFlight = useMemo(
    () => flightById(document, selectedFlightId),
    [document, selectedFlightId],
  );
  const editedFlight = useMemo(
    () =>
      editor?.kind === "edit"
        ? flightById(document, editor.flightId)
        : undefined,
    [document, editor],
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

  // Flight entries remember the view they were opened from, so Back in the
  // header and the browser's Back button lead to the same place.
  const flightOrigin =
    route.view === "flight" ? primaryView(historyOrigin()) : null;
  const returnView = flightOrigin ?? lastPrimaryViewRef.current;

  /** Whether this history entry already carries the mirrored exploration state. */
  function entryMirrored(): boolean {
    const state: unknown = window.history.state;
    return Boolean(state && typeof state === "object" && "explored" in state);
  }

  function mirroredState(): object {
    const state: unknown = window.history.state;
    return {
      ...(state && typeof state === "object" ? state : null),
      explored: true,
    };
  }

  /** The address of a route; primary views carry the exploration query. */
  function fragmentFor(next: Route): string {
    return primaryView(next.view)
      ? formatRoute(next) + formatExplorationQuery(passportViewRef.current)
      : formatRoute(next);
  }

  function navigate(
    next: Route,
    mode: "push" | "replace" = "push",
    state: unknown = null,
  ) {
    const fragment = fragmentFor(next);
    if (mode === "replace") window.history.replaceState(state, "", fragment);
    else if (window.location.hash !== fragment)
      window.history.pushState(state, "", fragment);
    landingPendingRef.current = false;
    setFlightNotFound(false);
    setRoute(next);
  }

  function openFlight(flightId: string) {
    setPassportView((view) => ({
      ...view,
      flightId: null,
      scrollFlightId: flightId,
    }));
    const next: Route = { view: "flight", flightId };
    // Previous/next and saving an open flight stay on the same history entry.
    if (route.view === "flight")
      navigate(next, "replace", window.history.state);
    else
      navigate(next, "push", {
        from: returnViewFor(route),
        // Kept for a reload, so previous/next still walk the list it came from.
        explore: formatExplorationQuery(passportViewRef.current),
      });
  }

  function returnViewFor(current: Route): PrimaryView {
    return primaryView(current.view) ?? lastPrimaryViewRef.current;
  }

  function closeFlight() {
    // Read the entry itself: an in-page anchor adds one without an origin.
    if (primaryView(historyOrigin())) window.history.back();
    else navigate({ view: lastPrimaryViewRef.current }, "replace");
  }

  /** Leave a flight that no longer exists without adding a history entry. */
  function leaveFlight() {
    if (parseRoute(window.location.hash)?.view === "flight")
      navigate({ view: lastPrimaryViewRef.current }, "replace");
  }

  useEffect(() => {
    const view = primaryView(route.view);
    if (view) lastPrimaryViewRef.current = view;
  }, [route]);

  // The exploration state is mirrored into the address without adding history.
  useEffect(() => {
    if (!primaryView(route.view)) return;
    const current = parseRoute(window.location.hash);
    if (!current || !sameRoute(current, route)) return;
    const fragment = formatRoute(route) + formatExplorationQuery(passportView);
    if (window.location.hash !== fragment || !entryMirrored())
      window.history.replaceState(mirroredState(), "", fragment);
  }, [route, passportView]);

  // A year without flights (a stale address, or its last flight deleted)
  // falls back to the whole archive instead of an empty view.
  useEffect(() => {
    const year = passportView.year;
    if (!document || year === "lifetime") return;
    if (
      document.flights.some((flight) =>
        flight.serviceDate.startsWith(`${year}`),
      )
    )
      return;
    setPassportView((view) => ({ ...view, year: "lifetime" }));
  }, [document, passportView.year]);

  // A link to a flight that is not in this archive opens Log with a notice.
  useEffect(() => {
    if (!loaded || !document || route.view !== "flight") return;
    if (flightById(document, route.flightId)) return;
    window.history.replaceState(null, "", formatRoute({ view: "log" }));
    setRoute({ view: "log" });
    setFlightNotFound(true);
  }, [loaded, document, route]);

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
        if (settingsResult.status === "fulfilled" && settingsResult.value) {
          setSettings(settingsResult.value);
          // The first-paint hint can be missing or stale; the stored skin wins
          // while the entry still shows a landing view nobody chose.
          const landing = resolveSkin(settingsResult.value.skin).landingView;
          if (landingPendingRef.current && routeRef.current.view !== landing) {
            lastPrimaryViewRef.current = landing;
            window.history.replaceState(
              mirroredState(),
              "",
              fragmentFor({ view: landing }),
            );
            setRoute({ view: landing });
          }
        }
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
      openImportedArchive(nextDocument);
    });
  }

  async function clearRecoveryArchive() {
    if (!canRecoverDocument()) return;
    await runRecoveryOperation(async () => {
      await browserStorage.clearDocument();
      applyArchiveLoad({ status: "empty" });
      setStorageError(null);
      navigate({ view: landingView });
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
    applyAppearance(settings.appearance, settings.skin);
    delete window.document.documentElement.dataset.startupTheme;
  }, [loaded, settings.appearance, settings.skin]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [route.view, selectedFlightId]);

  // Leaving Passport closes the share overlay; returning never reopens it.
  useEffect(() => {
    setShareOpen(false);
  }, [route.view, selectedFlightId]);

  useEffect(() => {
    // Links, typed addresses and Back/Forward all arrive here. An unknown
    // fragment (an in-page anchor such as Skip to content) leaves the view
    // alone; its entry takes the view's address so reload and Back still work.
    const syncRoute = () => {
      const next = parseRoute(window.location.hash, landingViewRef.current);
      if (!next) {
        window.history.replaceState(
          window.history.state,
          "",
          fragmentFor(routeRef.current),
        );
        return;
      }
      // A query in the address sets the exploration state. Without one, a new
      // address (a link, a typed fragment) keeps the state in memory, and an
      // entry this app already mirrored (Back, Forward, reload) means defaults.
      const query = primaryView(next.view)
        ? (parseExplorationQuery(window.location.hash) ??
          (entryMirrored() ? parseExplorationQuery("?") : null))
        : null;
      if (
        query &&
        formatExplorationQuery(query) !==
          formatExplorationQuery(passportViewRef.current)
      ) {
        passportViewRef.current = {
          ...passportViewRef.current,
          ...query,
          flightId: null,
          scrollFlightId: null,
        };
        setPassportView(passportViewRef.current);
      }
      const fragment = fragmentFor(next);
      if (window.location.hash !== fragment)
        window.history.replaceState(
          primaryView(next.view) ? mirroredState() : window.history.state,
          "",
          fragment,
        );
      // A hash navigation raises both events; the second one changes nothing.
      if (sameRoute(routeRef.current, next)) return;
      setFlightNotFound(false);
      routeRef.current = next;
      setRouteState(next);
    };
    const followAddress = () => {
      landingPendingRef.current = false;
      syncRoute();
    };
    syncRoute();
    window.addEventListener("popstate", followAddress);
    window.addEventListener("hashchange", followAddress);
    return () => {
      window.removeEventListener("popstate", followAddress);
      window.removeEventListener("hashchange", followAddress);
    };
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

  function storeSettings(patch: Partial<ViewerSettings>) {
    setSettings((current) => ({ ...current, ...patch }));
    void settingsWrites.save(patch);
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
    navigate({ view: landingView });
    setEditor(null);
  }

  function createArchive() {
    if (!canWriteDocument()) return;
    setPassportView(initialPassportView);
    editorReturnFocusRef.current =
      window.document.activeElement instanceof HTMLElement
        ? window.document.activeElement
        : null;
    storeDocument(createEmptyDocument(), "personal");
    navigate({ view: landingView });
    setEditor({ kind: "create" });
  }

  function openImportedArchive(nextDocument: KeeprawFlyDocument) {
    // The primary views mount the whole flight list. Keep large import completions
    // responsive by opening the Data and backup settings after the save starts.
    setPassportView(initialPassportView);
    navigate(
      nextDocument.flights.length >= LARGE_IMPORT_FLIGHT_COUNT
        ? { view: "settings", part: "data" }
        : { view: landingView },
    );
  }

  async function importArchive(nextDocument: KeeprawFlyDocument) {
    if (!canWriteDocument()) throw new Error("archive-conflict");
    const saved = storeDocument(nextDocument, "personal");
    openImportedArchive(nextDocument);
    // Do not let a late commit navigate away from the user's next page.
    // The importer still receives a rejection if the archive was not committed.
    if (!(await saved)) throw new Error("archive-not-saved");
  }

  function openDemoArchive() {
    if (!canWriteDocument()) return;
    setPassportView(initialPassportView);
    storeDocument(structuredClone(demoDocument), "demo");
    navigate({ view: landingView });
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
    setEditor(null);
    openFlight(flight.id);
  }

  function deleteEditedFlight() {
    if (!document || editor?.kind !== "edit") return;
    const deletedFlightId = editor.flightId;
    setEditor(null);
    if (selectedFlightId === deletedFlightId) leaveFlight();
    storeDocument(documentWithoutFlight(document, deletedFlightId));
  }

  async function downloadArchiveCopy(
    source: KeeprawFlyDocument,
    kind: ExportKind = "backup",
  ) {
    setExportError(null);
    try {
      await downloadKeeprawFly(source, kind);
      return true;
    } catch (error) {
      setExportError(
        error instanceof ImportFileError && error.code !== "empty-file"
          ? error.code
          : "download-failed",
      );
      return false;
    }
  }

  async function exportDocument(kind: ExportKind = "backup") {
    if (!document) return;
    if (kind === "shareable") {
      // Not a backup: it neither restores the archive nor updates lastBackupAt.
      await downloadArchiveCopy(document, "shareable");
      return;
    }
    if (archiveKind === "demo") {
      setConfirmDemoExport(true);
      return;
    }
    if (await downloadArchiveCopy(document))
      storeSettings({ lastBackupAt: new Date().toISOString() });
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
      setEditor(null);
      leaveFlight();
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

  // Welcome, recovery and read-error states take precedence over routes.
  const archiveBlocked =
    archiveLoad.status === "read-error" || Boolean(recoveryArchive);
  const hasOpenArchive = Boolean(document) && !archiveBlocked;
  // The tab bar belongs to the primary views only. The header keeps Add flight
  // on Settings too, so the navigation does not move between views.
  const canAddFlight = hasOpenArchive && primaryView(route.view) !== null;

  function addFlight() {
    editorReturnFocusRef.current =
      window.document.activeElement instanceof HTMLElement
        ? window.document.activeElement
        : null;
    setEditor({ kind: "create" });
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t("app.skipToContent")}
      </a>
      <AppHeader
        route={route}
        landingView={landingView}
        hasArchive={hasOpenArchive}
        onNavigate={navigate}
        onAddFlight={hasOpenArchive ? addFlight : undefined}
        onBack={() => navigate({ view: lastPrimaryViewRef.current })}
        detailActions={
          selectedFlight && !archiveBlocked
            ? {
                backLabel: t(`nav.${returnView}`),
                onPrevious: previousFlight
                  ? () => openFlight(previousFlight.id)
                  : undefined,
                onNext: nextFlight
                  ? () => openFlight(nextFlight.id)
                  : undefined,
                onBack: closeFlight,
                onDuplicate: () => {
                  editorReturnFocusRef.current =
                    window.document.activeElement instanceof HTMLElement
                      ? window.document.activeElement
                      : null;
                  setEditor({ kind: "create", template: selectedFlight });
                },
                onEdit: () => {
                  editorReturnFocusRef.current =
                    window.document.activeElement instanceof HTMLElement
                      ? window.document.activeElement
                      : null;
                  setEditor({ kind: "edit", flightId: selectedFlight.id });
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
                  if (draft) void downloadArchiveCopy(draft);
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
      exportError ||
      documentPersistence.status === "error" ||
      settingsPersistence.status === "error" ||
      (document && archiveKind === "demo") ? (
        <div className="page-notices">
          {exportError ? (
            <div className="storage-warning" role="alert">
              {t(`settings.exportErrors.${exportError}`, importLimitValues)}
            </div>
          ) : null}
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
            <DemoBanner compact onCreateArchive={createArchive} />
          ) : null}
        </div>
      ) : null}
      {flightNotFound ? (
        <div className="page-notices">
          <div className="storage-warning" role="status">
            <span>{t("app.flightNotFound")}</span>
            <button type="button" onClick={() => setFlightNotFound(false)}>
              {t("app.dismissNotice")}
            </button>
          </div>
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
      ) : route.view === "settings" ? (
        <SettingsPage
          initialCategory={route.part}
          onCategoryChange={(part) =>
            navigate(
              part === "general"
                ? { view: "settings" }
                : { view: "settings", part },
              "replace",
            )
          }
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
      ) : route.view === "import" ? (
        <ImportPage
          document={document}
          isDemo={archiveKind === "demo"}
          onImport={importArchive}
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
          flights={document?.flights ?? []}
          memberships={memberships}
          locale={locale}
          distanceUnit={settings.distanceUnit}
          timeFormat={settings.timeFormat}
          mapTheme={mapTheme}
          skin={settings.skin}
        />
      ) : route.view === "flight" ? null : (
        <PassportPage
          mode={route.view}
          view={passportView}
          onViewChange={setPassportView}
          document={document}
          locale={locale}
          distanceUnit={settings.distanceUnit}
          timeFormat={settings.timeFormat}
          mapTheme={mapTheme}
          onOpenFlight={openFlight}
          onOpenShare={() => setShareOpen(true)}
          onAddFlight={addFlight}
          onOpenImport={() => navigate({ view: "import" })}
        />
      )}
      {canAddFlight ? (
        <PrimaryTabBar
          landingView={landingView}
          route={route}
          onNavigate={navigate}
          onAddFlight={addFlight}
        />
      ) : null}
      {document && editor && (editor.kind === "create" || editedFlight) ? (
        <FlightEditor
          key={
            editor.kind === "edit"
              ? `edit:${editor.flightId}`
              : editor.template
                ? `duplicate:${editor.template.id}`
                : "create"
          }
          flight={editor.kind === "create" ? editor.template : editedFlight}
          isDuplicate={editor.kind === "create" && Boolean(editor.template)}
          preferredAirportCodes={preferredAirportCodes}
          returnFocus={editorReturnFocusRef.current}
          locale={locale}
          memberships={memberships}
          onSave={saveFlight}
          archiveConflict={documentPersistence.status === "conflict"}
          onDelete={editor.kind === "edit" ? deleteEditedFlight : undefined}
          onCancel={() => setEditor(null)}
        />
      ) : null}
      {document && shareOpen && route.view === "map" ? (
        <FlightPassportShareDialog
          document={document}
          locale={locale}
          distanceUnit={settings.distanceUnit}
          mapTheme={mapTheme}
          passportTemplate={skin.passportTemplate}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
      {confirmDemoExport ? (
        <ConfirmationDialog
          themeScope={
            route.view === "settings" || route.view === "import"
              ? "settings"
              : undefined
          }
          title={t("demo.exportTitle")}
          description={t("demo.exportConfirmation")}
          confirmLabel={t("actions.export")}
          cancelLabel={t("actions.cancel")}
          onCancel={() => setConfirmDemoExport(false)}
          onConfirm={async () => {
            setConfirmDemoExport(false);
            if (document) await downloadArchiveCopy(document);
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

function primaryView(value: unknown): PrimaryView | null {
  return (PRIMARY_VIEWS as readonly unknown[]).includes(value)
    ? (value as PrimaryView)
    : null;
}

/** The exploration state a Flight history entry was opened with, if any. */
function historyExploration() {
  const state: unknown = window.history.state;
  return state &&
    typeof state === "object" &&
    "explore" in state &&
    typeof state.explore === "string"
    ? parseExplorationQuery(state.explore)
    : null;
}

/** The view a Flight history entry was opened from, if this session set it. */
function historyOrigin(): unknown {
  const state: unknown = window.history.state;
  return state && typeof state === "object" && "from" in state
    ? state.from
    : null;
}
