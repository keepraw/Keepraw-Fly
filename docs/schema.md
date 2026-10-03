# Keepraw Fly 0.1 Schema

The canonical schema is
[`packages/schema/keepraw-fly.schema.json`](../packages/schema/keepraw-fly.schema.json).

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
Unsupported future versions remain rejected; migration never guesses at flight
facts or changes timestamps, identifiers, endpoints or profile data. Legacy
travel extensions are upgraded to their typed metadata equivalents as described
below.

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

Unknown extension values may be ignored for display but must be retained when
editing and exporting their owning records. Core objects reject undeclared
properties; additional data belongs in namespaced `extensions` keys such as
`example.organization`. The viewer preserves document-level extensions when
opening an archive, but appending to an existing archive retains that archive's
document-level extensions rather than merging those from the source file. See
[import behavior](architecture.md#import-and-export).

## CSV import

Use [the mapped CSV example](../examples/flights.csv) or download the template
from Settings. The first row contains column headers. Recognized English and
Chinese aliases are mapped automatically; the import preview lets you choose
the source column for every supported field. Column order is flexible.

| Fields | Required | Values |
| --- | --- | --- |
| `flightNumber` | Yes | Uppercase airline prefix plus flight number, without spaces or hyphens, for example `MU589`; the airline is derived from the prefix. |
| `serviceDate` | Yes | `YYYY-MM-DD`, matching departure's airport-local date. |
| `originIata`, `destinationIata` | Yes | Distinct uppercase IATA codes in the bundled airport directory. |
| `scheduledDeparture`, `scheduledArrival` | Yes | Date and time as described below; arrival must follow departure. |
| `actualDeparture`, `actualArrival` | No | Recorded actual date and time. |
| `originTerminal`, `originGate`, `destinationTerminal`, `destinationGate` | No | Terminal and gate text. |
| `cancelled`, `divertedToIata` | No | Use `true`/`false` for cancellation; `1`/`yes` also mean true. A diversion uses a known IATA code. A flight cannot be both cancelled and diverted. |
| `ticketNumber`, `bookingReference` | No | Separate ticket number and booking reference/PNR. |
| `aircraftType`, `aircraftRegistration` | No | Aircraft facts stored in the aircraft extension. |
| `seat`, `bookingClass`, `cabin` | No | Seat and cabin text; booking class is a single letter, normalized to uppercase. |

The six required fields must be mapped and populated in every row. Optional
fields may be unmapped or empty. Offset-free times must use `YYYY-MM-DDTHH:mm`,
for example `2026-09-02T13:00`. Times with `Z` or `±HH:mm` may also include
whole seconds, for example `2026-09-02T13:00:00+08:00`. Fractional seconds are
not supported. Offset-free times use the corresponding airport's timezone; actual
arrival uses the diversion airport when present. Ambiguous or nonexistent local
times are rejected. Imported times pass through the editor's conversion and are
stored at minute precision.

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
