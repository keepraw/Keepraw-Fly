# Persist physical airport identities and isolate historical research

This document records the original implementation in PR #118. The manual
research lookup described here has since been retired. [PR #118](https://github.com/keepraw/Keepraw-Fly/pull/118) · [Current airport history guide](airport-history.md)

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

Validation runs in GitHub Actions; dependencies and application validation were
not run locally. Remote Prettier, type checks and workspace unit tests have
passed. The complete push and PR CI runs remain the merge gates.

The [CI investigation](pr118-ci-investigation.md) documents the reference-point
regression and remote before/after artifacts. Canonical entity coordinates
restore every fixture flight's original distance (571473.8186966669 km total)
and all six night-scene PNGs exactly, with no visual baseline or accuracy
assertion changes. New archive tests expect 0.2.0 while legacy 0.1.0 imports
preserve all facts and acquire no artificial airport confirmations.

The reviewed allocation dataset is unchanged and is not worldwide historical
coverage. Directory entries without reviewed allocations may still require
manual confirmation or separately reviewed admission of a missing entity.
