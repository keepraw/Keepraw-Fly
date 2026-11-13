# Persist physical airport identities and isolate historical research

Selecting a historical airport previously saved only its IATA code, allowing
later date edits or reference updates to replace the chosen physical airport.
This change stores an optional permanent airport ID independently on origin,
destination and diversion while preserving each recorded IATA code.

The runtime resolves saved IDs first, then reviewed code assignments, then
uncontested current directory entries. Unknown saved IDs remain in the archive
and unresolved. Routes, statistics, timezones, distances and share images use
physical identities. Closed sites remain available for manual selection.

Worldwide research stays upstream. Explicit manual lookup loads only the
pinned IATA index and required record shards, verifies SHA-256, caches bounded
results and isolates network failure from normal resolution. Copied candidate
and transition datasets and automatic research subscriptions are removed.

Archive version 0.2.0 adds endpoint IDs while retaining imports of supported
older backups. The former strict endpoint schema rejects the new fields;
forward compatibility with old readers is not claimed. The CSP-safe validator
is generated from the current schema during dependency installation.

Regression cases cover independent endpoints, save/reload/export, date edits,
unknown IDs, physical aggregation, historical boundaries, selective research
loading and lookup failures. Compatibility cases compare precompiled and
runtime validation and exercise the former strict endpoint schema.

Validation status: not run locally, as requested. Dependencies were not
downloaded locally. Remote CI, including formatting, type checks, tests, build
and browser coverage, is required before merge. Formatting cleanup remains
outstanding; this change is a draft until remote checks pass. GitHub CLI
authentication was unavailable during preparation.

The reviewed allocation dataset is unchanged and is not worldwide historical
coverage. Directory entries without reviewed allocations may still require
manual confirmation or separately reviewed admission of a missing entity.
