# Documentation

## Maintained entry points

| Topic                                                                      | Authoritative entry                                                                |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Contribution rules, directory ownership, commit identity and quality gates | [Engineering standards](engineering-standards.md)                                  |
| UI layout, typography, themes, tokens, components and interaction          | [Design system](design-system.md)                                                  |
| Packages, storage, imports, statistics and localization boundaries         | [Architecture](architecture.md)                                                    |
| Portable archive and supported CSV formats                                 | [Schema](schema.md), with [user examples](../examples/README.md)                   |
| Production Globe rendering and lifecycle                                   | [Globe](globe.md)                                                                  |
| Flight Passport image, TD3 specimen policy and migration rationale         | [Flight Passport journal](flight-passport-journal.md)                              |
| Language resources and open translation questions                          | [Locale notes](i18n-locales.md)                                                    |
| Browser layers, fixtures, captures and CI                                  | [Testing](testing.md)                                                              |
| CSP, privacy, dependency exposure and release provenance                   | [Security](security.md)                                                            |
| Installation, hosting, upgrades and publishing                             | [Deployment — English](deployment.md) / [部署指南 — 简体中文](deployment.zh-CN.md) |
| Current scope limits                                                       | [Product boundaries](not-implemented.md)                                           |

Executable configurations and source code are linked from their owning guides;
do not maintain parallel copies of their values in task reports.

## Release, legal and historical records

- [v0.1.1 release notes](releases/v0.1.1.md) and [v0.1.0 release notes](releases/v0.1.0.md)
  describe their published versions.
- [Third-party notices](../THIRD_PARTY_NOTICES.md), [license](../LICENSE),
  [trademark](../TRADEMARK.md) and [permission review](license-review-2026-10-10.md)
  retain distribution requirements and unresolved owner decisions.
- [Historical archive](archive/README.md) contains selected decisions, approved
  Globe references and source provenance with explicit status. Historical geometry,
  experimental parameters and test counts do not override current guidance.

Routine task reports and obsolete captures are available through Git history.
New generated evidence belongs in ignored `artifacts/`; formal regression inputs
remain with tests. Follow the retention and review rules in the engineering standards.
