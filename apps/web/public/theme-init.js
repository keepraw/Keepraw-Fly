// Applies the saved skin and light/dark choice before the first paint. Kept
// as a same-origin file (not inline) so the Content Security Policy needs no
// 'unsafe-inline' or per-build script hash. The skin table mirrors
// src/skins/registry.ts; a test keeps the two in step.
const SKIN_APPEARANCES = {
  minimal: ["light", "dark"],
  aviation: ["dark"],
};
try {
  const root = document.documentElement;
  const skin = localStorage.getItem("keepraw-fly-skin");
  const appearances = SKIN_APPEARANCES[skin] ?? SKIN_APPEARANCES.aviation;
  if (Object.hasOwn(SKIN_APPEARANCES, skin)) root.dataset.skin = skin;
  const appearance = localStorage.getItem("keepraw-fly-appearance");
  if (appearances.length === 1) root.dataset.theme = appearances[0];
  else if (appearance === "light" || appearance === "dark")
    root.dataset.theme = appearance;
  else delete root.dataset.theme;
} catch {
  // The document already names the default skin and its appearance.
}
