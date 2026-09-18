import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight, KeeprawFlyDocument, ProfileName } from "@keepraw-fly/schema";
import demoData from "@keepraw-fly/core/demo";
import { AppHeader, type Page } from "./components/AppHeader";
import { EmptyState } from "./components/EmptyState";
import { DemoBanner } from "./components/DemoBanner";
import { FlightEditor } from "./components/FlightEditor";
import { FlightsPage } from "./pages/FlightsPage";
import { FlightDetailPage } from "./pages/FlightDetailPage";
import { PassportPage } from "./pages/PassportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { downloadKeeprawFly } from "./data/export";
import { documentWithoutFlight, flightById } from "./data/archive";
import { createEmptyDocument } from "./data/flight-editor";
import { browserStorage } from "./storage/browser";
import type { ArchiveKind } from "./storage/adapter";
import { defaultViewerSettings, type ViewerSettings } from "./storage/types";
import { recentAirportCodes } from "@keepraw-fly/core";

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
    const handleHashChange = () => {
      const nextPage = pageFromLocationHash();
      if (nextPage) {
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

  async function clearDocument() {
    try {
      await browserStorage.clearDocument();
      setDocument(null);
      setArchiveKind(null);
      setPage("flights");
      window.location.hash = "flights";
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
    setPage("flights");
    setSelectedFlightId(null);
    setEditorFlightId("new");
    setDuplicateTemplate(null);
    window.location.hash = "flights";
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
    setPage("flights");
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
    if (archiveKind === "demo" && !window.confirm(t("demo.exportConfirmation"))) return;
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
      />
      {storageError || (document && archiveKind === "demo") ? (
        <div className="page-notices">
          {storageError ? <div className="storage-warning" role="alert">{t("app.storageUnavailable")}</div> : null}
          {document && archiveKind === "demo" ? <DemoBanner onCreateArchive={createArchive} /> : null}
        </div>
      ) : null}
      {page === "settings" ? (
        <SettingsPage
          document={document}
          isDemo={archiveKind === "demo"}
          settings={settings}
          onImport={(nextDocument) => storeDocument(nextDocument, "personal")}
          onExport={document ? exportDocument : undefined}
          onClear={document ? clearDocument : undefined}
          onSettingsChange={storeSettings}
          onProfileChange={updateProfile}
        />
      ) : !document ? (
        <EmptyState
          onCreateArchive={createArchive}
          onTryDemo={() => storeDocument(structuredClone(demoDocument), "demo")}
          onImport={(nextDocument) => storeDocument(nextDocument, "personal")}
        />
      ) : page === "flights" && selectedFlight ? (
        <FlightDetailPage
          flight={selectedFlight}
          locale={locale}
          timeFormat={settings.timeFormat}
          onBack={() => setSelectedFlightId(null)}
          onEdit={() => {
            editorReturnFocusRef.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
            setEditorFlightId(selectedFlight.id);
          }}
          onDuplicate={() => {
            editorReturnFocusRef.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
            setDuplicateTemplate(selectedFlight);
            setEditorFlightId("new");
          }}
        />
      ) : page === "flights" ? (
        <FlightsPage
          document={document}
          locale={locale}
          timeFormat={settings.timeFormat}
          onOpenFlight={setSelectedFlightId}
          onAddFlight={() => {
            editorReturnFocusRef.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
            setDuplicateTemplate(null);
            setEditorFlightId("new");
          }}
        />
      ) : page === "passport" ? (
        <PassportPage
          document={document}
          locale={locale}
          distanceUnit={settings.distanceUnit}
          onOpenFlight={(flightId) => {
            window.history.replaceState(null, "", "#flights");
            setPage("flights");
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
          onSave={saveFlight}
          onDelete={editorFlightId === "new" ? undefined : deleteEditedFlight}
          onCancel={() => { setEditorFlightId(null); setDuplicateTemplate(null); }}
        />
      ) : null}
    </div>
  );
}

function documentElementLanguage(language: ViewerSettings["language"]) {
  window.document.documentElement.lang = language;
}

function pageFromHash(): Page {
  return pageFromLocationHash() ?? "flights";
}

function pageFromLocationHash(): Page | null {
  const hash = window.location.hash.slice(1);
  return hash === "flights" || hash === "passport" || hash === "settings"
    ? hash
    : null;
}
