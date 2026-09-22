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
import { SettingsPage } from "./pages/SettingsPage";
import { downloadKeeprawFly } from "./data/export";
import { documentWithoutFlight, flightById } from "./data/archive";
import { createEmptyDocument } from "./data/flight-editor";
import { browserStorage } from "./storage/browser";
import type { ArchiveKind } from "./storage/adapter";
import { defaultViewerSettings, type ViewerSettings } from "./storage/types";
import {
  frequentFlyerMemberships,
  recentAirportCodes,
  withFrequentFlyerMemberships,
  type FrequentFlyerMembership,
} from "@keepraw-fly/core";

const demoDocument = demoData as KeeprawFlyDocument;

export function App() {
  const { i18n, t } = useTranslation();
  const [document, setDocument] = useState<KeeprawFlyDocument | null>(null);
  const [archiveKind, setArchiveKind] = useState<ArchiveKind | null>(null);
  const [settings, setSettings] = useState<ViewerSettings>(defaultViewerSettings);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
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

  useEffect(() => {
    let active = true;
    void Promise.all([
      browserStorage.loadDocument(),
      browserStorage.loadArchiveKind(),
      browserStorage.loadSettings(),
    ])
      .then(([storedDocument, storedArchiveKind, storedSettings]) => {
        if (!active) return;
        setDocument(storedDocument);
        setArchiveKind(storedArchiveKind);
        if (storedSettings) setSettings(storedSettings);
      })
      .catch(() => {
        if (active) setStorageError("storage");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

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

  async function storeDocument(
    nextDocument: KeeprawFlyDocument,
    nextKind: ArchiveKind = archiveKind ?? "personal",
  ) {
    setDocument(nextDocument);
    setArchiveKind(nextKind);
    try {
      await browserStorage.saveDocument(nextDocument, nextKind);
      setStorageError(null);
    } catch {
      setStorageError("storage");
    }
  }

  async function storeSettings(nextSettings: ViewerSettings) {
    setSettings(nextSettings);
    try {
      await browserStorage.saveSettings(nextSettings);
      setStorageError(null);
    } catch {
      setStorageError("storage");
    }
  }

  async function updateProfile(name: ProfileName | undefined) {
    if (!document) return;
    await storeDocument({
      ...document,
      profile: name ? { ...document.profile, name } : {},
    });
  }

  async function updateMemberships(nextMemberships: readonly FrequentFlyerMembership[]) {
    if (!document) return;
    await storeDocument(withFrequentFlyerMemberships(document, nextMemberships));
  }

  async function clearDocument() {
    try {
      await browserStorage.clearDocument();
      setDocument(null);
      setArchiveKind(null);
      setPage("passport");
      window.location.hash = "passport";
      setSelectedFlightId(null);
      setStorageError(null);
    } catch {
      setStorageError("storage");
    }
  }

  async function createArchive() {
    editorReturnFocusRef.current = window.document.activeElement instanceof HTMLElement
      ? window.document.activeElement
      : null;
    await storeDocument(createEmptyDocument(), "personal");
    setPage("passport");
    setSelectedFlightId(null);
    setEditorFlightId("new");
    setDuplicateTemplate(null);
    window.location.hash = "passport";
  }

  async function importArchive(nextDocument: KeeprawFlyDocument) {
    await storeDocument(nextDocument, "personal");
    setPage("passport");
    setSelectedFlightId(null);
    window.location.hash = "passport";
  }

  async function openDemoArchive() {
    await storeDocument(structuredClone(demoDocument), "demo");
    setPage("passport");
    setSelectedFlightId(null);
    window.location.hash = "passport";
  }

  async function saveFlight(flight: KeeprawFlight) {
    if (!document) return;
    const existingIndex = document.flights.findIndex((item) => item.id === flight.id);
    const flights = existingIndex === -1
      ? [...document.flights, flight]
      : document.flights.map((item) => item.id === flight.id ? flight : item);
    await storeDocument({ ...document, flights });
    setEditorFlightId(null);
    setDuplicateTemplate(null);
    setSelectedFlightId(flight.id);
    setPage("passport");
    window.history.replaceState(null, "", "#passport");
  }

  async function deleteEditedFlight() {
    if (!document || !editorFlightId || editorFlightId === "new") return;
    const deletedFlightId = editorFlightId;
    setEditorFlightId(null);
    if (selectedFlightId === deletedFlightId) setSelectedFlightId(null);
    await storeDocument(documentWithoutFlight(document, deletedFlightId));
  }

  function exportDocument() {
    if (!document) return;
    if (archiveKind === "demo") {
      setConfirmDemoExport(true);
      return;
    }
    downloadKeeprawFly(document);
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
      {storageError || (document && archiveKind === "demo") ? (
        <div className="page-notices">
          {storageError ? <div className="storage-warning" role="alert">{t("app.storageUnavailable")}</div> : null}
          {document && archiveKind === "demo" ? (
            <DemoBanner compact={Boolean(selectedFlight)} onCreateArchive={createArchive} />
          ) : null}
        </div>
      ) : null}
      {page === "settings" ? (
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
          onConfirm={() => {
            setConfirmDemoExport(false);
            if (document) downloadKeeprawFly(document);
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
