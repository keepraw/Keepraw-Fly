// Single source of truth for Keepraw Fly's Content Security Policy.
//
// The static build embeds `documentPolicy` as a <meta http-equiv> tag, which
// is the only CSP mechanism GitHub Pages supports. Caddy additionally sends
// `headerPolicy` as a real response header. Directives that browsers ignore in
// a <meta> policy (frame-ancestors, report-uri/report-to, sandbox) are
// therefore only enforced by header-capable hosts such as the Docker image.

/** jsDelivr serves only the pinned MiSans stylesheets and WOFF2 subsets. */
export const fontCdnOrigin = "https://cdn.jsdelivr.net";

/** @type {ReadonlyArray<readonly [string, string[]]>} */
export const documentDirectives = [
  ["default-src", ["'none'"]],
  // Module chunks, the theme bootstrap and lazy chunks are all same-origin.
  // No 'unsafe-inline' or 'unsafe-eval': schema validation is precompiled.
  ["script-src", ["'self'"]],
  // MiSans CSS is pinned and SRI-checked (src/typography/load-webfonts.ts).
  // React style props use the CSSOM, which style-src does not restrict.
  ["style-src", ["'self'", fontCdnOrigin]],
  ["font-src", ["'self'", fontCdnOrigin]],
  // data: carries the canvas-projected map relief (MapRelief toDataURL).
  ["img-src", ["'self'", "data:"]],
  // Same-origin JSON reference data and locale resources only; this blocks
  // fetch/XHR/WebSocket/beacon exfiltration of archive data to other hosts.
  ["connect-src", ["'self'"]],
  ["manifest-src", ["'self'"]],
  ["worker-src", ["'none'"]],
  ["frame-src", ["'none'"]],
  ["media-src", ["'none'"]],
  ["object-src", ["'none'"]],
  ["base-uri", ["'none'"]],
  ["form-action", ["'none'"]],
];

/** Header-only directives: ignored by browsers when delivered via <meta>. */
/** @type {ReadonlyArray<readonly [string, string[]]>} */
export const headerOnlyDirectives = [["frame-ancestors", ["'none'"]]];

/** @param {ReadonlyArray<readonly [string, string[]]>} directives */
function serialize(directives) {
  return directives
    .map(([name, sources]) => [name, ...sources].join(" "))
    .join("; ");
}

export const documentPolicy = serialize(documentDirectives);
export const headerPolicy = serialize([
  ...documentDirectives,
  ...headerOnlyDirectives,
]);
