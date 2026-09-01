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
- dense, searchable flight history with English and Simplified Chinese names
- responsive flight detail timeline and conditional flight facts
- lifetime and yearly Flight Passport statistics
- a bundled world map with real airport coordinates and great-circle routes
- local IndexedDB persistence through a storage adapter
- validated JSON import preview, explicit replacement confirmation and portable export
- independent language, appearance, distance-unit and time-format preferences
- native and romanized profile names with a selectable primary name
- shared visual tokens for color, type, spacing, controls, focus and reduced motion
- static production output with no backend and no user-data upload

## Start locally

Requirements: Node.js 20.19 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Then open the local URL printed by Vite. Run all checks with:

```bash
pnpm typecheck
pnpm test
pnpm build
```

The static site is written to `apps/web/dist/`.

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

Import validates the file and previews its owner, flight count and date range
before anything changes. Replacing an existing archive requires an explicit
confirmation, with a backup export offered in the same flow.

Read [the architecture](docs/architecture.md), [the schema notes](docs/schema.md)
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
