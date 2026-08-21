import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import demoData from "@keepraw-fly/core/demo";
import { AppHeader, type Page } from "./components/AppHeader";
import { EmptyState } from "./components/EmptyState";
import { FlightsPage } from "./pages/FlightsPage";
import { FlightDetailPage } from "./pages/FlightDetailPage";
import { PassportPage } from "./pages/PassportPage";

const demoDocument = demoData as KeeprawFlyDocument;

export function App() {
  const { i18n } = useTranslation();
  const [document, setDocument] = useState<KeeprawFlyDocument | null>(null);
  const [page, setPage] = useState<Page>("flights");
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);

  const locale = useMemo(
    () => (i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en"),
    [i18n.resolvedLanguage],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [page, selectedFlightId]);

  return (
    <div className="app-shell">
      <AppHeader
        currentPage={page}
        onNavigate={(nextPage) => {
          setPage(nextPage);
          setSelectedFlightId(null);
        }}
      />
      {!document ? (
        <EmptyState onTryDemo={() => setDocument(structuredClone(demoDocument))} />
      ) : page === "flights" && selectedFlightId ? (
        <FlightDetailPage
          flight={document.flights.find((flight) => flight.id === selectedFlightId)!}
          locale={locale}
          onBack={() => setSelectedFlightId(null)}
        />
      ) : page === "flights" ? (
        <FlightsPage
          document={document}
          locale={locale}
          onOpenFlight={setSelectedFlightId}
        />
      ) : page === "passport" ? (
        <PassportPage document={document} locale={locale} />
      ) : (
        <main className="page-placeholder">
          <p className="eyebrow">Keepraw Fly</p>
          <h1>Settings</h1>
        </main>
      )}
    </div>
  );
}
