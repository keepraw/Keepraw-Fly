# Security model

Keepraw Fly is local-first: archives live in this browser's IndexedDB and are
never uploaded. The controls below protect that data inside the browser and the
code that is delivered to it.

## Content Security Policy

The single policy source is [`apps/web/security-policy.mjs`](../apps/web/security-policy.mjs).

| Directive                                            | Value                             | Why                                                         |
| ---------------------------------------------------- | --------------------------------- | ----------------------------------------------------------- |
| `default-src`                                        | `'none'`                          | Everything not listed is refused.                           |
| `script-src`                                         | `'self'`                          | No inline script, no `eval`; the theme bootstrap is a file. |
| `style-src`                                          | `'self' https://cdn.jsdelivr.net` | App CSS plus the SRI-pinned MiSans stylesheets.             |
| `font-src`                                           | `'self' https://cdn.jsdelivr.net` | MiSans WOFF2 subsets.                                       |
| `img-src`                                            | `'self' data:`                    | `data:` carries the canvas-projected map relief.            |
| `connect-src`                                        | `'self'`                          | Reference data and locales only; blocks fetch/beacon exfil. |
| `manifest-src`                                       | `'self'`                          | Web app manifest.                                           |
| `worker-src`, `frame-src`, `media-src`, `object-src` | `'none'`                          | Not used.                                                   |
| `base-uri`, `form-action`                            | `'none'`                          | No base rewriting, no form posts.                           |
| `frame-ancestors` (header only)                      | `'none'`                          | Clickjacking protection.                                    |

There is no `'unsafe-inline'` or `'unsafe-eval'`. Schema validation is
precompiled (`pnpm --filter @keepraw-fly/validator generate`) because runtime
Ajv compilation uses `Function()`. React `style` props use the CSSOM, which
`style-src` does not restrict, so no inline-style allowance is needed.

**Where it applies.** Production builds embed the policy as a `<meta>` tag
(GitHub Pages and Fork Pages cannot send response headers). Browsers ignore
`frame-ancestors`, `report-uri`/`report-to` and `sandbox` in `<meta>`, so a
static-host deployment can be framed and has no violation reporting. The Docker
image's Caddy sends the full policy as a header with `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`,
`Cross-Origin-Opener-Policy`/`Cross-Origin-Resource-Policy: same-origin`,
`nosniff`, and `Strict-Transport-Security` on HTTPS responses only (never on
the loopback HTTP mode). The dev server has no CSP (React Fast Refresh injects
an inline preamble).

**Future tightening.** `img-src data:` can go if the map relief moves to a
`blob:`-free canvas element; jsDelivr can leave `style-src`/`font-src` if the
fonts are ever self-hosted.

Checks: `pnpm check:security-headers` (static parity; runs real Caddy when the
binary is available), `pnpm test:e2e:csp` (Chromium, Firefox, WebKit against the
production build), and header/cache assertions in `scripts/test-deployment.sh`.
WebKit reports engine-internal `style-src-attr` violations (empty sample,
blocked `inline`) while restyling native `<select>` controls; the CSP journeys
exempt exactly that signature only when a `<select>` exists, and a calibration
test fails when WebKit stops reporting it.

## Webfont integrity

The six MiSans stylesheets (`misans-webfont@4.3.1`) load with SHA-384
Subresource Integrity, `crossorigin="anonymous"` and `no-referrer`. A modified
stylesheet is refused and the UI keeps its system-font stack. SRI covers the
CSS files only; the WOFF2 files they reference are not integrity-checked (they
are limited to the pinned package path by the CSS and to jsDelivr by
`font-src`). Recheck hashes with `pnpm check:webfont-sri` (add `--npm` to hash
the registry tarball).

## Release provenance

Releases after v0.1.0 carry GitHub Artifact Attestations (SLSA provenance via
Sigstore) for every attachment and for the image digest, signed by
`.github/workflows/release.yml` on `refs/heads/main` from the tagged commit. The
installer and Fork Pages verify them with GitHub CLI ≥ 2.102.0 before deploying
and refuse a missing bundle, another signer, another source commit or a modified
file. **v0.1.0 predates this and is checksum-only**; it is never reported as
attested. See the [deployment guide](deployment.md#verifying-release-provenance).

## Personal data in exports

Full JSON backups contain passenger names, booking references (PNR), ticket
numbers and frequent flyer numbers; Settings says so next to the export. **Export
without personal details** writes a valid, importable archive without those
fields and without any extension Keepraw Fly does not define (their meaning
cannot be judged). It is for sharing statistics, not a backup, and never changes
the stored archive. Encrypted backups are not implemented; if added they should
use WebCrypto (for example PBKDF2/Argon2 + AES-GCM) as a separate, reviewed task.

## Import limits

JSON, CSV and Flighty CSV files are size-checked before they are read: empty
files and files above 64 MB are refused, as are imports with more than 100,000
flights or rows. A typical archive is a few MB. The size cap also bounds every
field and extension object. Stored archives are never subject to these limits.

## Offline behavior

There is no Service Worker. After a first visit the browser HTTP cache may
serve hashed assets offline, but offline start-up is **not guaranteed**. A
Service Worker was deliberately not added: it would need update and cache
invalidation handling across GitHub Pages subpaths and could keep serving an
old build, while archives already persist in IndexedDB without one. Caddy marks
hashed `assets/*` as `immutable` and everything else `no-cache`, so upgrades
are picked up on the next load.

## Known dependency advisory

`pnpm audit` reports one high advisory, GHSA-vfj7-8cjw-p6xm (`braces` ≤ 3.0.3
via `stylelint → micromatch`). No patched `braces` release exists; it affects
only the development lint tool, which receives trusted glob constants, and
`pnpm audit --prod` reports no vulnerabilities. See the
[dependency review](reviews/2026-10-16-dependency-security.md).
