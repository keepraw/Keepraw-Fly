import { useTranslation } from "react-i18next";

export type Page = "flights" | "passport" | "settings";

interface AppHeaderProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

export function AppHeader({ currentPage, onNavigate }: AppHeaderProps) {
  const { t } = useTranslation();
  const links: Array<{ page: Page; label: string }> = [
    { page: "flights", label: t("nav.flights") },
    { page: "passport", label: t("nav.passport") },
    { page: "settings", label: t("nav.settings") },
  ];

  return (
    <header className="site-header">
      <div className="site-header-inner">
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
      </div>
    </header>
  );
}
