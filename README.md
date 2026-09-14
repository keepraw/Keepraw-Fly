# Keepraw Fly

[English](README.md) | [简体中文](README.zh-CN.md)

**An open flight-history data format and a local-first web viewer and editor.**

Keepraw Fly keeps portable flight facts in a readable JSON document and derives
search results, delays, distances and passport statistics in the viewer.

> The data outlives the app.

> Keepraw Fly stores facts. The viewer derives meaning.

## What works in 0.1

- Keepraw Fly 0.1 JSON Schema and Ajv validator with useful error paths
- a 24-flight fictional demo archive spanning multiple countries and timezones
- first-run archive creation with no JSON file required and a clearly labelled demo mode
- a guided form for scheduled and actual local times, airport facts, aircraft and seat details
- faster repeat entry with recent-airport suggestions and a duplicate-as-new action that never reuses the original record ID
- an offline directory of 7,800+ IATA airports with searchable codes, cities, names, coordinates and timezones, shipped as a separately cached static asset
- multi-airport city aliases that surface every candidate while always saving a specific airport IATA code
- premium, searchable trip cards with airport cities, local times and operational status
- responsive flight detail with a high-contrast route panel, local-time hierarchy and layered fact cards
- lifetime and yearly Flight Passport statistics
- a bundled Natural Earth world map with real airport coordinates, a cartographic projection and great-circle routes
- local IndexedDB persistence through a storage adapter
- validated JSON import preview, explicit replacement confirmation and portable export
- CSV bulk import with automatic/manual column mapping, five-row preview, strict timezone validation and append-only confirmation
- explicit migration of former `rawfly` / `0.1` archives to canonical Keepraw Fly 0.1.0 without changing flight facts
- independent language, appearance, distance-unit and time-format preferences
- native and romanized profile names with a selectable primary name
- shared premium visual tokens plus reusable airport-code, flight-status and aviation-icon primitives
- restrained CSS-only page, card and route transitions with complete reduced-motion fallback
- system/light/dark themes plus automated WCAG checks and a focus-trapped, Escape-dismissable flight editor
- static production output with no backend and no user-data upload

## Run locally

Requirements: Node.js 20.19 or newer and pnpm.

Install the dependencies once from the repository root:

```bash
pnpm install
```

For development, start Vite with live reload:

```bash
pnpm dev
```

Open the URL printed in the terminal, normally <http://localhost:5173>.

### Open the production build locally

`pnpm build` only creates the static files; it does not start a website. Build
and serve those files with:

```bash
pnpm build
pnpm preview
```

Then open <http://127.0.0.1:4173>. If that port is already in use, open the
alternative URL printed by Vite. Press `Ctrl+C` in the terminal to stop the
preview server.

Do not double-click `apps/web/dist/index.html`. Keepraw Fly uses browser modules
and IndexedDB, so the production files should be opened through the local HTTP
server above.

Run all checks with:

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

The same frozen install, type check, unit suite, Chromium user journeys and production build run on
every pull request and every push to `main` through GitHub Actions.

The static site is written to `apps/web/dist/`; that is also the directory to
publish on a static hosting service.

For GitHub Pages, push the repository, choose **GitHub Actions** under
**Settings → Pages**, and let the included deployment workflow publish every
successful `main` build. See [deployment guidance](docs/deployment.md).

## Repository layout

```text
apps/
  web/                 React, Vite, IndexedDB and user interaction
packages/
  schema/              Keepraw Fly types and JSON Schema
  validator/           Ajv validation and friendly issues
  core/                Search, calculations, statistics and reference data
examples/              Small portable example documents
docs/                  Architecture, schema and deployment notes
```

The UI never talks to Dexie directly. It uses `StorageAdapter`, whose first
implementation is `BrowserStorageAdapter`. Viewer preferences are stored
separately from the portable document.

## Data and privacy

The default build is entirely static. Flight data remains in the browser's
IndexedDB unless the user explicitly exports a file. Keepraw Fly has no server,
account system, analytics SDK or flight-status API.

Airport reference data is generated from the MIT-licensed
[airportsdata](https://github.com/mborsetti/airportsdata) project and bundled
with the static viewer as a separate local asset. It is reference data only—not a live schedule or flight
status service. See [third-party notices](THIRD_PARTY_NOTICES.md) and run
`pnpm update:airports` when intentionally refreshing the pinned snapshot.

The Passport basemap is generated from pinned, public-domain Natural Earth
vector data with the ISC-licensed `d3-geo` projection library. The optimized
SVG paths are bundled locally and loaded on demand with the Passport; no map
tiles or location requests are made at runtime. See
[third-party notices](THIRD_PARTY_NOTICES.md) and run
`pnpm update:world-map` only when intentionally refreshing the pinned source.

Import validates the file and previews its owner, flight count and date range
before anything changes. Replacing an existing archive requires an explicit
confirmation, with a backup export offered in the same flow.

CSV import is available under Settings → Data. It maps six required columns
(flight number, service date, origin IATA, destination IATA, scheduled departure
and scheduled arrival), previews up to five rows and appends only after
confirmation. Scheduled timestamps must contain an explicit timezone offset.
See [`examples/flights.csv`](examples/flights.csv).

Read [the architecture](docs/architecture.md), [the schema notes](docs/schema.md),
[the visual system](docs/design-system.md) and
[deployment guidance](docs/deployment.md) for details.

## Status and scope

This repository implements the first-stage local viewer. The explicitly deferred
features are listed in [docs/not-implemented.md](docs/not-implemented.md).

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for the completed-work
checklist, verification results and milestone commit history.

## License

Source code is available under the [MIT License](LICENSE). The license does not
grant rights to project names or identifying marks; see [TRADEMARK.md](TRADEMARK.md).
