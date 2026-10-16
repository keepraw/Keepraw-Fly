# Documentation

## Current documentation

Start with [architecture](architecture.md) for package, storage and import
boundaries. Its [schema](schema.md) and [Globe](globe.md) guides cover portable
facts and the production renderer. Use [deployment](deployment.md) to run an
instance and [testing](testing.md) to verify changes against current CI gates.

UI conventions live in the [visual system](design-system.md) and
[locale notes](i18n-locales.md). Read the [third-party notices](../THIRD_PARTY_NOTICES.md)
before distribution; they link to the unresolved permission review.

## Historical archive

The [archive](archive/README.md) holds selected design rationale and otherwise
unrecoverable source provenance. Routine completion reports, temporary audits and
obsolete validation results belong in pull requests and Git history.

[Legacy evidence paths](visual-review/README.md) retain approved visual references,
historical evidence and capture helpers. Formal Globe regression inputs live in
[test fixtures](../tests/fixtures/globe/README.md); fresh captures belong in ignored
`artifacts/`. Historical evidence does not define current product behavior.

## Contribution guidance

- Update current guidance with the implementation it describes. Link a new detail
  document from its owning topic; this reading guide is not a file inventory and
  only changes when a primary topic or entry point changes.
- Archive only a lasting decision, rejected alternative or source provenance that
  future maintainers need. Explain its value and pin the original revision. A
  completed task alone is not a reason to archive its report.
- Move unresolved questions into the maintained topic before removing a report.
  Use Git history for superseded instructions and one-time validation results.
- Keep machine-readable test fixtures with tests and generated captures in ignored
  `artifacts/`. Check consumers before relocating existing legacy paths.
- Run `pnpm check:docs` and formatting checks after changing documentation. The
  existing documentation checker also checks archived Markdown links.
