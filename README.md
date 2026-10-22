# Keepraw Fly

**Open-source, local-first flight logbook and Flight Passport.**

[Developer Demo](https://fly.keepraw.com) · [简体中文](README.zh-CN.md)

> The data outlives the app.

## Use online

**[https://fly.keepraw.com](https://fly.keepraw.com) is a demo provided by the developer** to try Keepraw Fly in your browser. Choose **Try demo** to explore fictional sample flights, or create your own archive. Flight records stay in the current browser; the Demo does not provide an account or cloud synchronization.

End users need no Node.js, pnpm or source compilation. Export a JSON backup before moving between the Demo and another instance: each origin has separate browser storage.

## GitHub Pages self-hosting (no build)

Fork this repository → enable Actions → Settings → Pages: GitHub Actions → manually run **Deploy official release to Fork Pages**, choosing **v0.1.1**. It downloads and verifies the official prebuilt archive without dependency installation, compilation or full E2E. Project subpaths and custom domains are supported. You choose each upgrade explicitly.

**This mode does not run source changes made in your fork.** Follow the [Pages guide](docs/deployment.md#github-pages-no-build-required).

## VPS self-hosting (Docker)

Install Docker and Compose v2 → download, verify and inspect the fixed-release installer → configure your domain → access over HTTPS. A single Caddy container serves static files; no JavaScript toolchain is needed. Supports amd64/arm64, digest-pinned images, repeat installation, upgrades and rollback.

Get the installer or directly deployable ZIP/tar.gz from the [v0.1.1 release](https://github.com/keepraw/Keepraw-Fly/releases/tag/v0.1.1), then follow the [VPS instructions](docs/deployment.md#vps-docker-and-automatic-https). The official publisher and image author is **keepraw**.

## Highlights

- **Flight Passport:** explore lifetime or yearly totals, delay, airports, airlines, aircraft and route highlights. Save a two-page digital travel journal with a local nickname and stable souvenir number.
- **Flight archive and detail:** search, filter, add, edit, duplicate and review complete flight records.
- **Route visualization:** browse recorded routes on the desktop Passport and Flight Detail maps.
- **Portable data:** export and migrate a validated Keepraw Fly JSON archive; preview JSON, Keepraw Fly CSV and Flighty CSV imports before writing.
- **Frequent flyer profiles:** associate programs with multiple airlines and recorded flights.
- **Local first:** flight history stays in browser storage; no account and no cloud flight-history backend.
- **Designed across devices:** responsive desktop and mobile experiences in Simplified Chinese, Traditional Chinese (Taiwan), US/UK English, Japanese, French, German, Spanish, Brazilian Portuguese and Korean.

## Data and privacy

Flight records are stored locally in the current origin's IndexedDB. Keepraw Fly has no account system or cloud backend that stores your flight history. The default static build does not upload flight records or include analytics SDKs. The [souvenir passport](docs/flight-passport-journal.md) stores its nickname and virtual number separately in localStorage; they stay in this browser and are included in the saved image.

Persistent storage is an optional browser capability. When supported and granted, it reduces the risk of automatic eviction under storage pressure. It cannot prevent manually clearing site data or guarantee permanent retention, and does not replace JSON backups. Installing Keepraw Fly as an app is neither required to request it nor a guarantee that it is granted.

Different domains, browsers and devices have separate data; project paths on one origin are not storage isolation boundaries. Deploying a new version does not intentionally clear archives. Docker upgrades do not back up or migrate personal data. The VPS only hosts website files and stores no flight archives.

JSON export is the primary backup and migration method. Export a Keepraw Fly JSON archive regularly, especially before changing browsers, devices, or clearing site data.

Airport, airline and map assets are bundled reference data, not a live flight-status service. See the [third-party notices](THIRD_PARTY_NOTICES.md).

Chinese UI fonts use MiSans / MiSans TC from the fixed `misans-webfont@4.3.1`
jsDelivr distribution. Only Chinese locales request its CSS and needed WOFF2
subsets; Latin locales retain the Inter/system stack, while Japanese and Korean
use system font fallbacks without additional downloads. This third-party font
service receives normal resource-request metadata, but no flight records or
archive contents. A failed font request falls back to system fonts.

## Import and backup

Open **Settings → Data and backup** to preview an import before it changes your archive.

- **Keepraw Fly JSON:** import or export the complete portable archive for backup and migration.
- **Keepraw Fly CSV bulk import:** map and validate documented columns before adding rows.
- **Flighty CSV:** import supported fields from a Flighty export; this is a one-way import, not synchronization or complete Flighty-format compatibility.

Imports into an existing archive append flights and preserve its profile and existing records. Exact duplicates are skipped, possible duplicates can be reviewed, and both CSV flows validate every row before writing. When importing JSON without an existing archive, the source profile and document metadata are retained. See the [format and CSV columns](docs/schema.md) and [example files](examples/).

Local airport timestamps use the bundled IANA timezone data; RFC 3339 timestamps with an offset or `Z` are also supported.

## Developers: run locally

Requirements: Node.js 24 LTS (`^24.0.0`) and pnpm 10.14.0, matching CI. Run `nvm use` to select the version in `.nvmrc`; installation rejects unsupported Node.js versions.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:5173>. The development server uses this fixed port and exits if it is occupied.

To inspect the production build over HTTP:

```bash
pnpm build
pnpm preview
```

Open <http://127.0.0.1:4173> (the default preview address). Serve the build over HTTP; opening `apps/web/dist/index.html` directly is not supported.

## Developers: validation

```bash
pnpm format
pnpm format:check
pnpm lint:css
pnpm check:css-tokens
pnpm check:docs
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e --project=chromium
```

`pnpm format` formats maintained source and documentation; `pnpm format:check` checks formatting without writing. Generated modules, reference datasets and vendor assets are excluded. `pnpm lint:css` checks the design system and feature styles. `pnpm check:css-tokens` rejects nonexistent custom-property names using CSS definitions and actual inline-style/CSSProperties assignments; it does not prove DOM scope or inheritance.

Install Chromium first with `pnpm exec playwright install chromium` when needed. Chromium runs the full E2E regression suite; Firefox and WebKit run only tagged compatibility smoke tests with `pnpm test:e2e --project=firefox --project=webkit` (install those browsers first). See [test layers and tagging policy](docs/testing.md). `pnpm check:docs` checks capability descriptions, Demo wording and local documentation links. Official GitHub Actions runs the complete repository checks for pull requests and `main`, then deploys successful `main` builds to GitHub Pages. Forks skip these official jobs and use the independent prebuilt deployment workflow. See [deployment](docs/deployment.md) for setup.

Dependabot checks pnpm workspace dependencies and GitHub Actions weekly. Minor and patch version updates are grouped by ecosystem; major updates get individual pull requests. Existing CI validates update PRs, and maintainers review and decide whether to squash merge them; dependency updates are never automatically merged. Keep `pnpm-lock.yaml` committed and install with `pnpm install --frozen-lockfile`.

## Data format

Keepraw Fly uses the portable `keepraw-fly` JSON format with schema and semantic validation. Namespaced extensions travel with their owning records; appending to an existing archive keeps that archive's document-level metadata. See the [schema notes](docs/schema.md), [JSON Schema](packages/schema/keepraw-fly.schema.json) and [architecture notes](docs/architecture.md).

## Documentation

Start with the [documentation index](docs/README.md) for maintained guidance.
Selected design decisions and source provenance are kept in the
[historical archive](docs/archive/README.md).

- [Architecture](docs/architecture.md)
- [Visual system](docs/design-system.md)
- [Deployment](docs/deployment.md)
- [Schema](docs/schema.md)
- [Current product boundaries](docs/not-implemented.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

Source code is available under the [MIT License](LICENSE). The license does not grant rights to project names, logos or identifying marks; see [TRADEMARK.md](TRADEMARK.md).
