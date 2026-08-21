import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument, ProfileName } from "@keepraw-fly/schema";
import demoData from "@keepraw-fly/core/demo";
import { AppHeader, type Page } from "./components/AppHeader";
import { EmptyState } from "./components/EmptyState";
import { FlightsPage } from "./pages/FlightsPage";
import { FlightDetailPage } from "./pages/FlightDetailPage";
import { PassportPage } from "./pages/PassportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { downloadKeeprawFly } from "./data/export";
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
          onTryDemo={() => storeDocument(structuredClone(demoDocument))}
          onImport={storeDocument}
        />
      ) : page === "flights" && selectedFlightId ? (
        <FlightDetailPage
          flight={document.flights.find((flight) => flight.id === selectedFlightId)!}
          locale={locale}
          timeFormat={settings.timeFormat}
          onBack={() => setSelectedFlightId(null)}
        />
      ) : page === "flights" ? (
        <FlightsPage
          document={document}
          locale={locale}
          timeFormat={settings.timeFormat}
          onOpenFlight={setSelectedFlightId}
        />
      ) : page === "passport" ? (
        <PassportPage
          document={document}
          locale={locale}
          distanceUnit={settings.distanceUnit}
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
