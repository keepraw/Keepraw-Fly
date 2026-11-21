import { useEffect, useState } from "react";
import "./neon-aviation.css";
import { contrastRatio } from "../map2d/theme-style";
import { mapThemeCssVariables } from "../map2d/theme-css";
import { resolveMapTheme } from "../map2d/theme-registry";
import { NeonPassportPoster } from "./NeonPassportPoster";
import { NeonRouteMap } from "./NeonRouteMap";
import { NeonWorldMap } from "./NeonWorldMap";

type Sample = "world" | "detail" | "passport" | "all";
type Density = "sparse" | "dense";
type State = "normal" | "hover" | "selected";
type Route = "tpe-lax" | "pvg-cdg";

const theme = resolveMapTheme("neon-aviation");

export function NeonLab() {
  const query = new URLSearchParams(window.location.search);
  const [sample, setSample] = useState<Sample>(
    valueOr<Sample>(
      query.get("sample"),
      ["world", "detail", "passport", "all"],
      "all",
    ),
  );
  const [density, setDensity] = useState<Density>(
    valueOr<Density>(query.get("density"), ["sparse", "dense"], "sparse"),
  );
  const [state, setState] = useState<State>(
    valueOr<State>(
      query.get("state"),
      ["normal", "hover", "selected"],
      "normal",
    ),
  );
  const [route, setRoute] = useState<Route>(
    valueOr<Route>(query.get("route"), ["tpe-lax", "pvg-cdg"], "tpe-lax"),
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const frame = requestAnimationFrame(() => {
      void document.fonts.ready.then(() => {
        if (active) setReady(true);
      });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [sample]);

  const showWorld = sample === "all" || sample === "world";
  const showDetail = sample === "all" || sample === "detail";
  const showPassport = sample === "all" || sample === "passport";

  return (
    <main
      className="neon-aviation"
      style={mapThemeCssVariables(theme)}
      data-neon-samples-ready={ready ? "true" : "false"}
    >
      <header className="neon-lab-header">
        <div>
          <p className="neon-eyebrow">KEEPRAW FLY · DESIGN STUDY 01</p>
          <h1>Neon Aviation</h1>
          <p className="neon-lab-intro">
            A local-only visual lab for shared 2D map tokens, routes, and the
            fictional flight passport.
          </p>
        </div>
        <div className="neon-lab-controls" aria-label="Prototype controls">
          <label>
            <span>Sample</span>
            <select
              aria-label="Sample"
              value={sample}
              onChange={(event) => {
                setReady(false);
                setSample(event.target.value as Sample);
              }}
            >
              <option value="all">All prototypes</option>
              <option value="world">World network</option>
              <option value="detail">Route detail</option>
              <option value="passport">Flight passport</option>
            </select>
          </label>
          <label>
            <span>Density</span>
            <select
              aria-label="Route density"
              value={density}
              onChange={(event) => setDensity(event.target.value as Density)}
            >
              <option value="sparse">Sparse</option>
              <option value="dense">Dense</option>
            </select>
          </label>
          <label>
            <span>State</span>
            <select
              aria-label="Route state"
              value={state}
              onChange={(event) => setState(event.target.value as State)}
            >
              <option value="normal">Normal</option>
              <option value="hover">Hover</option>
              <option value="selected">Selected</option>
            </select>
          </label>
          <label>
            <span>Detail route</span>
            <select
              aria-label="Detail route"
              value={route}
              onChange={(event) => setRoute(event.target.value as Route)}
            >
              <option value="tpe-lax">TPE → LAX</option>
              <option value="pvg-cdg">PVG → CDG</option>
            </select>
          </label>
        </div>
      </header>

      <div className="neon-sample-grid">
        {showWorld && (
          <section className="neon-sample-panel neon-sample-panel--world">
            <div className="neon-panel-heading">
              <div>
                <p className="neon-eyebrow">SAMPLE A · VECTOR</p>
                <h2>World route network</h2>
              </div>
              <span className="neon-panel-meta">
                {density === "dense" ? "140 links" : "8 links"} · offline
              </span>
            </div>
            <NeonWorldMap density={density} forcedState={state} />
          </section>
        )}

        {showDetail && (
          <section className="neon-sample-panel neon-sample-panel--detail">
            <div className="neon-panel-heading">
              <div>
                <p className="neon-eyebrow">SAMPLE B · REGIONAL CROP</p>
                <h2>Great-circle detail</h2>
              </div>
              <span className="neon-panel-meta">two route variants</span>
            </div>
            <NeonRouteMap initialRoute={route} />
          </section>
        )}

        {showPassport && (
          <section className="neon-sample-panel neon-sample-panel--passport">
            <div className="neon-panel-heading">
              <div>
                <p className="neon-eyebrow">SAMPLE C · CANVAS EXPORT</p>
                <h2>Flight passport</h2>
              </div>
              <span className="neon-panel-meta">fictional · SPECIMEN</span>
            </div>
            <NeonPassportPoster />
          </section>
        )}
      </div>

      <section className="neon-token-panel">
        <div className="neon-panel-heading">
          <div>
            <p className="neon-eyebrow">SOURCE OF TRUTH</p>
            <h2>Color tokens</h2>
          </div>
          <span className="neon-panel-meta">
            WCAG text contrast against bottom background
          </span>
        </div>
        <div className="neon-token-grid">
          {Object.entries(theme.tokens.color).map(([name, color]) => (
            <div className="neon-token-swatch" data-color={name} key={name}>
              <span className="neon-token-color" aria-hidden="true" />
              <span className="neon-token-name">{name}</span>
              <code>{color.join(", ")}</code>
              <small>
                {contrastRatio(
                  color,
                  theme.tokens.color.backgroundBottom,
                  theme.tokens.color.backgroundBottom,
                ).toFixed(2)}
                :1
              </small>
            </div>
          ))}
        </div>
      </section>
      <footer className="neon-lab-footer">
        Development preview only · no archive data · no external map services
      </footer>
    </main>
  );
}

function valueOr<T extends string>(
  value: string | null,
  choices: readonly T[],
  fallback: T,
): T {
  return choices.find((choice) => choice === value) ?? fallback;
}
