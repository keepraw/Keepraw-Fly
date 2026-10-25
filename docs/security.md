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
| `img-src`                                            | `'self' data: blob:`              | `data:` map relief; `blob:` local Flight Passport previews. |
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
WebKit can report engine-internal inline styles while creating native `<select>`
controls, including elements never attached to the document. The CSP detector
pairs only calibrated report-only samples with matching enforced violations and
observed select instances. Extra events, reused samples, unknown declarations and
real application styles remain failures. Attached, removed, never-attached and
cloned-element regressions exercise that boundary in
[`e2e-csp/content-security-policy.pw.ts`](../e2e-csp/content-security-policy.pw.ts). Production enforcement is unchanged;
the report-only sampling policy is test-local.

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
release job first requires the CI run's commit, its own `github.sha` (the
source digest GitHub signs) and the tag's commit to be one commit, and stops
before any push, signature or upload otherwise. The
installer verifies every downloaded file and, with its own bundle, the OCI image
digest it will pull (`gh attestation verify oci://…@sha256:…`); Fork Pages
verifies the static archive. Both need GitHub CLI ≥ 2.102.0, no token, and refuse
a missing or corrupt bundle, another repository or workflow, another source
commit, a self-hosted runner or a modified file or digest. The installer's
refusal paths are tested with a stand-in `gh`; real Sigstore verification of
Keepraw Fly's own bundles happens on the first attested release. **v0.1.0 predates this and is checksum-only**; it is never reported as
attested. See the [deployment guide](deployment.md#verifying-release-provenance).

## Personal data in exports

Full JSON backups contain passenger names, booking references (PNR), ticket
numbers and frequent flyer numbers; Settings says so next to the export. **Export
without personal details** writes a valid, importable archive without those
fields and without any extension Keepraw Fly does not define (their meaning
cannot be judged). Inside the three extensions it keeps (`keepraw-fly.aircraft`,
`keepraw-fly.seat`, `keepraw-fly.baggage`) only declared fields survive (`type`,
`registration`; `seat`, `cabin`, `bookingClass`; `carousel`), each as a short
single-line string; unknown keys, nested objects and arrays are dropped, because
the schema allows any JSON there. It removes common direct identifiers only:
exact dates, flight numbers, routes and seats remain, so the file is **not
anonymous**. It is for sharing statistics, not a backup, and never changes the
stored archive. Encrypted backups are not implemented; if added they should
use WebCrypto (for example PBKDF2/Argon2 + AES-GCM) as a separate, reviewed task.

## Import limits

JSON, CSV, Flighty CSV and Umetrip XLS files are size-checked before they are read: empty
files and files above 64 MB are refused, as are imports with more than 100,000
flights or rows. A typical archive is a few MB. The size cap also bounds every
field and extension object. Stored archives are never subject to these limits.

Umetrip also checks the binary CFB signature, rejects renamed CSV/HTML/XLSX and
rejects formulas or Excel error cells in mapped fields. SheetJS does not execute
formulas or macros; arbitrary passenger columns are not copied. The XLS decoder
is loaded only on file selection, remains on the browser main thread, and does
not change CSP or introduce a network upload. Decoding itself is synchronous;
the subsequent row preflight uses the existing cancellable cooperative workflow.

The official SheetJS CE 0.20.3 tarball is pinned by URL and SHA-512 in the lockfile,
rather than the obsolete npm `xlsx` 0.18.5 release. The 2026-10-25 review checked
GitHub's published `xlsx` advisories: the prototype-pollution range is below
0.19.3 and the ReDoS range below 0.20.2; neither includes the selected version.
Fresh full and production pnpm audits reported no known vulnerabilities. An audit
is time-specific, not a guarantee about malformed workbooks or future advisories.
The [Apache-2.0 license and bundled notices](../apps/web/public/licenses/sheetjs.txt)
are shipped with the static site. Monitor upstream directly: npm and Dependabot
do not supply updates to this URL-pinned distribution automatically.

## Offline behavior

There is no Service Worker. After a first visit the browser HTTP cache may
serve hashed assets offline, but offline start-up is **not guaranteed**. A
Service Worker was deliberately not added: it would need update and cache
invalidation handling across GitHub Pages subpaths and could keep serving an
old build, while archives already persist in IndexedDB without one. Caddy marks
hashed `assets/*` as `immutable` and everything else `no-cache`, so upgrades
are picked up on the next load.

## Known dependency advisory

The v0.2.0 release review on 2026-10-25 found four newly disclosed `fast-uri`
advisories in Ajv's locked 3.1.8 dependency: GHSA-w74x-v6f9-j3xg,
GHSA-xhq7-xmqj-769h, GHSA-wjr9-j795-jxcr and GHSA-333x-w4r6-6crp. The release
updates only that transitive dependency to patched **3.1.9**, within Ajv's
existing range, without overrides, exclusions or schema changes. Both
`pnpm audit --json` and `pnpm audit --prod --json` then report no vulnerabilities.

The earlier `braces` advisory
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) was
withdrawn upstream on 2026-10-23; it is not suppressed locally. Its earlier
development-lint exposure assessment remains in the
[dated dependency review](archive/dependency-security-2026-10-16.md).

The dated review's Vitest 3 / tinypool follow-up was superseded by subsequent
runner upgrades, including [PR #87](https://github.com/keepraw/Keepraw-Fly/pull/87).
The lockfile is the current dependency source; run `pnpm audit --json` and
`pnpm audit --prod --json` for current advisory data. Do not interpret historical
audit counts as a fresh security assessment or suppress new findings.
