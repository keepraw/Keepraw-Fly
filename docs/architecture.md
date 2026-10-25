# Architecture

## Boundaries

```text
Guided flight editor / JSON import / mapped CSV import / Flighty CSV import / Umetrip XLS import
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

Umetrip XLS import decodes a binary workbook locally using a lazy SheetJS chunk.
Its separate adapter locates headers, checks ticket statuses, resolves exact
airport names and infers arrival dates before entering the same canonical CSV
preflight and duplicate-review boundary. It validates the canonical schema and
semantics before preview and again before persistence. Source airport names and
wall clocks are retained in a namespaced flight extension; IATA and service date
remain the portable airport identity boundary. No historical airport entities or
coordinates are written into flight records. See the [supported XLS contract](schema.md#umetrip-xls-import).

Export validates again before creating a readable, indented JSON download. It
does not include search indexes, statistics, Viewer preferences or temporary UI
state.

## Import preflight responsiveness

CSV and Flighty share row-validation and duplicate-assessment generators.
Synchronous APIs drain those same generators; UI preflight yields between batches
with an 8 ms cooperative budget. It invalidates stale results after file, mapping
or archive changes and aborts on cancellation, replacement or unmount. Confirmation
stays disabled until the complete preview is ready. No partial archive is written.

Timezone conversion still checks every candidate offset and DST gap/overlap.
Fixed `Intl.DateTimeFormat` configurations are reused by timezone in a bounded
128-entry FIFO cache; invalid zones are not cached. This avoids repeated formatter
construction without memoizing flight data or changing timezone semantics.

One row or duplicate lookup is indivisible, and CSV text parsing is synchronous;
8 ms is not a hard deadline. Large archives and slow devices still require review.
Use `node scripts/benchmark-import-preflight.mjs` to measure the current code with
valid synthetic rows. The historical measurements in
[PR #68](https://github.com/keepraw/Keepraw-Fly/pull/68) are not CI thresholds.

## Localization and reference data

React text uses i18next keys for Simplified Chinese, Traditional Chinese (Taiwan),
US English, UK English, Japanese, French, German, Spanish, Brazilian Portuguese
and Korean. Flight records contain IATA/ICAO identifiers rather than localized names.
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

Desktop Passport also projects a bundled Natural Earth 1:50m SRTM Plus relief
texture with that same projection and geographic center. It is clipped to the
vector land geometry and transformed together with the routes while panning
and zooming. `MapRelief` caches up to three projected images and yields between
pixel strips; a failed texture load leaves the interactive vector map usable.
The texture is 554 KiB and does not replace airport/route geometry. Regenerate the texture with Pillow using
`python scripts/generate-map-relief.py /path/to/SR_50M.tif`; the pinned download,
archive checksum and public-domain license are in `map-relief.source.json`.

Desktop Flight Detail (at least 1200px) lazily loads `DetailGlobe`, reusing the
Passport Three.js renderer and `buildRouteSegments([flight])`. It draws only the
current route, including the actual diversion airport; cancelled flights and
unknown or invalid coordinates show localized explanations. Its independent
camera fits the sampled great-circle arc to the container, including polar,
date-line, coincident and antipodal routes. Home restores that route's composition;
resize recomposes Home while preserving a user-operated camera. Theme, language
and solar updates preserve the renderer. Mobile Detail creates no map or WebGL
context and requests no Globe code or imagery. Detail has no SVG map or fallback:
WebGL, context and texture failures provide localized retry. Passport keeps its
existing default composition, materials, interaction and SVG failure path.

Passport alone permits an overview zoom below 1 to fit the full world into wide
stages; regional cameras retain 16% padding and a maximum initial zoom of 6 for
geographic context. Desktop flight rows localize city names from airport data,
fall back to IATA when a city is unavailable, and flag arrival delays of at least
30 minutes. Flight Detail retains every timing deviation. Short desktop windows
(height at most 540px) show all six core statistics and omit the three Highlights.

## Source entry points

- [Current production Globe](globe.md), including Passport/Detail differences and fallback
- [Storage contracts](../apps/web/src/storage/adapter.ts) and
  [browser persistence](../apps/web/src/storage/browser.ts)
- [JSON import preflight](../apps/web/src/data/import-preview.ts) and
  [duplicate detection](../apps/web/src/data/duplicate-detection.ts)
- [Schema and compatibility](schema.md)
- [Map geometry](../apps/web/src/data/map-geometry.ts) and
  [pinned map source](../apps/web/src/data/world-map.source.json)

## Maintaining localization

`apps/web/src/locales/registry.ts` is the released UI language registry. Browser
negotiation checks `navigator.languages` in order, then `navigator.language`.
English variants use `en-US`, except UK English (`en-GB`); Chinese script tags
take precedence over region, with Taiwan, Hong Kong and Macau using `zh-TW`.
Unknown stored languages use `en-US`. The same resolver supplies initial settings
and i18next, and i18next language changes synchronize HTML `lang`.

`en-US.json` is the complete fallback. `en-GB.json` contains only regional wording
changes and falls back to US English through i18next; date/number presentation
uses the selected full locale with `Intl`. Existing saved `en` preferences become
`en-US` on read, without rewriting archives or discarding other fields. Saving a
later preference persists the normalized code. Language changes never change
saved distance units or 12/24-hour preferences. Machine timestamps, CSV fields,
archive keys and flight calculations remain locale-neutral.

All UI text, including Globe text, belongs in the regular locale resources.
Resource tests recursively verify logical keys, locale-specific cardinal plurals,
interpolation, nonempty strings and actual i18next fallback resolution. Literal
singular wording may omit `count`; other parameters must match. A new full
translation needs a registry entry and a resource entry; it must pass the same
tests before appearing in Settings. Do not register unfinished translations.
The Globe renderer and imagery remain lazy. Globe text is part of each locale's
complete resource and is available before a language switch commits.

US English is bundled as the startup and error fallback. Other resources are
Vite URL imports emitted as separate, content-hashed static JSON files. The
selected language loads on demand; the current interface remains usable until
the entire resource is ready. A request sequence prevents stale switches from
winning, and a failed fetch retains the current language with a localized retry.
The native i18next backend delegates to the same loader, so standard
`changeLanguage()` calls and cloned instances also load their own resources.
CacheStorage is optional and caches translations by their content-hashed URL.
Fifteen seconds after archive startup completes, other locales warm sequentially for offline
switching; this background transfer is separate from the initial load. Uncached
languages require a connection. Cache denial does not prevent online switching.
No translation service is contacted by the application.

Quantity placeholders use i18next's built-in `number` formatter while retaining
their variable names and numeric plural counts. Years and identifiers are not
grouped. Japanese and Korean use explicit system font stacks without downloads.
See [locale terminology and review notes](i18n-locales.md).

Chinese resources are maintained independently. `pnpm update:zh-tw` preserves
all existing Traditional Chinese wording and adds only missing keys from OpenCC,
printing a review notice. It also retains removed keys so tests flag them for
manual reconciliation. Review every added string for Taiwan terminology. Changes
to existing Simplified Chinese strings must be reconciled manually; use
`pnpm update:zh-tw --candidate /path/to/review.json` to generate a complete review
candidate without overwriting either maintained resource. OpenCC is a character
conversion aid, not Taiwan terminology review. Both maintained resources are
formatted and tested normally.

Core name APIs accept BCP 47 locales independently of released UI languages.
Partial airport/city/program names use the exact locale, then a language-only
name, then English. Existing Chinese database entries remain available; Chinese
city suffix shortening only runs for the two Chinese display locales. Add duration
wording to core's small label strategy or supply labels through `formatDuration`;
core does not depend on React/i18next or require `Intl.DurationFormat`. Only
Chinese UI locales request MiSans subsets, after preferences load; network errors
leave the CSS/system font fallback usable.

Validator and parser messages remain developer diagnostics. UI imports translate
stable codes and use localized generic copy for unknown errors. Never interpolate
internal exception details into regular import messages. Resource tests also
check emitted semantic codes, schema constraints and CSV/Flighty diagnostics.
