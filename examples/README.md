# Import examples

These small, synthetic samples demonstrate supported imports. They are maintained
user examples and are deliberately shared by automated import journeys instead of
duplicated into a second fixture directory. They are not personal exports or the
in-app demo. Names, bookings, tickets and itineraries are fictional; real airport
and airline identifiers make validation meaningful.

| File                                             | Format and version                                                    | Purpose                                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [basic.keepraw-fly.json](basic.keepraw-fly.json) | Keepraw Fly `formatVersion: 0.1.0`                                    | One SFO–LAX flight, a fictional bilingual profile and an aircraft extension; JSON backup/import contract           |
| [flights.csv](flights.csv)                       | Keepraw Fly mapped CSV; no embedded version field                     | One PVG–SFO row with local times and optional travel facts; column mapping and timezone resolution                 |
| [flighty.csv](flighty.csv)                       | Supported Flighty native-header CSV subset; no embedded version field | Four synthetic rows covering ICAO airlines, overnight arrival, diversion, cabin values and an ignored extra column |

See [schema and CSV columns](../docs/schema.md) for the authoritative contract.
CSV compatibility follows the current importer, independently of the application
release number; this is not a claim to support every Flighty export version.

## Import

Download a file using GitHub's **Raw / Download raw file** action. Open Keepraw Fly
and choose the corresponding JSON, CSV or Flighty import action on the welcome
screen or in Settings. For mapped CSV, review the detected column mapping. Inspect
the preview and confirm only after validation passes. Use a disposable browser
profile for experimentation: imports into an existing archive append selected
flights, skip exact duplicates and preserve its profile. JSON imported without an
active archive supplies the example profile. JSON is the backup format; CSV is an
import format.

## Maintenance and shared test use

`e2e/keepraw-fly.pw.ts` exercises JSON and mapped CSV; `e2e/unified-page-theme.pw.ts`
exercises all three formats. Other layout, persistence, recovery and locale journeys
derive records from the JSON sample; `scripts/audit-css-runtime.mjs` shares JSON/CSV.
Keep IDs, routes, dates and supported edge cases stable unless consumers are updated
and rerun. The preview assertion checks the fictional native name explicitly.

Special regression inputs stay in `e2e/fixtures/` and `tests/fixtures/`. The in-app
demo lives in `packages/core/data/demo.keepraw-fly.json`; temporary exports and generated evidence
belong in ignored `artifacts/`. Do not copy real passenger details into these files.
