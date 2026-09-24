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
origin/destination IATA codes and scheduled departure/arrival timestamps.
Actual timestamps are optional. Datetimes follow ISO 8601/RFC 3339 and include
an explicit UTC offset or `Z`. Optional flight facts include `cancelled: true` and
`divertedTo`, which preserves the planned `destination` while recording the
actual diversion airport. Cancelled records remain in the archive but are excluded
from flown-flight statistics.

The validator also requires unique flight IDs, a service date matching the
scheduled departure's local date, and arrival instants later than departure
instants.

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
flight stores only the account reference and the historical tier snapshot:

```json
{
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
      "ticketNumber": "479-2401988421",
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

Standard 13-digit ticket numbers are stored as digits and displayed with the
three-digit airline prefix separated by a hyphen. Non-standard values are
preserved as entered. Ticket number and booking reference/PNR are separate
nullable string facts.

`bookingClass` stores the airline's single-letter booking class independently
from the broader cabin class. `baggageCarousel` is a nullable string because
real carousel identifiers may be alphanumeric. It does not indicate whether
the passenger checked baggage.

Older `keepraw-fly.baggage`, `keepraw-fly.ticket`, and flight-level
`keepraw-fly.frequent-flyer` extensions are migrated on import. Their canonical
replacement is emitted on the next save/export; `checkedBaggage` is discarded.

Unknown extension values may be ignored for display but must be retained through
normal import/edit/export operations.
