import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlight, KeeprawFlyDocument, ProfileName } from "@keepraw-fly/schema";
import demoData from "@keepraw-fly/core/demo";
import { AppHeader, type Page } from "./components/AppHeader";
import { EmptyState } from "./components/EmptyState";
import { FlightEditor } from "./components/FlightEditor";
import { FlightsPage } from "./pages/FlightsPage";
import { FlightDetailPage } from "./pages/FlightDetailPage";
import { PassportPage } from "./pages/PassportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { downloadKeeprawFly } from "./data/export";
import { createEmptyDocument } from "./data/flight-editor";
import { browserStorage } from "./storage/browser";
import { defaultViewerSettings, type ViewerSettings } from "./storage/types";

const demoDocument = demoData as KeeprawFlyDocument;

export function App() {
  const { i18n, t } = useTranslation();
  const [document, setDocument] = useState<KeeprawFlyDocument | null>(null);
  const [settings, setSettings] = useState<ViewerSettings>(defaultViewerSettings);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [editorFlightId, setEditorFlightId] = useState<string | "new" | null>(null);

  const locale = useMemo(() => settings.language, [settings.language]);

  useEffect(() => {
    let active = true;
    void Promise.all([browserStorage.loadDocument(), browserStorage.loadSettings()])
      .then(([storedDocument, storedSettings]) => {
        if (!active) return;
        setDocument(storedDocument);
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

  async function storeDocument(nextDocument: KeeprawFlyDocument) {
    setDocument(nextDocument);
    try {
      await browserStorage.saveDocument(nextDocument);
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
      setPage("flights");
      window.location.hash = "flights";
      setSelectedFlightId(null);
      setStorageError(null);
    } catch {
      setStorageError("storage");
    }
  }

  async function createArchive() {
    await storeDocument(createEmptyDocument());
    setPage("flights");
    setSelectedFlightId(null);
    setEditorFlightId("new");
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
    setSelectedFlightId(flight.id);
    setPage("flights");
  }

  async function deleteEditedFlight() {
    if (!document || !editorFlightId || editorFlightId === "new") return;
    await storeDocument({
      ...document,
      flights: document.flights.filter((flight) => flight.id !== editorFlightId),
    });
    setEditorFlightId(null);
    setSelectedFlightId(null);
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
      {storageError ? <div className="storage-warning" role="alert">{t("app.storageUnavailable")}</div> : null}
      {page === "settings" ? (
        <SettingsPage
          document={document}
          settings={settings}
          onImport={storeDocument}
          onExport={document ? () => downloadKeeprawFly(document) : undefined}
          onClear={document ? clearDocument : undefined}
          onSettingsChange={storeSettings}
          onProfileChange={updateProfile}
        />
      ) : !document ? (
        <EmptyState
          onCreateArchive={createArchive}
          onTryDemo={() => storeDocument(structuredClone(demoDocument))}
          onImport={storeDocument}
        />
      ) : page === "flights" && selectedFlightId ? (
        <FlightDetailPage
          flight={document.flights.find((flight) => flight.id === selectedFlightId)!}
          locale={locale}
          timeFormat={settings.timeFormat}
          onBack={() => setSelectedFlightId(null)}
          onEdit={() => setEditorFlightId(selectedFlightId)}
        />
      ) : page === "flights" ? (
        <FlightsPage
          document={document}
          locale={locale}
          timeFormat={settings.timeFormat}
          onOpenFlight={setSelectedFlightId}
          onAddFlight={() => setEditorFlightId("new")}
        />
      ) : page === "passport" ? (
        <PassportPage
          document={document}
          locale={locale}
          distanceUnit={settings.distanceUnit}
        />
      ) : null}
      {document && editorFlightId ? (
        <FlightEditor
          key={editorFlightId}
          flight={editorFlightId === "new"
            ? undefined
            : document.flights.find((flight) => flight.id === editorFlightId)}
          locale={locale}
          onSave={saveFlight}
          onDelete={editorFlightId === "new" ? undefined : deleteEditedFlight}
          onCancel={() => setEditorFlightId(null)}
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
