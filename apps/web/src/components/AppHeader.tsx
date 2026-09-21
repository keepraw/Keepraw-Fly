import { useTranslation } from "react-i18next";

export type Page = "flights" | "passport" | "settings";

interface AppHeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  detailActions?: {
    onBack: () => void;
    onDuplicate: () => void;
    onEdit: () => void;
  };
}

export function AppHeader({ currentPage, onNavigate, detailActions }: AppHeaderProps) {
  const { t } = useTranslation();
  const links: Array<{ page: Page; label: string }> = [
    { page: "flights", label: t("nav.flights") },
    { page: "passport", label: t("nav.passport") },
    { page: "settings", label: t("nav.settings") },
  ];

  return (
    <header className={`site-header${detailActions ? " site-header--detail" : ""}`}>
      <div className="site-header-inner">
        {detailActions ? <>
          <button className="detail-header-back" type="button" onClick={detailActions.onBack}>
            <HeaderIcon kind="back" />
            <span>{t("nav.flights")}</span>
          </button>
          <div className="detail-header-actions">
            <button className="detail-header-action" type="button" onClick={detailActions.onDuplicate}>
              <HeaderIcon kind="duplicate" />
              <span>{t("actions.duplicateFlight")}</span>
            </button>
            <button className="detail-header-action" type="button" onClick={detailActions.onEdit}>
              <HeaderIcon kind="edit" />
              <span>{t("actions.editFlight")}</span>
            </button>
          </div>
        </> : <>
          <a
            className="wordmark"
            href="#flights"
            aria-label={t("app.homeLabel")}
            onClick={() => onNavigate("flights")}
          >
            <span className="wordmark-name">KEEPRAW FLY</span>
            <span className="wordmark-context" aria-hidden="true">LOGBOOK</span>
          </a>
          <nav className="site-navigation" aria-label={t("nav.label")}>
            {links.map(({ page, label }) => (
              <a
                key={page}
                href={`#${page}`}
                aria-current={currentPage === page ? "page" : undefined}
                onClick={() => onNavigate(page)}
              >
                {label}
              </a>
            ))}
          </nav>
        </>}
      </div>
    </header>
  );
}

function HeaderIcon({ kind }: { kind: "back" | "duplicate" | "edit" }) {
  if (kind === "back") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>;
  }
  if (kind === "duplicate") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7v8a2 2 0 0 0 2 2h6M8 7V5a2 2 0 0 1 2-2h4.6a1 1 0 0 1 .7.3l4.4 4.4a1 1 0 0 1 .3.7V15a2 2 0 0 1-2 2h-2M8 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15.2 5.2 3.6 3.6m-2.1-5.1a2.5 2.5 0 1 1 3.6 3.6L6.5 21H3v-3.5L16.7 3.7Z" /></svg>;
}
