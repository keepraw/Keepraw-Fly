// Applies a saved light/dark choice before the first paint. Kept as a
// same-origin file (not inline) so the Content Security Policy needs no
// 'unsafe-inline' or per-build script hash.
try {
  const appearance = localStorage.getItem("keepraw-fly-appearance");
  if (appearance === "light" || appearance === "dark")
    document.documentElement.dataset.theme = appearance;
} catch {
  // System appearance also works when the cosmetic cache is unavailable.
}
