# Keepraw Fly Schema

Keepraw Fly JSON is the portable canonical format. It stores flight facts and
stable identifiers, while viewers derive display names, delays, distances and
statistics.

Version `0.2.0` adds optional physical `airportId` values to flight endpoints;
the original IATA codes remain unchanged. Versions `0.1.0` and `0.1` remain
importable. Old applications reject the new fields/version and are not claimed
to be forward compatible. Namespaced `extensions`
allow compatible software to carry additional facts without making them part
of the core schema. Unknown extension values must be preserved when opening,
editing and exporting their owning records. Appending flights to an existing
archive keeps the existing document-level extensions.

Viewer preferences such as language, appearance, units and time format are not
part of this document. They belong to local application storage.

Keepraw Fly stores optional `ticketNumber`, `bookingReference` and string-valued
`baggageCarousel` flight metadata without conflating a baggage carousel with
whether a passenger checked baggage. Aircraft `type` and `registration` belong
to the `keepraw-fly.aircraft` extension, not the core flight object.

Frequent-flyer memberships are user-level entities. A flight references a
membership by `membershipId` and keeps `tierAtFlight` as the historical tier
snapshot; program display data and the member number are resolved from the
membership and program data layers instead of being copied into every flight.
Membership airline associations are exported as canonical code arrays, with
an optional `defaultAirline` that must belong to that array.

Import migration accepts older namespaced ticket/baggage/frequent-flyer values,
including comma-delimited airline associations, while new exports use the
canonical typed structure. Archives with airport IDs are saved/exported as
`0.2.0`; supported legacy metadata is migrated before validation at the import
boundary. Unknown airport IDs are preserved without requiring a catalogue match.

See the [JSON Schema](keepraw-fly.schema.json),
[TypeScript contracts](src/index.ts), and the
[format guide](../../docs/schema.md) for required fields, semantic validation,
examples and compatibility rules.
