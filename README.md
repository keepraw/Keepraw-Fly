# Keepraw Fly

**Open-source, local-first flight logbook and Flight Passport.**

[Developer Demo](https://fly.keepraw.com) · [简体中文](README.zh-CN.md)

> The data outlives the app.

## Use online

**[https://fly.keepraw.com](https://fly.keepraw.com) is a demo provided by the developer** to try Keepraw Fly in your browser. Choose **Try demo** to explore fictional sample flights, or create your own archive. Flight records stay in the current browser; the Demo does not provide an account or cloud synchronization.

To get started, choose **Create my archive**, then **Add flight**, or import an existing Keepraw Fly JSON file from the welcome screen. Use **Settings → Data and backup** for subsequent imports and exports. No Node.js, pnpm or source compilation is needed.

**Export a JSON backup regularly and before moving between instances, browsers or devices.** The Demo and self-hosted sites do not synchronize data.

## Highlights

- **Flight Passport:** explore lifetime or yearly totals, delay, airports, airlines, aircraft and route highlights. Save a two-page souvenir travel journal using your archive name and a browser-local display number.
- **Flight archive and detail:** search, filter, add, edit, duplicate and review complete flight records.
- **Route visualization:** browse recorded routes on the desktop Passport and Flight Detail maps.
- **Portable data:** export and migrate a validated Keepraw Fly JSON archive; preview JSON, Keepraw Fly CSV and Flighty CSV imports before writing.
- **Frequent flyer profiles:** associate programs with multiple airlines and recorded flights.
- **Local first:** flight history stays in browser storage; no account and no cloud flight-history backend.
- **Designed across devices:** responsive desktop and mobile experiences in Simplified Chinese, Traditional Chinese (Taiwan), US/UK English, Japanese, French, German, Spanish, Brazilian Portuguese and Korean.

This README describes current `main`. The Demo follows successful `main` deployments; fixed releases can have fewer features. In particular, [v0.1.1](docs/releases/v0.1.1.md) does not include the later Passport/Flight Detail redesign or passport image generator. See [current product boundaries](docs/not-implemented.md) for scope limits, not a roadmap.

## Data and privacy

Flight records are stored locally in the current origin's IndexedDB. Keepraw Fly has no account system or cloud backend that stores your flight history. The default static build does not upload flight records or include analytics SDKs. The [souvenir passport](docs/flight-passport-journal.md) uses your archive's name and a display number stored separately in localStorage. The number is not part of JSON backups; the saved image includes both name and number and is not a travel document.

Persistent storage is an optional browser capability. When supported and granted, it reduces the risk of automatic eviction under storage pressure. It cannot prevent manually clearing site data or guarantee permanent retention, and does not replace JSON backups. Installing Keepraw Fly as an app is neither required to request it nor a guarantee that it is granted.

Different origins (scheme, host and port), browser profiles and devices have separate data; project paths on one origin are not storage isolation boundaries. Deploying a new version does not intentionally clear archives. Docker upgrades do not back up or migrate personal data. The VPS only hosts website files and stores no flight archives.

**Clearing site data or browser eviction can erase your only copy.** Export a full Keepraw Fly JSON archive before clearing data or upgrading, and keep the downloaded file somewhere safe.

Airport, airline and map assets are bundled reference data, not a live flight-status service. See the [third-party notices](THIRD_PARTY_NOTICES.md).

Chinese UI fonts and, when needed, CJK fonts for passport images load from version-pinned jsDelivr resources. This third-party service receives normal resource-request metadata, not flight records or archive contents. Failed font requests fall back to system fonts. See [font sources and privacy details](THIRD_PARTY_NOTICES.md).

## Import and backup

In **Settings → Data and backup**, choose **Export Keepraw Fly JSON** for a complete archive backup. At the destination, choose the JSON import action, select the downloaded file, review the preview and confirm. Viewer preferences and the souvenir number are browser-local, not part of the portable archive.

- **Keepraw Fly JSON:** import or export the complete portable archive for backup and migration.
- **Keepraw Fly CSV bulk import:** map and validate documented columns before adding rows.
- **Flighty CSV:** import supported fields from a Flighty export; this is a one-way import, not synchronization or complete Flighty-format compatibility.

Imports into an existing archive append flights and preserve its profile and existing records. Exact duplicates are skipped; possible duplicates require your choice, and invalid rows block import. When importing JSON without an existing archive, the source profile and document metadata are retained. See the [format and CSV columns](docs/schema.md) and [example files](examples/README.md).

**Full backups contain personal details**, including names, PNRs, ticket and frequent-flyer numbers. Store and share them carefully. **Export without personal details** is for sharing, not backup: exact dates, routes and seats remain, so it is not anonymous. See [export privacy](docs/security.md#personal-data-in-exports).

## Common questions

- **Records missing after changing URL or browser?** Return to the original origin and browser profile, export JSON and import at the destination. There is no account or server copy to restore from.
- **Can I use it offline?** Cached assets may work, but offline startup is not guaranteed. Browser-local data does not imply a fully offline app.
- **Why is an import blocked?** Review the preview's validation issues and the [supported fields and examples](docs/schema.md#csv-import). Flighty import supports a subset of its CSV fields; it is not full Flighty compatibility.

## GitHub Pages self-hosting (no build)

Use the [Pages guide](docs/deployment.md#github-pages-no-build-required) to deploy a verified official release from your fork, with project subpaths or a custom domain. No local build is needed. **This mode does not run source changes made in your fork.** You explicitly select each upgrade or rollback.

## VPS self-hosting (Docker)

Use the [VPS guide](docs/deployment.md#vps-docker-and-automatic-https) for Docker/Compose, installer verification, HTTPS and maintenance. One Caddy container serves static files on amd64/arm64; the VPS stores no flight archives. The official publisher and image author is **keepraw**.

The [v0.1.1 release](https://github.com/keepraw/Keepraw-Fly/releases/tag/v0.1.1) provides the installer and prebuilt ZIP/tar.gz. Follow the guide for prerequisites and verification before installing.

## Developers: run locally

Start with [local development](docs/engineering-standards.md#local-development) for the required toolchain, install, dev server and build commands, then read the [architecture](docs/architecture.md).

## Developers: validation

Follow the [quality gates and contribution rules](docs/engineering-standards.md#quality-gates) and [browser testing guide](docs/testing.md). These are the maintained sources for checks, CI and dependency maintenance.

## Data format

The portable `keepraw-fly` archive uses schema and semantic validation. See the [format and compatibility guide](docs/schema.md) and [JSON Schema](packages/schema/keepraw-fly.schema.json).

## Documentation

The [bilingual documentation index](docs/README.md) groups user help, self-hosting, developer guidance, release notes and historical records by audience.

## License

Source code is available under the [MIT License](LICENSE). The license does not grant rights to project names, logos or identifying marks; see [TRADEMARK.md](TRADEMARK.md). Fonts, datasets, imagery and airline marks have separate terms in [third-party notices](THIRD_PARTY_NOTICES.md).
