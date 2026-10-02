# Keepraw Fly

**Open-source, local-first flight logbook and Flight Passport.**

[Open Keepraw Fly](https://fly.keepraw.com) · [简体中文](README.zh-CN.md)

> The data outlives the app.

![Keepraw Fly Flight Passport](docs/screenshots/passport-desktop.png)

## Highlights

- **Flight Passport:** explore lifetime or yearly totals, delay, airports, airlines, aircraft and route highlights.
- **Flight archive and detail:** search, filter, add, edit, duplicate and review complete flight records.
- **Route visualization:** browse recorded routes on the desktop Passport and Flight Detail maps.
- **Portable data:** export and migrate a validated Keepraw Fly JSON archive; preview JSON, Keepraw Fly CSV and Flighty CSV imports before writing.
- **Frequent flyer profiles:** associate programs with multiple airlines and recorded flights.
- **Local first:** flight history stays in browser storage; no account and no cloud flight-history backend.
- **Designed across devices:** responsive desktop and mobile experiences in English, Simplified Chinese and Traditional Chinese.

## Screenshots

| Flight Passport | Flight Detail |
| --- | --- |
| ![Flight Passport on desktop](docs/screenshots/passport-desktop.png) | ![Flight Detail on desktop](docs/screenshots/flight-detail-desktop.png) |

<p align="center">
  <img src="docs/screenshots/passport-mobile.png" width="300" alt="Flight Passport on mobile">
  &nbsp;&nbsp;
  <img src="docs/screenshots/flight-detail-mobile.png" width="300" alt="Flight Detail on mobile">
</p>

| Settings on desktop | Settings on mobile |
| --- | --- |
| ![Settings on desktop](docs/screenshots/settings-desktop.png) | <img src="docs/screenshots/settings-mobile.png" width="300" alt="Settings on mobile"> |

## Data and privacy

### Local data and backups

Flight records are stored locally in the browser using IndexedDB. Keepraw Fly has no account system or cloud backend that stores your flight history. The default static build does not upload flight records or include analytics SDKs.

When supported and granted by the browser, Keepraw Fly can request persistent storage to reduce the chance of automatic storage eviction. This does not protect against manually clearing browser data and does not replace backups.

Export a Keepraw Fly JSON archive regularly, especially before changing browsers, devices, or clearing site data.

Browser storage and persistent-storage permissions are scoped to the current origin. For example, `https://fly.keepraw.com` and `http://localhost:5173` use separate browser storage and permissions.

Airport, airline and map assets are bundled reference data, not a live flight-status service. See the [third-party notices](THIRD_PARTY_NOTICES.md).

## Import and backup

Open **Settings → Data and backup** to preview an import before it changes your archive.

- **Keepraw Fly JSON:** import or export the complete portable archive for backup and migration.
- **Keepraw Fly CSV bulk import:** map and validate documented columns before adding rows.
- **Flighty CSV:** import supported fields from a Flighty export; this is a one-way import, not synchronization or complete Flighty-format compatibility.

New flights are added without overwriting existing records. Exact duplicates are skipped, possible duplicates can be reviewed, and both CSV flows validate every row before writing. Local airport timestamps use the bundled IANA timezone data; RFC 3339 timestamps with an offset or `Z` are also supported.

## Run locally

Requirements: Node.js 20.19 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:5173>. The development server uses this fixed port and exits if it is occupied.

To inspect the production build over HTTP:

```bash
pnpm build
pnpm preview
```

Do not open `apps/web/dist/index.html` directly; browser modules and IndexedDB require the build to be served.

## Development

```bash
pnpm check:docs
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Install Chromium first with `pnpm exec playwright install chromium` when needed. GitHub Actions runs the repository checks for pull requests and `main`.

## Data format

Keepraw Fly uses the portable `keepraw-fly` JSON format. The validator preserves supported canonical data and namespaced extensions through import, edit and export. See the [schema notes](docs/schema.md), [JSON Schema](packages/schema/keepraw-fly.schema.json) and [architecture notes](docs/architecture.md).

## Documentation

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Schema](docs/schema.md)
- [Deferred scope](docs/not-implemented.md)
- [Implementation status](IMPLEMENTATION_STATUS.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

Source code is available under the [MIT License](LICENSE). The license does not grant rights to project names, logos or identifying marks; see [TRADEMARK.md](TRADEMARK.md).
