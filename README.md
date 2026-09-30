# Keepraw Fly

[English](README.md) | [简体中文](README.zh-CN.md)

**An open-source, local-first personal flight archive and Flight Passport.**

Keepraw Fly keeps your flight history in a portable JSON archive. The Flight Passport is the main mobile entry point for exploring that history, with flight records and details close at hand. No account is required, and the default build has no backend for storing your flights.

> The data outlives the app.

## Flight Passport

Passport brings together lifetime or selected-year totals for flights, distance, time in the air and recorded delay. It also counts countries, airports, airlines and aircraft types. On mobile, the summary, delay and network panels lead into the searchable flight history. On desktop, airport, airline and route highlights filter related records, and the Passport route map can select a flight in the archive.

## Flight archive and detail

- Search the flight history and filter it by year. Add, edit, duplicate or delete a flight.
- Keep scheduled and actual local times, cancellation and diversion facts, departure and arrival gates and terminals, and optional baggage carousel information.
- Review arrival delay or early arrival, flight duration and distance alongside aircraft, seat, cabin, ticket number, booking reference (PNR), registration and frequent-flyer information when recorded.
- On desktop, Flight Detail pairs the itinerary with a route map and archive fields. On mobile, it uses a compact itinerary and archive layout without the detail map.

## Import and backup

Open **Settings → Data and backup** to review an import before it changes your archive.

- **Flighty CSV:** import supported fields from a Flighty CSV export. Airline codes and flight numbers are normalized locally; this is a one-way import, not full Flighty format compatibility or synchronization.
- **Keepraw Fly CSV bulk import:** batch-import rows using the documented Keepraw Fly columns, with automatic or manual column mapping.
- **JSON archive:** import or export the portable Keepraw Fly archive for backups and moving data between browsers.

Imports are previewed before confirmation. New flights are added to the existing archive; exact duplicates are skipped, and possible duplicates can be reviewed before inclusion. Both CSV workflows validate the file before writing. CSV timestamps can use airport local time without an offset; Keepraw Fly resolves them with the airport's IANA timezone, including daylight-saving transitions. RFC 3339 timestamps with an offset or `Z` are also supported.

## Local data, languages and appearance

- Flight archives are stored in the browser's IndexedDB by default.
- There is no account system, cloud sync or Keepraw Fly backend storing user flight data.
- The default build is static and does not upload flight records to a server or use analytics SDKs.
- Your flight records stay in the current browser. Export a portable JSON archive regularly, and back up before switching browsers or clearing browser data.
- Enable **Local data protection** in Settings when your browser supports it to reduce automatic storage eviction. Storage protection does not replace backups or prevent data loss when browser data is cleared.
- Viewer preferences are kept separately from the portable flight document.
- The interface supports English, Simplified Chinese and Traditional Chinese, light, dark or system appearance, and responsive desktop and mobile layouts.

Airport, airline and map reference assets are bundled with the application. They are reference data, not a live flight-status service. See [third-party notices](THIRD_PARTY_NOTICES.md) for source and license information.

## Quick start

### Use the application

Try the [online demo](https://fly.keepraw.com). If you use it for your own flights, protect your data: records are saved only in the current browser, so export JSON backups regularly and before switching browsers or clearing browser data. Local data protection cannot replace a backup.

You can also run the application locally or publish the static build using the [deployment guide](docs/deployment.md).

### Run locally

Requirements: Node.js 20.19 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Open <http://localhost:5173>. The development server uses this fixed port and exits if it is already occupied. Stop the existing development server before starting another one. Browser data and storage protection permissions belong to an origin, so a different hostname or port uses separate data and permissions.

To inspect the production build locally:

```bash
pnpm build
pnpm preview
```

Open the URL printed by Vite, normally <http://127.0.0.1:4173>. Do not open `apps/web/dist/index.html` directly; the production build expects to be served over HTTP so browser modules and IndexedDB work correctly.

## Development and verification

The repository provides documentation checks, TypeScript checks, unit tests, a production build and Playwright end-to-end tests, including responsive flows. GitHub Actions runs these checks for pull requests and the main branch.

```bash
pnpm check:docs
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Install the Playwright browser with `pnpm exec playwright install chromium` before running the end-to-end suite locally.

## Data format

Keepraw Fly archives use the portable `keepraw-fly` JSON format, currently at format version `0.1.0`. The validator preserves supported canonical data and namespaced extensions through normal import, edit and export flows.

See the [schema notes](docs/schema.md) and the canonical [JSON Schema](packages/schema/keepraw-fly.schema.json) for the data contract. The [architecture notes](docs/architecture.md) describe the storage and import boundaries.

## Documentation

- [Schema](docs/schema.md)
- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Deferred scope](docs/not-implemented.md)
- [Implementation status](IMPLEMENTATION_STATUS.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## License

Source code is available under the [MIT License](LICENSE). The license does not grant rights to project names, logos or identifying marks; see [TRADEMARK.md](TRADEMARK.md).
