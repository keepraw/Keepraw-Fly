# Historical archive

These are selected decisions, approved references, compliance assessments and
otherwise unrecoverable source provenance. Current guidance starts at
[the documentation index](../README.md). Historical measurements, experiment
parameters and approval statements apply only to their recorded revisions.

## Design rationale

| Record                                                          | Status and retention reason                                                                                                                                    |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Globe technology selection](globe/globe-prototype.md)          | Decision still applicable: why Three.js was chosen; prototype acceptance and timings are superseded                                                            |
| [Globe composition and routes](globe/globe-cinematic-scene.md)  | Rationale still applicable: geographic composition and physical strokes remain separate from directed flight facts; exact historical parameters are superseded |
| [Globe material alternatives](globe/globe-art-direction.md)     | Superseded experiment: rejected brighter treatments explain the retained route-first visual hierarchy                                                          |
| [Night-texture diagnosis](visual-review/task-1b-5/diagnosis.md) | Rationale still applicable to formal noise-floor and bounded-peak regression inputs; the transfer diagram describes historical curves                          |

## Approved references and provenance

- [Approved Globe Control](visual-review/task-1b-7b2/README.md): retain six
  byte-identical PNGs and their canonical manifest. They cover the approved Dark
  treatment, Light counterpart, Passport allocation, long-haul selection and two
  post-specular regressions. The Dark Control hash is an input to the maintained
  font-capture helper. They are deliberate reference inputs, not disposable
  screenshots or a second specification for current page geometry.
- [Task 2C font provenance](visual-review/task-2c/resume/README.md): retain the
  original CDN/font hashes, rendered faces, native zoom and long-city records.
  They support font-source and licensing review; historical screenshot names in
  those records are not promises that every image remains in the checkout.
- [Task A source provenance](visual-review/task-a/README.md): retain its small
  source bundle because the capture revision is unavailable through GitHub and
  equivalence to a recoverable published tree has not been established.
- [Dependency security review, 2026-10-16](dependency-security-2026-10-16.md):
  preserve the dated exposure analysis referenced by release notes. Dependency
  counts and runner-upgrade recommendations are superseded; current follow-up is
  in [security](../security.md#known-dependency-advisory).

Formal machine-readable Globe inputs remain in
[tests/fixtures/globe](../../tests/fixtures/globe/README.md). Capture tools live in
`scripts/` and default to ignored `artifacts/`; see [testing](../testing.md).

## Retention

[Engineering standards](../engineering-standards.md#documentation-and-evidence)
own retention rules. Completed reports, superseded galleries and temporary JSON
are recoverable from Git history. Archive admission requires lasting rationale,
compliance value or source provenance, not merely a completed PR.
