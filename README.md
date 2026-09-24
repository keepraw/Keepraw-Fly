# Keepraw Fly

[English](README.md) | [简体中文](README.zh-CN.md)

**An open-source, local-first flight log and Flight Passport for people who want to own their travel history.**

Keepraw Fly records your flights in a portable JSON archive, then turns those facts into a searchable flight list, flight details, maps and Passport statistics. It is designed for personal use: no account is required, and the default build has no backend for storing your flight data.

> The data outlives the app.

## What you can do

- Add, edit, duplicate and delete flight records.
- Keep scheduled and actual local times, cancellation and diversion facts, terminals and gates.
- Record ticket numbers, booking references, aircraft, registration, seat, cabin, booking class and frequent-flyer memberships.
- Search by flight, airport, city, airline, aircraft and year.
- Review flight details with local times, operational status, route maps and derived distance/duration.
- Explore a Flight Passport with lifetime and yearly totals for flights, distance, time, airports, airlines, countries and routes.
- Use English, Simplified Chinese or Traditional Chinese, with light, dark or system appearance and responsive desktop/mobile layouts.

## Import your existing flights

Open **Settings → Data** to review an import before it changes your archive.

- **Flighty CSV:** import a native Flighty export directly. Flighty airline codes and flight numbers are normalized locally, and supported Flighty fields are mapped into the canonical Keepraw Fly model.
- **Keepraw Fly CSV bulk import:** batch-import rows using the documented Keepraw Fly columns, with automatic or manual column mapping.
- **JSON archive:** import or export the portable Keepraw Fly archive for backups and moving data between browsers.

Both CSV workflows validate the complete file and show a preview before confirmation. CSV timestamps are entered as airport local time, without an offset; Keepraw Fly resolves them with the airport's IANA timezone, including daylight-saving transitions. Existing RFC 3339 timestamps with an offset or `Z` remain supported.

## Your data stays yours

- Flight archives are stored in the browser's IndexedDB by default.
- There is no account system, cloud sync or Keepraw Fly backend storing user flight data.
- The default build is static and does not upload flight records to a server or use analytics SDKs.
- Export a portable JSON archive regularly. Clearing browser data can remove the local archive.
- Viewer preferences are kept separately from the portable flight document.

Airport, airline and map reference assets are bundled with the application. They are reference data, not a live flight-status service. See [third-party notices](THIRD_PARTY_NOTICES.md) for source and license information.

## Quick start

### Use the application

There is no public hosted demo configured in this repository. Run the application locally or publish the static build using the [deployment guide](docs/deployment.md).

### Run locally

Requirements: Node.js 20.19 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open the URL printed by Vite, normally <http://localhost:5173>.

To inspect the production build locally:

```bash
pnpm build
pnpm preview
```

Open the URL printed by Vite, normally <http://127.0.0.1:4173>. Do not open `apps/web/dist/index.html` directly; the production build expects to be served over HTTP so browser modules and IndexedDB work correctly.

## Data format

Keepraw Fly archives use the portable `keepraw-fly` JSON format, currently at format version `0.1.0`. The validator preserves supported canonical data and namespaced extensions through normal import, edit and export flows.

See the [schema notes](docs/schema.md) and the canonical [JSON Schema](packages/schema/keepraw-fly.schema.json) for the data contract. The [architecture notes](docs/architecture.md) describe the storage and import boundaries.

## 0.1.0

Keepraw Fly 0.1.0 is the first release focused on a dependable local flight archive: guided editing, Flight Passport views, portable JSON, Keepraw Fly CSV and native Flighty CSV import, airport-local time handling, cancellation/diversion facts, and responsive multilingual viewing.

Backend accounts, synchronization, live flight services, booking integrations and native apps are intentionally outside this release. See [deferred scope](docs/not-implemented.md).

## Documentation

- [Schema](docs/schema.md)
- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Deferred scope](docs/not-implemented.md)
- [Implementation status](IMPLEMENTATION_STATUS.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

Source code is available under the [MIT License](LICENSE). The license does not grant rights to project names, logos or identifying marks; see [TRADEMARK.md](TRADEMARK.md).
