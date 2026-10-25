# Keepraw Fly JSON Format 0.1

Keepraw Fly JSON is Keepraw Fly's canonical portable archive format. JSON
export is a complete backup of the archive's profile, flights, memberships and
extensions. The machine-readable specification uses JSON Schema Draft 2020-12
and lives in
[`packages/schema/keepraw-fly.schema.json`](../packages/schema/keepraw-fly.schema.json).

The `format` identifier distinguishes a Keepraw Fly archive from other JSON
documents. `formatVersion` identifies the data format version; it is independent
of the application version.

```json
{
  "format": "keepraw-fly",
  "formatVersion": "0.1.0",
  "profile": {},
  "flights": []
}
```

Every core flight has a stable `id`, flight number, service date, airline,
origin/destination IATA codes and scheduled departure/arrival timestamps. The
`origin` and `destination` endpoints share the same optional `terminal` and
`gate` fields.
Actual timestamps are optional. Datetimes follow ISO 8601/RFC 3339 and include
an explicit UTC offset or `Z`. Optional flight facts include `cancelled: true` and
`divertedTo`, which preserves the planned `destination` while recording the
actual diversion airport. Cancelled records remain in the archive but are excluded
from flown-flight statistics.

The validator also requires unique flight and membership IDs, valid membership
references, a service date matching the date written in scheduled departure,
and scheduled arrival later than scheduled departure. When both actual times
are present, actual arrival must also be later than actual departure. A flight
cannot be both cancelled and diverted.

## Compatibility and migration

`keepraw-fly` with version `0.1.0` is the canonical representation. Import and
browser-storage boundaries also recognize the former `rawfly` format identifier
and the early `0.1` version shorthand. They are copied and upgraded in memory,
validated against the current schema, and saved/exported as canonical 0.1.0.
Only explicitly supported legacy representations may be migrated. Unsupported
future versions are rejected before migration; readers must not guess at their
structure or reinterpret them as the current format. Migration never guesses at
flight facts or changes timestamps, identifiers, endpoints or profile data.
Legacy travel extensions are upgraded to their typed metadata equivalents as
described below.

Browser storage distinguishes an absent archive from an existing archive that
fails validation, migration or version compatibility checks. An unreadable
archive enters recovery mode while its original stored value remains intact.
Only a completed migration whose result passes current validation may replace
the stored archive automatically. Recovery downloads serialize the original
stored value without validation, migration or canonical export processing;
they preserve unknown fields as well as supported archive facts. Importing a
validated backup or clearing local data requires an explicit user confirmation.

## Facts, not derivatives

The document does not store delay minutes, distance, duration, totals, rankings
or search indexes. Compatible viewers derive those values.

## Flight metadata and extensions

Ticket, booking, baggage-carousel and frequent-flyer relationship facts are
typed flight metadata. Frequent-flyer accounts belong to the archive, while a
flight stores only the account reference and the historical tier snapshot.
This complete example uses fictional data:

```json
{
  "format": "keepraw-fly",
  "formatVersion": "0.1.0",
  "profile": {},
  "frequentFlyerMemberships": [
    {
      "id": "ff_phoenixmiles_01",
      "programId": "phoenixmiles",
      "memberNumber": "ZH-88301924",
      "tier": "silver",
      "associatedAirlines": ["ZH", "CA"],
      "defaultAirline": "CA"
    }
  ],
  "flights": [
    {
      "id": "flight_example_01",
      "flightNumber": "CA1234",
      "serviceDate": "2025-04-12",
      "airline": { "iata": "CA" },
      "origin": { "iata": "PEK" },
      "destination": { "iata": "SHA" },
      "scheduledDeparture": "2025-04-12T09:00:00+08:00",
      "scheduledArrival": "2025-04-12T11:15:00+08:00",
      "ticketNumber": "4792401988421",
      "bookingReference": "KY78M9",
      "baggageCarousel": "D05",
      "frequentFlyer": {
        "membershipId": "ff_phoenixmiles_01",
        "tierAtFlight": "gold"
      },
      "extensions": {
        "keepraw-fly.aircraft": {
          "type": "B789",
          "registration": "N12345"
        },
        "keepraw-fly.seat": {
          "seat": "14F",
          "cabin": "economy",
          "bookingClass": "P"
        }
      }
    }
  ]
}
```

`tier` is the membership's current tier. `tierAtFlight` is immutable historical
data: changing the current membership tier does not rewrite earlier flights.
Program display names and alliance details are resolved from `programId`; a
custom `programName` may be stored on the membership when no reference exists.
Associated airlines are canonical airline-code arrays. `defaultAirline`, when
set, must be one of those codes; a single associated airline becomes the
default automatically.

The flight editor normalizes standard 13-digit ticket numbers to digits; display
formatting separates the three-digit airline prefix with a hyphen. The schema
also accepts non-standard non-empty strings and does not itself normalize
imported ticket numbers. Ticket number and booking reference/PNR are separate
nullable string facts.

Aircraft `type` and `registration` are stored in `keepraw-fly.aircraft`, not as
top-level flight properties. Seat and cabin facts belong to `keepraw-fly.seat`.

`bookingClass` stores the airline's single-letter booking class independently
from the broader cabin class. `baggageCarousel` is a nullable string because
real carousel identifiers may be alphanumeric. It does not indicate whether
the passenger checked baggage.

Older `keepraw-fly.baggage`, `keepraw-fly.ticket`, and flight-level
`keepraw-fly.frequent-flyer` extensions are migrated on import. Their canonical
replacement is emitted on the next save/export; `checkedBaggage` is discarded.

Unknown namespaced extension values may be ignored for display but must
round-trip unchanged when editing and exporting their owning records. Core
objects reject undeclared properties; additional data belongs in namespaced
`extensions` keys such as
`example.organization`. The viewer preserves document-level extensions when
opening an archive, but appending to an existing archive retains that archive's
document-level extensions rather than merging those from the source file. See
[import behavior](architecture.md#import-and-export).

## CSV import

Use [the mapped CSV example](../examples/flights.csv) or download the template
from Settings. The first row contains column headers. Recognized English and
Chinese aliases are mapped automatically; the import preview lets you choose
the source column for every supported field. Column order is flexible.

| Fields                                                                   | Required | Values                                                                                                                                             |
| ------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flightNumber`                                                           | Yes      | Uppercase airline prefix plus flight number, without spaces or hyphens, for example `MU589`; the airline is derived from the prefix.               |
| `serviceDate`                                                            | Yes      | `YYYY-MM-DD`, matching departure's airport-local date.                                                                                             |
| `originIata`, `destinationIata`                                          | Yes      | Distinct uppercase IATA codes in the bundled airport directory.                                                                                    |
| `scheduledDeparture`, `scheduledArrival`                                 | Yes      | Date and time as described below; arrival must follow departure.                                                                                   |
| `actualDeparture`, `actualArrival`                                       | No       | Recorded actual date and time.                                                                                                                     |
| `originTerminal`, `originGate`, `destinationTerminal`, `destinationGate` | No       | Terminal and gate text.                                                                                                                            |
| `cancelled`, `divertedToIata`                                            | No       | Use `true`/`false` for cancellation; `1`/`yes` also mean true. A diversion uses a known IATA code. A flight cannot be both cancelled and diverted. |
| `ticketNumber`, `bookingReference`                                       | No       | Separate ticket number and booking reference/PNR.                                                                                                  |
| `aircraftType`, `aircraftRegistration`                                   | No       | Aircraft facts stored in the aircraft extension.                                                                                                   |
| `seat`, `bookingClass`, `cabin`                                          | No       | Seat and cabin text; booking class is a single letter, normalized to uppercase.                                                                    |

The six required fields must be mapped and populated in every row. Optional
fields may be unmapped or empty. Offset-free times must use `YYYY-MM-DDTHH:mm`,
for example `2026-09-02T13:00`. Times with `Z` or `±HH:mm` may also include
whole seconds, for example `2026-09-02T13:00:00+08:00`. Fractional seconds are
not supported. Offset-free times use the corresponding airport's timezone; actual
arrival uses the diversion airport when present. Ambiguous or nonexistent local
times without an explicit offset are rejected. Explicit offsets identify an
instant, including either occurrence of a repeated DST time. That instant is
converted to the corresponding airport's timezone without resolving its local
clock time again. Imported times are stored at minute precision (seconds are
truncated). Invalid dates, clock values, offsets and airport timezones block
import rather than being normalized or reported as flight-number errors.

Flighty exports use the dedicated **Flighty import** action, illustrated by
[the Flighty example](../examples/flighty.csv). Its native headers and airline,
flight and cabin values are converted before the same validation and duplicate
checks. See [the CSV implementation](../apps/web/src/data/csv-import.ts) and
[Flighty mapping](../apps/web/src/data/flighty-import.ts) for the accepted aliases.

Both workflows append selected records after preview, skip exact duplicates and
require an explicit choice for possible duplicates. CSV is an import format,
not a full archive backup: it generates new flight IDs and does not carry profile
data, frequent-flyer memberships, baggage-carousel values or arbitrary extensions.
Use Keepraw Fly JSON export to back up the complete portable archive.

## Umetrip XLS import

In **Settings → Data and backup → Umetrip XLS import**, select a genuine binary
Excel `.xls` file, review the counts and source-row diagnostics, then confirm.
Everything runs in the browser. Selected flights append through the existing
CSV preflight, exact/possible duplicate review, schema/semantic validation and
storage adapter. The active profile, memberships, existing flights and archive
extensions are preserved. Ticket numbers do not identify flights or segments.

**Compatibility evidence is one real Umetrip export**, inspected locally but
never committed. It is a CFB/BIFF8 workbook with text dates/clocks and separate
upcoming, completed, OPEN and invalid-ticket worksheets. It contained 33 rows:
19 explicitly used rows passed preflight, and 14 were excluded (one unused, two
OPEN, ten refunded, one exchanged), with no blocking errors. These counts record
that local validation only; they are not parser assumptions or public fixtures.
No claim is made about all historical Umetrip versions. Additional layout and
numeric-cell support is tested using [wholly fictional workbooks](../tests/fixtures/umetrip/README.md).

### Workbook and column contract

Worksheets are scanned independently, in any order. Headers may move and columns
may be reordered. Whitespace and full-width header characters are normalized;
columns are identified only by the explicit aliases below. Missing required or
duplicate field headers block import. A nonempty unknown worksheet or data row
is reported rather than silently discarded. Blank rows and single-cell notes
starting with `说明：`, `备注：` or `注：` (ASCII colons also accepted), plus the
Umetrip export title, are skipped. Empty worksheets are allowed.

| Source headers                 | Canonical use                                            |
| ------------------------------ | -------------------------------------------------------- |
| `日期`, `航班日期`, `出发日期` | Required `serviceDate`                                   |
| `航班号`                       | Required `flightNumber`; existing airline-code resolver  |
| `出发城市`, `出发机场`         | Required exact airport name or IATA → `origin.iata`      |
| `到达城市`, `到达机场`         | Required exact airport name or IATA → `destination.iata` |
| `出发时间`, `起飞时间`         | Required local departure clock                           |
| `到达时间`                     | Required local arrival clock                             |
| `客票状态`                     | Required per-row eligibility check                       |
| `航空公司`                     | Optional original airline text, retained as provenance   |
| `客票号`, `票号`               | Optional `ticketNumber` using existing normalization     |
| `到达日期`                     | Optional explicit arrival date; validated if provided    |

Other columns, including passenger names and source mileage, are not imported.
There is no inferred seat, aircraft, terminal, PNR, actual time or delay.
Airline references come from the flight-number prefix using the existing offline
resolver; the source airline text does not override that identity.

Only `已使用` is eligible, and its arrival must be in the past. `未使用`, `未出行`
and `待出行` are excluded as unused; `OPEN`/`OPEN票` as OPEN; `已退票`/`退票` as
refunded; `已换开`/`换开` as exchanged; and `无效`/`无效票`/`已作废`/`作废` as
invalid. `未使用` in an `OPEN票` worksheet is classified as OPEN. Known category
names accept an optional numeric count suffix and whitespace. A used status in
an upcoming, OPEN or invalid category blocks import as a contradiction. Unknown
or empty statuses block import, even on a completed worksheet. Exclusions have
counts, reasons and worksheet/physical-row references in the preview. Missing
dates or placeholder times on explicitly excluded tickets do not block import.

The reader requires a CFB signature and the existing file-size/aggregate-record
limits. Renamed CSV/HTML/XLSX, encrypted or damaged workbooks, formulas and Excel
error values in mapped fields are rejected. Raw pre-CFB BIFF, arbitrary localized
headers and other Umetrip layouts have not been verified.

### Airports and time

Airport matching uses bundled localized airport names, IATA codes, normalized
punctuation and airport/international suffixes. A small separate alias layer
handles legacy/spelling exceptions such as Qingdao Liuting and the abbreviated
Mumbai airport name. There is no city-only, substring or fuzzy matching. Missing
or ambiguous names block import with a worksheet/row reference; check the source
and replace the value with a verified IATA code before retrying.

Dates accept `YYYY年M月D日`, year-first dates with consistent `-`, `/` or `.`
separators, and integer Excel serial dates in either the 1900 or 1904 system.
Excel's fictitious 1900-02-29 is rejected. Clocks accept `H:mm`, `HH:mm`, optional
`:00` seconds, or numeric fractional days at minute precision. Nonzero seconds,
date/time combinations in one cell and ambiguous day/month dates are rejected.

The importer reuses the editor/CSV IANA timezone resolver for both endpoints and
the flight date, including DST. It evaluates arrival local dates from two days
before through three days after departure; it does not add a day merely because
the arrival clock is earlier. Broad sanity bounds are a minimum of
`max(15 minutes, distance / 1200 km/h - 30 minutes)` and a maximum of
`min(24 hours, distance / 400 km/h + 3 hours)`. Distances use the existing directory
only as a coarse duration constraint, not historical physical-airport identity.
An explicit arrival date must satisfy the same checks. No candidate, multiple
candidates, a DST gap/overlap or an invalid timezone blocks import. These bounds
can reject unusual short, slow or very long flights; there is no automatic
override or assumption that the nearest date is correct.

Because source clock semantics are not confirmed, clocks are saved in the
required **scheduled** timestamp fields, never as actual times. Imported flights
retain a versioned `keepraw-fly.umetrip` extension with source sheet/row, selected
raw date/clock/airport/airline/flight/status values, Excel date system, `timeBasis: "unspecified"`
and `arrivalDateInferred`. No source file, passenger columns or airport coordinates
are stored. IATA + service date remains the interface for a future historical
airport layer. Full JSON backups retain this provenance; the existing shareable
export drops the extension and ticket number.

SheetJS CE is loaded only after a file passes the initial size/extension/signature
gates. The production decoder chunk is approximately 352 kB (118 kB gzip) in
the reviewed build. It has no extra runtime dependencies. Binary decoding is
synchronous on the browser main thread; row validation/duplicate preflight is
cooperative and cancellable. The [security notes](security.md#import-limits)
cover the pinned dependency, advisories, license and resource limits.
