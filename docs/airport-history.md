# Airport identities, names and formal updates

Fly joins airport data by permanent `airportId`. Flight records keep the
original IATA code and any user-confirmed ID on each endpoint. The historical
resolver uses the endpoint's local civil date to resolve a code assignment.

| Layer                              | Purpose                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Airport History                    | Physical sites, dated IATA and ICAO assignments, official name intervals      |
| Fly directory                      | Locations, geographical timezones, current lookup codes and locality metadata |
| Airport display names              | Localized labels and search terms keyed by physical site                      |
| [UI localization](i18n-locales.md) | Interface text and display formatting                                         |

## Formal data and directory

[The pinned manifest](../packages/core/data/airport-history/formal/manifest.json)
identifies the exact upstream commit, schema, query horizon and SHA-256.
The formal JSON is vendored byte for byte. Version 0.14.0 contains 6,510
physical sites, 6,370 IATA assignments, 6,214 ICAO assignments and three
historical name intervals. The supported bulk history starts on 2000-01-01
and runs up to 2026-11-19, exclusive. A few reviewed intervals reach earlier
dates, including Kai Tak. [0.14.0 production manifest](https://raw.githubusercontent.com/keepraw/airport-history/9127f353831d50d53be91b5a24dd155c26c6ff1b/data/production-manifest.json)

The importer and runtime require Schema 4.0.0. Fly uses the published
assignment and official-name intervals directly and applies its reviewed
physical-site transfers to the original upstream assignments.

All 7,885 preexisting Fly rows remain in `airports.iata.json`. The
[formal directory](../packages/core/data/airport-history/formal/directory.json)
supplies locality and status and records physical-site crosswalks under
`legacyIds`. A crosswalk uses site proximity and supporting ICAO, name or
near-identical reference coordinates. The pinned [OurAirports CSV](https://raw.githubusercontent.com/davidmegginson/ourairports-data/d97df1673cc5ba61a09b17ab5936091a669a04ca/airports.csv)
supplies locality and status by external ID. The same-site reference point
from Fly is retained. Distinct sites with a shared code stay independently
searchable. The Basel and Mulhouse Fly IDs point to one physical identity,
with BSL in the current lookup and MLH in the search aliases. A site without
an IATA assignment can appear by name or ICAO in search.

The current index uses unique assignments that are certain on the
last day before `queryHorizon.toExclusive`. Closed formal sites have no
current code. Fly-only current codes apply where the formal dataset has no
IATA assignment for that code. Past IATA and ICAO codes stay in historical
search. PBI and FRU are searchable as former codes for DJT and BSZ.

The [0.13.0 crosswalk audit](audits/airport-crosswalk-0.13.0.md) records all
5,893 links, direct ID matches, unlinked Fly IDs and alternative candidates.
It identifies evidence that needs manual review of physical identity.

Each original ID still resolves through `airportById`. Routes and statistics
group a Fly alias and its upstream ID as the same site. Closed sites and
historical predecessors retain independent IDs and names.

## Flight resolution and archives

Fly checks a stored endpoint ID first, then a unique dated
assignment. An unavailable stored ID remains available for later resolution.
A directory reference can supply a point or zone when the assignment history
allows a single site, including an ordinary directory airport outside the
formal horizon. Competing possible assignments require a confirmation.

The resolver uses half-open intervals. Certain coverage starts at
`validFrom.latest` and ends before `validTo.earliest`. Open bounds and
competing sites retain their uncertainty. The original flight date can
resolve a different site from the current lookup for the same code.

Archive version 0.2.0 persists the optional ID independently on origin,
destination and diversion. Supported older archives still import and use
date-based resolution. The original stored ID remains authoritative when the
user edits a date, changes languages or updates reference data.

## Localized names and search

Use `localizedAirportName(airportId, locale, date?)` for physical airport
labels in the editor, archive, detail, map, statistics and Passport.
Intentional code and city labels keep their own presentation. Share images
derive their routes and counts from physical sites and use the existing
airport-code consent controls.

[Name records](../packages/core/data/airport-names.json) key display
translations and city labels by airport ID. Each translated airport label
references a provenance class, or a dated Wikidata item, documented in
[the source metadata](../packages/core/data/airport-names.source.json).
Reviewed legacy Chinese wording is inherited. The known OKS and NFO labels
that described different sites were withdrawn, and LYG's Baitabu and
Huaguoshan labels are stored on their respective sites. Traditional Chinese
conversion fills gaps. Official date-effective labels retain their original
language and independent interval in the formal dataset.

The name API chooses an unambiguous dated official name in the requested
language when available. The fallback uses the exact locale, then the base
language and the canonical English reference. Astana's dated Russian names
remain available in Russian and in historical search. The English base serves
en-US and en-GB.
Simplified Chinese, Traditional Chinese, Japanese, Korean, French, German,
Spanish and Brazilian Portuguese have display-name records where sourced.
Coverage varies by locale and site. The fallback leaves the ID intact.

The search index includes IATA, ICAO, every stored name, historical labels
and aliases. It is rebuilt once per installed directory and narrows each query
to indexed candidates. Assignment and name lookups use indexes by code and ID.
The flight editor searches these bundled assets. When you save a flight, Fly
stores the selected site’s permanent ID alongside the recorded code.

Maintain the existing localization records with `pnpm update:airport-locales`.
Add `--wikidata` to acquire missing labels for uniquely matched sites, using the
code and coordinates. The command preserves previously accepted records.
Formal updates add a record for each new ID, reuse labels only through a
physical-site crosswalk, and fall back to the canonical name when a translation
is missing.

## Formal updates

[Update Airport History](../.github/workflows/update-airport-history.yml)
checks the upstream production manifest daily at 02:17 UTC (10:17 in China). [Publication manifest](https://raw.githubusercontent.com/keepraw/airport-history/main/data/production-manifest.json)

To check immediately, run the workflow from the **Actions** tab on `main`.
The equivalent local commands use the verified snapshot.

```sh
python3 scripts/update-airport-history.py --fetch-ourairports /tmp/ourairports.csv
python3 scripts/update-airport-history.py --ourairports /tmp/ourairports.csv --report /tmp/airport-history-update.md
python3 scripts/update-airport-history.py --check --verify-upstream
```

The workflow consumes the manifest and formal dataset for its immutable commit.
It downloads and verifies the OurAirports revision and SHA-256 recorded under
`formalDirectory` in [airports.source.json](../packages/core/data/airports.source.json).
The 0.14.0 cutover retained the verified Fly directory and localization bytes.
Future data versions refresh locality and status using the formal site's
external ID and the pinned OurAirports snapshot.
New, verified locality takes precedence in the directory. Missing fields use
known locality and timezone references when available. Current status remains
unknown when the snapshot provides no status evidence. Local corrections to known status discrepancies are keyed by physical ID
and reference snapshot. Use a separate manual review to assign a new
crosswalk link. Fly also preserves both physical sites for the Palenque,
Mukah, Combolcha, and Barter Island transfers. [Transfer details](audits/airport-crosswalk-0.13.0.md)

A matching publication exits before writing files. A different hash for the
same version, incompatible schema, missing identity or assignment, changed
external identity, material movement or conflicting certain intervals
requires review. Inspect the workflow summary for the diagnostic.

A new Schema 4.0.0 publication updates the pin and reference data, checks the
hash, validates the directory, runs the workspace checks and proposes an
English PR. The PR reports old and new versions and hashes, assignment and interval
changes, resolved code/date coverage, gaps by locale and counts for missing
city, country, status and incomplete metadata on new sites. It also counts
existing sites whose status could not be verified. An existing version PR
receives the refreshed report. The maintainer reviews and merges the PR
through the normal CI gate.

GitHub's repository Actions setting must allow the workflow token to create
pull requests. GitHub may ask a maintainer to approve the PR's CI run for
token-created PRs. The updater validates the candidate before opening the PR.
