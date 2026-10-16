# Retained visual evidence

This directory retains approved design references, historical capture evidence
and reconstruction helpers. These records are not current product specifications.
See [current documentation](../README.md) and the
[decision archive](../archive/README.md) for maintained guidance and design rationale.

## Formal regression inputs

The three historical measurement JSONs consumed by unit tests and E2E now live in
[tests/fixtures/globe/](../../tests/fixtures/globe/README.md). They were moved
without changing their bytes or test assertions. The fixture note records original
paths, consumers and the deliberate review process for any future replacement.
No generator writes there by default.

## Human references and historical evidence

- The [approved Control record](task-1b-7b2/README.md), all six PNGs and their
  canonical manifest remain together, unchanged. The Task 2C capture reads and
  checks the approved Dark Control hash; it does not write to this reference set.
  Historical dimensions and test counts do not define current page geometry.
- The [transfer-curve diagram](task-1b-5/transfer-curves.svg) supports the
  [archived diagnosis](../archive/visual-review/task-1b-5/diagnosis.md). It is a human
  explanation, not a consumed test fixture.
- The [Task 2C provenance](task-2c/resume/README.md) retains original CDN/font
  requests, hashes, native zoom and long-city evidence. These stored results are
  historical records, not outputs to refresh during normal capture runs.
- The [Task A reconstruction helper](task-a/capture.md) remains at its historical
  path alongside its instructions. It is outside routine CI and needs the recorded
  source checkout; its [source bundle and provenance](../archive/visual-review/task-a/README.md)
  remain available.
- The [Detail capture helper](../reviews/task-b8/capture.md) remains separate from
  the superseded B.8 screenshots linked in Git history.

Source metadata, third-party assets and [license notices](../../THIRD_PARTY_NOTICES.md)
remain unchanged. No build process imports these retained evidence files.

## Fresh measurements and captures

Run helpers from the repository root with their documented browser/server
prerequisites. Default output stays under Git-ignored `artifacts/`:

| Helper                                                | Default output                                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------- |
| `scripts/audit-globe-night.mjs`                       | `artifacts/globe-night-audit/texture-audit.json`                  |
| `scripts/capture-task-2c.mjs`                         | `artifacts/task-2c/` (browser profiles also stay in `artifacts/`) |
| `docs/reviews/task-b8/capture.mjs`                    | `artifacts/detail-visual-review/`                                 |
| `docs/visual-review/task-a/capture.mjs before\|after` | `artifacts/task-a/before/` or `artifacts/task-a/after/`           |

The texture audit still reads the original NASA source from
`artifacts/task-1b-5/BlackMarble_2016_3km_gray.jpg` and verifies source/derived
texture hashes against `apps/web/src/globe/globe-night-texture.source.json`.
It requires the same Chrome setup and Node TypeScript support as before.

Existing explicit output arguments/environment variables remain available for
separate capture runs. Choose ignored paths for those overrides, including Task A's
optional computed-style output. Do not point them at committed evidence, fixtures
or approved references. Fresh output is a candidate for review; generating it does
not approve or replace a regression input or visual baseline.
