# Airport identities and reviewed assignments

Fly stores the airport the user selected. Opening an archive, changing dates or
updating reference data cannot replace that confirmation with a code lookup.
Normal matching is offline and does not use the worldwide research database.

## Audit and architecture

Previously, opening an archive, focusing airport search and previewing imports
loaded candidate shards. Candidate location comparisons influenced usable
coordinates, timezones and statistics; subscriptions invalidated views as shards
arrived. Selecting a historical result returned only its IATA code. A later
date lookup could therefore lose the selected physical airport.

The runtime now has two data sources:

| Data | Identity and purpose |
| --- | --- |
| Airport Directory | `airportById` contains permanent physical entities. `airportByIata` is a current lookup index into those entities. |
| Airport Code Assignment | Reviewed upstream assignments refer to directory IDs, with their original sources and conservative date bounds. |

The existing compact airport rows retain their first seven fields and append
`airportId`, ICAO, optional status, historical names and search aliases.
IDs are allocated once as opaque UUIDs and committed with the directory;
updates must retain them. The bootstrap ID file covers only the existing small
startup directory. It does not duplicate airport entities or historical data.

The 46 upstream physical entities retain their original `apt_…` IDs. The small
`formal/directory.json` crosswalk supplies current lookup codes, search aliases,
city, country, reference status and geographical IANA-zone fallbacks. Its fields
are directory metadata, **not historical allocation evidence**. Formal entities
always use their own reference coordinates: current directory coordinates for
LYG and LZO still described predecessor sites, and the NMI reference point also
needed correction. A current name or alias does not prove a dated assignment.

KMG's original Wujiaba entity is retained, with a separate permanent entity for
Changshui from the existing pinned OurAirports snapshot row 27214. The source
locator is in `airports.source.json`. No KMG allocation dates are added; the
shared code requires manual confirmation. Closed entities remain searchable.

## Resolution and persistence

Each of `origin`, `destination` and `divertedTo` has its own optional `airportId`:

```json
{
  "iata": "HKG",
  "airportId": "apt_86460159-a072-4a18-afcc-ab376cda7047"
}
```

This is the existing upstream Kai Tak ID. The raw IATA remains `HKG` even when
the selected entity has a different current code. Search selects an entity;
typing a replacement code is a separate edit and clears the previous selection.
Unknown stored IDs are preserved and stay unresolved, rather than falling back
to another airport with the same code.

Resolution order is saved ID, unique reviewed historical assignment, then
current-directory lookup where no known historical conflict exists. A code with
formal history outside the certain window remains unresolved. Known different
directory entities sharing a search code also require confirmation. Directory
fallback provides reference information; it never creates an assignment or
claims historical validity.

Assignments retain `[validFrom, validTo)` semantics. Unknown boundaries retain
`earliest`, `latest` and `precision`: certain coverage is
`[validFrom.latest, validTo.earliest)`. Null bounds are not invented dates.
Reviewed assignments and their source records must be verified. Competing
possible sites prevent automatic selection; certain conflicting assignments
remain ambiguous. Directory revision timestamps never become effective dates.

Flight editing, JSON, map routes, statistics, distance, timezone display and
share-image aggregation use the physical identity. Planned arrival and actual
diversion resolve independently. A manual confirmation uses the selected
entity's zone when converting wall times, and survives date and unrelated edits.

## Manual research

Only the explicit historical lookup button dynamically loads the research
client. It reads the small upstream IATA-to-reference-ID index and the record
shards required for that code, then filters those records. There is no global
name scan, global candidate download or research subscription in the archive.

The client pins commit `bb1046455e949c6c0bf3a18769464cb232bec19e` and checks
every compressed file against SHA-256 values from that commit's manifest.
It uses HTTP caching, a bounded four-file in-memory cache and a request timeout.
Failure removes the failed in-memory entry so the user can retry. Missing
WebCrypto or a checksum mismatch fails closed. A failed lookup never changes
the directory, resolver, archive or confirmed endpoint.

Research rows are informational unless an explicit OurAirports external ID
links to a reviewed directory entity. Confirmation then stores that entity's
permanent ID, never a `ref_`, `loc_`, `siteId` or candidate ID. Names without a
directory entity remain unselectable; further directory admission belongs in
a separately reviewed data change.

The 88,330 event groups, 117,356 selected candidates, 86,950 reference records,
code observations, source revisions and physical hypotheses remain in
[Keepraw Airport History](https://github.com/keepraw/airport-history/tree/bb1046455e949c6c0bf3a18769464cb232bec19e).
Fly removes its copied observations/transitions, global search index and bulk
SQLite export builder. Research sources are not deleted or rewritten upstream.

## Updating and compatibility

`scripts/update-airport-history.py` fetches only upstream `data/airports.json`
at the pinned revision and verifies SHA-256
`4573fb7e6fac8e02c8e3f57443599385dffada17b250a29f1a18964f6d6d8cc9`.
`--check` compares the committed formal bytes with that source in CI. Updating
the pin requires reviewing the dataset and directory crosswalk together.

The directory updater reuses stable IDs. New or changed names/coordinates
require an explicit `--identities=FILE` mapping of code to reviewed permanent
ID. A rename or coordinate correction keeps the ID; relocation uses a different
ID. Removed rows are retained with unknown status unless closure was already
recorded. Previous names and code aliases remain search terms. This update tool
does not infer physical identity or historical dates.

Format `0.2.0` adds endpoint IDs. Existing `0.1.0`, `0.1` and supported RawFly
backups remain importable. Old records acquire no artificial confirmation.
Archives containing IDs are migrated/exported as `0.2.0`; unknown IDs do not
invalidate otherwise valid flights. Old readers reject the new version/fields:
the old endpoint schema used `additionalProperties: false`. Forward
compatibility with old applications is deliberately not claimed.

The CSP-safe validator is generated from the schema during dependency
installation, including CI, rather than committing a second hand-maintained
copy. Browser validation still uses precompiled code without `eval`.

## Verification and remaining limits

Regression coverage includes old JSON, independent endpoints, date edits,
unknown IDs, HKG/VHHH reuse, TAO half-open boundaries, closed-airport search,
TSE/NQZ continuity, coordinate corrections, image aggregation, selective
research loading, checksum rejection and network failure. Browser journeys
cover manual selection, saving, reload, editing and failed research lookup.

For this refactor, dependencies, tests, type checks, formatting checks and
builds are not run locally, as requested. Remote CI results must be attached
before treating the change as validated; GitHub authentication was unavailable
while preparing this change.

The reviewed history remains limited to the existing 55 assignments (28 IATA,
27 ICAO), 112 sources and three name intervals. Most directory entries do not
have reviewed historical allocations. Unknown historical reuse outside this
dataset still needs user confirmation and, if the physical entity is absent,
directory admission. Supplemental reference names, statuses and zones are not
proof of historical code dates. No global historical completeness is claimed.
