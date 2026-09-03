# Architecture

## Boundaries

```text
Guided flight editor / Keepraw Fly JSON import
  → typed document creation / @keepraw-fly/validator
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

New users can create an empty archive and add flights through a guided form.
The editor turns airport-local date/time fields into explicit ISO 8601 timezone
offsets using bundled airport reference data. JSON remains the portable exchange
and backup format rather than a first-use requirement.

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

The Passport route map uses the same airport coordinates. A reproducible update
script converts pinned Natural Earth 1:110m land data into checked-in SVG paths.
At runtime, `d3-geo` applies the matching Natural Earth 1 projection to airport
points and great-circle routes, including adaptive sampling and date-line
clipping. No external map tiles, API calls or location data are required.
