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
an explicit UTC offset or `Z`.

The validator also requires unique flight IDs, a service date matching the
scheduled departure's local date, and arrival instants later than departure
instants.

## Compatibility and migration

`keepraw-fly` with version `0.1.0` is the canonical representation. Import and
browser-storage boundaries also recognize the former `rawfly` format identifier
and the early `0.1` version shorthand. They are copied and upgraded in memory,
validated against the current schema, and saved/exported as canonical 0.1.0.
Unsupported future versions remain rejected; migration never guesses at flight
facts or changes timestamps, identifiers, endpoints, profile data or extensions.

## Facts, not derivatives

The document does not store delay minutes, distance, duration, totals, rankings
or search indexes. Compatible viewers derive those values.

## Extensions

Advanced facts use namespaced keys:

```json
{
  "extensions": {
    "keepraw-fly.aircraft": {
      "type": "B789",
      "registration": "N12345"
    },
    "keepraw-fly.seat": {
      "seat": "14F",
      "cabin": "economy",
      "bookingClass": "P"
    },
    "keepraw-fly.baggage": {
      "checkedBaggage": true,
      "carousel": "8"
    },
    "keepraw-fly.ticket": {
      "number": "7811234567890"
    },
    "keepraw-fly.frequent-flyer": {
      "membershipId": "membership-zh",
      "programName": "PhoenixMiles",
      "memberNumber": "ZH123456",
      "tier": "Gold"
    }
  }
}
```

The document-level `keepraw-fly.frequent-flyer` extension stores a
`memberships` array with stable IDs, program/member identifiers, current tier,
associated airline codes and optional airline defaults. A flight-level value
is an immutable snapshot of the membership facts used for that journey.
Changing a profile tier does not rewrite historical flight snapshots.

Standard 13-digit ticket numbers are stored as digits and displayed with the
three-digit airline prefix separated by a hyphen. Non-standard values are
preserved as entered.

`bookingClass` stores the airline's single-letter booking class independently
from the broader cabin class. `checkedBaggage` distinguishes an explicit
carry-on-only journey (`false`) from an unrecorded baggage fact. `carousel` is
optional and is only recorded when the user had checked baggage.

Unknown extension values may be ignored for display but must be retained through
normal import/edit/export operations.
