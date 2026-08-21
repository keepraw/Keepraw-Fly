# Architecture

## Boundaries

```text
Keepraw Fly JSON
  → @keepraw-fly/validator
  → StorageAdapter
  → BrowserStorageAdapter / IndexedDB
  → @keepraw-fly/core
  → React viewer
  → validated Keepraw Fly JSON export
```

- `@keepraw-fly/schema` defines portable facts and TypeScript contracts.
- `@keepraw-fly/validator` owns structural and semantic validation.
- `@keepraw-fly/core` owns sorting, search, delays, duration, distance, route
  interfaces and Passport statistics. It does not import React.
- `apps/web` owns interaction, localization, local reference-data presentation
  and browser persistence.

## Storage abstraction

`StorageAdapter` exposes document load, save and clear operations. The Web app
uses `BrowserStorageAdapter`, implemented with Dexie over IndexedDB. A future
server-backed adapter can implement the same boundary without teaching UI
components about HTTP or SQLite.

Viewer preferences implement a separate `SettingsStore`. Language, appearance,
units, time format and Power User Mode are not included in exported flight data.
Profile names are part of the portable document and therefore travel with it.

## Import and export

Import parses JSON, validates the 0.1 schema and semantic invariants, then
replaces the active local archive. The whole validated document is stored, so
unrecognized namespaced extensions survive an import/edit/export round trip.

Export validates again before creating a readable, indented JSON download. It
does not include search indexes, statistics, Viewer preferences or temporary UI
state.

## Localization and reference data

React text uses i18next keys. Flight records contain IATA/ICAO identifiers rather
than localized names. Airport and airline names, coordinates and timezones live
in replaceable Viewer reference data. Language, distance unit and time format
are independent settings.

## Search and statistics

Core search builds normalized text from flight number, airline identifiers and
localized names, airport codes/names/cities/countries, year, aircraft type and
registration. All query terms must match.

Passport statistics are recomputed from the selected flight records. Great-circle
distance uses airport coordinates; duration uses actual timestamps when both are
available and otherwise falls back to scheduled timestamps. No derived totals
are written into Keepraw Fly JSON.

