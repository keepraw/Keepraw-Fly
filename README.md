# Keepraw Fly

**Open-source, local-first flight logbook and Flight Passport.**

[Developer Demo](https://fly.keepraw.com) · [简体中文](README.zh-CN.md)

> The data outlives the app.

## Developer Demo

**[https://fly.keepraw.com](https://fly.keepraw.com) is a demo provided by the developer** to try Keepraw Fly in your browser. Choose **Try demo** to explore fictional sample flights, or create your own archive. Flight records stay in the current browser; the Demo does not provide an account or cloud synchronization.

You can also [run locally](#run-locally) or [deploy your own instance](docs/deployment.md). Export a JSON backup before moving between the Demo and another instance: each origin has separate browser storage.

## Highlights

- **Flight Passport:** explore lifetime or yearly totals, delay, airports, airlines, aircraft and route highlights.
- **Flight archive and detail:** search, filter, add, edit, duplicate and review complete flight records.
- **Route visualization:** browse recorded routes on the desktop Passport and Flight Detail maps.
- **Portable data:** export and migrate a validated Keepraw Fly JSON archive; preview JSON, Keepraw Fly CSV and Flighty CSV imports before writing.
- **Frequent flyer profiles:** associate programs with multiple airlines and recorded flights.
- **Local first:** flight history stays in browser storage; no account and no cloud flight-history backend.
- **Designed across devices:** responsive desktop and mobile experiences in English, Simplified Chinese and Traditional Chinese.

## Data and privacy

Flight records are stored locally in the current origin's IndexedDB. Keepraw Fly has no account system or cloud backend that stores your flight history. The default static build does not upload flight records or include analytics SDKs.

Persistent storage is an optional browser capability. When supported and granted, it reduces the risk of automatic eviction under storage pressure. It cannot prevent manually clearing site data or guarantee permanent retention, and does not replace JSON backups. Installing Keepraw Fly as an app is neither required to request it nor a guarantee that it is granted.

JSON export is the primary backup and migration method. Export a Keepraw Fly JSON archive regularly, especially before changing browsers, devices, or clearing site data.

Airport, airline and map assets are bundled reference data, not a live flight-status service. See the [third-party notices](THIRD_PARTY_NOTICES.md).

## Import and backup

Open **Settings → Data and backup** to preview an import before it changes your archive.

- **Keepraw Fly JSON:** import or export the complete portable archive for backup and migration.
- **Keepraw Fly CSV bulk import:** map and validate documented columns before adding rows.
- **Flighty CSV:** import supported fields from a Flighty export; this is a one-way import, not synchronization or complete Flighty-format compatibility.

Imports into an existing archive append flights and preserve its profile and existing records. Exact duplicates are skipped, possible duplicates can be reviewed, and both CSV flows validate every row before writing. When importing JSON without an existing archive, the source profile and document metadata are retained. See the [format and CSV columns](docs/schema.md) and [example files](examples/).

Local airport timestamps use the bundled IANA timezone data; RFC 3339 timestamps with an offset or `Z` are also supported.

## Run locally

Requirements: Node.js 20.19 or newer and pnpm 10.14.0. CI uses Node.js 24.

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

## Development

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

`pnpm format` formats maintained source and documentation; `pnpm format:check` checks formatting without writing. Generated modules, generated locales, reference datasets and vendor assets are excluded. `pnpm lint:css` checks the design system and feature styles. `pnpm check:css-tokens` rejects nonexistent custom-property names using CSS definitions and actual inline-style/CSSProperties assignments; it does not prove DOM scope or inheritance.

Install Chromium first with `pnpm exec playwright install chromium` when needed. Chromium runs the full E2E regression suite; Firefox and WebKit run only tagged compatibility smoke tests with `pnpm test:e2e --project=firefox --project=webkit` (install those browsers first). See [test layers and tagging policy](docs/testing.md). `pnpm check:docs` checks capability descriptions, Demo wording and local documentation links. GitHub Actions runs the repository checks for pull requests and `main`, then deploys successful `main` builds to GitHub Pages. See [deployment](docs/deployment.md) for setup.

Dependabot checks pnpm workspace dependencies and GitHub Actions weekly. Minor and patch version updates are grouped by ecosystem; major updates get individual pull requests. Existing CI validates update PRs, and maintainers review and decide whether to squash merge them; dependency updates are never automatically merged. Keep `pnpm-lock.yaml` committed and install with `pnpm install --frozen-lockfile`.

## Data format

Keepraw Fly uses the portable `keepraw-fly` JSON format with schema and semantic validation. Namespaced extensions travel with their owning records; appending to an existing archive keeps that archive's document-level metadata. See the [schema notes](docs/schema.md), [JSON Schema](packages/schema/keepraw-fly.schema.json) and [architecture notes](docs/architecture.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Visual system](docs/design-system.md)
- [Deployment](docs/deployment.md)
- [Schema](docs/schema.md)
- [Current product boundaries](docs/not-implemented.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

Source code is available under the [MIT License](LICENSE). The license does not grant rights to project names, logos or identifying marks; see [TRADEMARK.md](TRADEMARK.md).
