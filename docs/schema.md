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
    }
  }
}
```

Unknown extension values may be ignored for display but must be retained through
normal import/edit/export operations.

