# Airport identities, names and formal updates

Fly joins airport data by permanent `airportId`. Flight records keep the
original IATA code and any user-confirmed ID on each endpoint. The historical
resolver uses the endpoint's local civil date to resolve a code assignment.

| Layer                              | Purpose                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| Airport History                    | Physical sites, dated IATA and ICAO assignments, official name intervals and evidence |
| Fly directory                      | Locations, geographical timezones, current lookup codes and locality metadata         |
| Airport display names              | Localized labels and search terms keyed by physical site                              |
| [UI localization](i18n-locales.md) | Interface text and display formatting                                                 |

## Formal data and directory

[The pinned manifest](../packages/core/data/airport-history/formal/manifest.json)
identifies the exact upstream commit, schema, query horizon and SHA-256.
The formal JSON is vendored byte for byte. Version 0.13.0 integrates 6,510
physical sites, 6,370 IATA assignments, 6,214 ICAO assignments, 214 sources
and three name intervals. The supported bulk history starts on 2000-01-01
and runs through 2026-11-18. A few reviewed intervals reach earlier dates,
including Kai Tak.

All 7,885 preexisting Fly rows remain in `airports.iata.json`. The
[formal directory](../packages/core/data/airport-history/formal/directory.json)
supplies locality and status and records physical-site crosswalks under
`legacyIds`. A crosswalk uses site proximity and supporting ICAO, name or
near-identical reference coordinates. The pinned [OurAirports CSV](https://raw.githubusercontent.com/davidmegginson/ourairports-data/d97df1673cc5ba61a09b17ab5936091a669a04ca/airports.csv)
supplies locality and status by external ID. The same-site reference point
from Fly is retained. Distinct sites with a shared code stay independently
searchable. Basel and Mulhouse retain both directory designators and one
physical identity. A site without an IATA assignment can appear by name or
ICAO in search.

Each original ID still resolves through `airportById`. Routes and statistics
group a Fly alias and its upstream ID as the same site. Closed sites and
historical predecessors retain independent IDs and names.

## Flight resolution and archives

Fly checks a stored endpoint ID first, then a unique, reviewed dated
assignment. An unavailable stored ID remains available for later resolution.
A directory reference can supply a point or zone when the formal evidence
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
labels in the editor, archive, detail, map, globe, statistics and Passport.
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
language, source and independent interval in the formal dataset.

The name API chooses an unambiguous verified dated name when available.
For other dates it tries the exact locale, then the base language and the
canonical English reference. The English base serves en-US and en-GB.
Simplified Chinese, Traditional Chinese, Japanese, Korean, French, German,
Spanish and Brazilian Portuguese have display-name records where sourced.
Coverage varies by locale and site. The fallback leaves the ID intact.

The search index includes IATA, ICAO, every stored name, historical labels
and aliases. It is rebuilt once per installed directory and narrows each query
to indexed candidates. Assignment and name lookups use indexes by code and ID.
The packaged assets support normal archive and airport lookup without upstream
requests.

Maintain the existing localization records with `pnpm update:airport-locales`.
Add `--wikidata` to acquire missing labels for uniquely matched sites, using the
code and coordinates. The command preserves previously accepted records.
Formal updates add a record for each new ID, reuse labels only through a
physical-site crosswalk, and fall back to the canonical name when a translation
is missing.

## Formal updates

[Update Airport History](../.github/workflows/update-airport-history.yml)
checks the upstream production manifest daily at 02:17 UTC (10:17 in China).
To check immediately, run the workflow from the **Actions** tab on `main`.
For a local preview use:

```sh
python3 scripts/update-airport-history.py --report /tmp/airport-history-update.md
python3 scripts/update-airport-history.py --check --verify-upstream
```

The workflow consumes the manifest and formal dataset for its immutable commit.
A matching publication exits before writing files. A different hash for the
same version, incompatible schema, missing identity or assignment, changed
external identity, material movement or conflicting certain intervals
requires review. Inspect the workflow summary for the diagnostic.

A new compatible publication updates the pin and reference data, checks the
hash, validates the directory, runs the workspace checks and proposes an
English PR. The PR reports old and new versions and hashes, claim and source
changes, resolved code/date coverage and the gaps by locale. An existing
version PR receives the refreshed report. The maintainer reviews and merges
the PR through the normal CI gate.

GitHub's repository Actions setting must allow the workflow token to create
pull requests. GitHub may ask a maintainer to approve the PR's CI run for
token-created PRs. The updater validates the candidate before opening the PR.
For initial setup, merge the upstream production manifest PR before the
first scheduled check.

## Manual research

The explicit historical lookup button loads a separate, pinned research client.
It fetches the IATA index and the shards needed for the requested code and
verifies their SHA-256 digests. Research rows can be selected only when an
external OurAirports ID links to a formal physical site. Research lookup
failures leave normal airport resolution and saved flights available.
