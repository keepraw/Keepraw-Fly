import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { KeeprawFlyDocument } from "@keepraw-fly/schema";
import demoData from "@keepraw-fly/core/demo";
import { AppHeader, type Page } from "./components/AppHeader";
import { EmptyState } from "./components/EmptyState";
import { FlightsPage } from "./pages/FlightsPage";

const demoDocument = demoData as KeeprawFlyDocument;

export function App() {
  const { i18n } = useTranslation();
  const [document, setDocument] = useState<KeeprawFlyDocument | null>(null);
  const [page, setPage] = useState<Page>("flights");

  const locale = useMemo(
    () => (i18n.resolvedLanguage === "zh-CN" ? "zh-CN" : "en"),
    [i18n.resolvedLanguage],
  );

  return (
    <div className="app-shell">
      <AppHeader currentPage={page} onNavigate={setPage} />
      {!document ? (
        <EmptyState onTryDemo={() => setDocument(structuredClone(demoDocument))} />
      ) : page === "flights" ? (
        <FlightsPage document={document} locale={locale} />
      ) : (
        <main className="page-placeholder">
          <p className="eyebrow">Keepraw Fly</p>
          <h1>{page === "passport" ? "Passport" : "Settings"}</h1>
        </main>
      )}
    </div>
  );
}
