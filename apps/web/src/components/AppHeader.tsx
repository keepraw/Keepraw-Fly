import { useTranslation } from "react-i18next";

export type Page = "passport" | "settings";

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
    { page: "passport", label: t("nav.passport") },
    { page: "settings", label: t("nav.settings") },
  ];

  function navigate(page: Page) {
    onNavigate(page);
    window.location.hash = page;
  }

  return (
    <>
      <header className={`site-header${detailActions ? " site-header--detail" : ""}`}>
        <div className="site-header-inner">
          {detailActions ? <>
            <button className="detail-header-back" type="button" onClick={detailActions.onBack}>
              <HeaderIcon kind="back" />
              <span>{t("nav.passport")}</span>
            </button>
            <div className="detail-header-actions">
              <button className="detail-header-action" type="button" onClick={detailActions.onDuplicate}>
                <HeaderIcon kind="duplicate" />
                <span>{t("actions.duplicateFlight")}</span>
              </button>
              <details className="detail-header-more" onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.removeAttribute("open");
              }} onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.currentTarget.removeAttribute("open");
                  event.currentTarget.querySelector("summary")?.focus();
                }
              }}>
                <summary aria-label={t("actions.moreActions")} title={t("actions.moreActions")}>
                  <HeaderIcon kind="more" />
                </summary>
                <div className="detail-header-more-menu">
                  <button type="button" onClick={(event) => {
                    event.currentTarget.closest("details")?.removeAttribute("open");
                    detailActions.onDuplicate();
                  }}>
                    <HeaderIcon kind="duplicate" />
                    {t("actions.duplicateFlight")}
                  </button>
                </div>
              </details>
              <button className="detail-header-action" type="button" onClick={detailActions.onEdit}>
                <HeaderIcon kind="edit" />
                <span>{t("actions.editFlight")}</span>
              </button>
            </div>
          </> : <>
            <a
              className="wordmark"
              href="#passport"
              aria-label={t("app.homeLabel")}
              onClick={() => onNavigate("passport")}
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
          {!detailActions ? <div className="mobile-page-heading">
            {currentPage === "settings" ? <button className="mobile-page-back" type="button" onClick={() => navigate("passport")} aria-label={t("nav.backToPassport")}><HeaderIcon kind="back" /></button> : null}
            <h1>{t(`nav.${currentPage}`)}</h1>
            {currentPage === "passport" ? <button className="mobile-settings-button" type="button" onClick={() => navigate("settings")} aria-label={t("nav.settings")}><HeaderIcon kind="settings" /></button> : null}
          </div> : null}
        </div>
      </header>
    </>
  );
}

function HeaderIcon({ kind }: { kind: "back" | "duplicate" | "edit" | "more" | "settings" }) {
  if (kind === "back") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>;
  }
  if (kind === "duplicate") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7v8a2 2 0 0 0 2 2h6M8 7V5a2 2 0 0 1 2-2h4.6a1 1 0 0 1 .7.3l4.4 4.4a1 1 0 0 1 .3.7V15a2 2 0 0 1-2 2h-2M8 7H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2" /></svg>;
  }
  if (kind === "settings") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.8 2.8h4.4l.5 2.3a7.5 7.5 0 0 1 1.5.9l2.2-.7 2.2 3.8-1.7 1.6a7.7 7.7 0 0 1 0 1.7l1.7 1.6-2.2 3.8-2.2-.7a7.5 7.5 0 0 1-1.5.9l-.5 2.3H9.8l-.5-2.3a7.5 7.5 0 0 1-1.5-.9l-2.2.7-2.2-3.8 1.7-1.6a7.7 7.7 0 0 1 0-1.7L3.4 9.1l2.2-3.8 2.2.7a7.5 7.5 0 0 1 1.5-.9l.5-2.3Z" /><circle cx="12" cy="11.5" r="2.6" /></svg>;
  }
  if (kind === "more") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15.2 5.2 3.6 3.6m-2.1-5.1a2.5 2.5 0 1 1 3.6 3.6L6.5 21H3v-3.5L16.7 3.7Z" /></svg>;
}
