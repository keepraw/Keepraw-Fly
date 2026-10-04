import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { App } from "./App";
import { loadAirportDirectory } from "./data/airport-directory";
import "./i18n";
import "./design-system.css";
import "./styles/base.css";
import "./styles/shell.css";
// Shared defaults must precede feature layout and visibility overrides.
import "./styles/controls.css";
import "./styles/welcome.css";
import "./styles/import.css";
import "./styles/settings.css";
// These shared motion states originally followed Settings' equal-specificity states.
import "./styles/motion.css";
import "./styles/recovery.css";
import "./styles/flight-editor.css";
import "./styles/route-map.css";
import "./styles/flight-detail.css";
// Shared flight time/deviation rules here must retain their precedence over Detail.
import "./styles/passport.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Keepraw Fly root element was not found.");
}

function Bootstrap() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let active = true;
    void loadAirportDirectory()
      .then(() => { if (active) setStatus("ready"); })
      .catch(() => { if (active) setStatus("failed"); });
    return () => { active = false; };
  }, []);

  if (status === "ready") return <App />;

  return (
    <main className="bootstrap-screen" aria-live="polite">
      <span className="wordmark-mark" aria-hidden="true">K</span>
      <strong>Keepraw Fly</strong>
      {status === "loading" ? (
        <p>{t("app.loadingAirportDirectory")}</p>
      ) : (
        <>
          <p>{t("app.airportDirectoryUnavailable")}</p>
          <button type="button" className="button-primary" onClick={() => {
            setStatus("loading");
            void loadAirportDirectory()
              .then(() => setStatus("ready"))
              .catch(() => setStatus("failed"));
          }}>{t("actions.retry")}</button>
        </>
      )}
    </main>
  );
}

createRoot(root).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);
