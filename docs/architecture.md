# Architecture

## Boundaries

```text
Guided flight editor / JSON import / mapped CSV import / Flighty CSV import
  → document creation, validation and import preflight
  → BrowserStorageAdapter / IndexedDB
  → @keepraw-fly/core calculations → React viewer
  → validated Keepraw Fly JSON export
```

- `@keepraw-fly/schema` defines portable facts and TypeScript contracts.
- `@keepraw-fly/validator` owns structural and semantic validation.
- `@keepraw-fly/core` owns sorting, search, delays, duration, distance, route
  interfaces and Passport statistics. It does not import React.
- `apps/web` owns interaction, localization, local reference-data presentation
  and browser persistence.

## Storage abstraction

`StorageAdapter` exposes document load, save and clear operations, plus the local
archive kind (`personal` or `demo`). The Web app uses `BrowserStorageAdapter`,
implemented with Dexie over IndexedDB. A future
server-backed adapter can implement the same boundary without teaching UI
components about HTTP or SQLite.

Viewer preferences implement a separate `SettingsStore`. Language, appearance,
units, time format, Power User Mode and the last-backup timestamp are not included
in exported flight data. Appearance defaults to the system setting.
Profile names are part of the portable document and therefore travel with it.

## Import and export

New users can create an empty archive and add flights through a guided form.
The editor turns airport-local date/time fields into explicit ISO 8601 timezone
offsets using bundled airport reference data. JSON remains the portable exchange
and backup format rather than a first-use requirement.

JSON import parses and migrates supported legacy formats, then validates the
0.1.0 schema and semantic invariants. All import workflows preview new records,
exact duplicates, possible duplicates and blocking issues before confirmation.
Exact duplicates are skipped; possible duplicates require an explicit choice.
Invalid input blocks the import instead of silently dropping invalid records.

When no archive is active, JSON import starts an archive from the validated
document. Otherwise, it appends selected flights and preserves the
existing profile and document-level extensions. Referenced frequent-flyer
memberships are merged, with conflicting membership IDs remapped. Imported
flight extensions are retained; source document-level extensions are not merged
into an existing archive.

Keepraw Fly mapped CSV import maps six required columns plus optional flight
facts, validates every row and previews sample records before confirmation.
Flighty CSV import first maps Flighty's native headers and values into the same
canonical CSV boundary. Both
workflows convert valid rows to canonical flight records and append them to the
active archive; they never replace existing flights. CSV local times are
resolved using the corresponding airport timezone; explicit RFC3339 offsets
remain supported.

Export validates again before creating a readable, indented JSON download. It
does not include search indexes, statistics, Viewer preferences or temporary UI
state.

## Localization and reference data

React text uses i18next keys for English, Simplified Chinese and Traditional
Chinese. Flight records contain IATA/ICAO identifiers rather than localized names.
Airport and airline names, coordinates and timezones live
in replaceable Viewer reference data. Language, distance unit and time format
are independent settings.

The compact 7,800+ airport directory is emitted as a content-hashed JSON asset,
loaded before the archive UI, and installed into stable core collection
references. This keeps the reference snapshot out of the parse-critical app
JavaScript while retaining an entirely local/static runtime. The viewer shows a
retryable error instead of silently running with partial reference data.

## Search and statistics

Core search builds normalized text from flight number, airline identifiers and
localized names, airport codes/names/cities, service date, year, aircraft type and
registration. All query terms must match.

Passport statistics are recomputed from the selected flight records. Great-circle
distance uses airport coordinates; duration uses actual timestamps when both are
available and otherwise falls back to scheduled timestamps. No derived totals
are written into Keepraw Fly JSON. Cancelled flights are excluded from flown
statistics, and distance and visited-airport totals use the diversion airport
when one is recorded.

The Passport route map uses the same airport coordinates. A reproducible update
script converts pinned Natural Earth 1:110m country polygons into checked-in SVG
paths. At runtime, `d3-geo` applies the matching Equal Earth projection to airport
points and great-circle routes, including adaptive sampling and date-line
clipping. The local SVG viewport supports pan, zoom, reset and route/airport
selection. No external map tiles, map API calls or device location are required.

## Source entry points

- [Storage contracts](../apps/web/src/storage/adapter.ts) and
  [browser persistence](../apps/web/src/storage/browser.ts)
- [JSON import preflight](../apps/web/src/data/import-preview.ts) and
  [duplicate detection](../apps/web/src/data/duplicate-detection.ts)
- [Schema and compatibility](schema.md)
- [Map geometry](../apps/web/src/data/map-geometry.ts) and
  [pinned map source](../apps/web/src/data/world-map.source.json)
