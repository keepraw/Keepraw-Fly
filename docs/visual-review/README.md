# Legacy evidence paths

This directory mixes machine-readable regression inputs, approved design references
and generated capture evidence. These roles do not make the files current product
specifications. See [current documentation](../README.md) and the
[decision archive](../archive/README.md) for maintained guidance and design rationale.

## Regression inputs and path debt

| Path under `docs/visual-review/`          | Current consumer                                                                                                                | Follow-up destination or action                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `task-1b-5/texture-audit.json`            | `apps/web/src/globe/globe-night-response.test.ts` reads histograms/hashes; `scripts/audit-globe-night.mjs` overwrites this file | Shared `tests/fixtures/globe/` input; generator output should go to ignored artifacts and be promoted deliberately       |
| `task-1b-5/display-pixels.json`           | `e2e/globe-night-response.pw.ts` reads historical measured pixels                                                               | Shared `tests/fixtures/globe/` input                                                                                     |
| `task-1b-6/display-diagnostics.json`      | `e2e/globe-night-style.pw.ts` reads historical measurements                                                                     | Shared `tests/fixtures/globe/` input                                                                                     |
| `task-1b-7b2/comp-control-fixed-dark.png` | `scripts/capture-task-2c.mjs` reads the approved image                                                                          | Move the coherent six-image/manifest reference set with the capture-tool update; preserve hashes and approval provenance |
| `task-2c/resume/`                         | Default output of `scripts/capture-task-2c.mjs`; tests refer to the capture method, not these stored JSON results               | Use ignored `artifacts/` output by default; review stored request/font provenance separately before pruning              |

No build process imports these legacy assets. The current PR leaves input bytes,
consumer paths, assertions, browser selection and CI unchanged. Moving the shared
JSON/reference set requires coordinating unit tests, E2E and generators, so the
relocation is tracked as follow-up technical debt rather than mixed into this
cleanup. Verify unit tests and the complete browser matrix when doing that work.
Do not add new fixtures or capture output to these legacy documentation paths.

## Human references and capture helpers

The [approved Control record](task-1b-7b2/README.md) documents the immutable design
reference; its historical dimensions and test counts do not define current page
geometry. The [transfer-curve diagram](task-1b-5/transfer-curves.svg) supports the
[archived diagnosis](../archive/visual-review/task-1b-5/diagnosis.md) and is a human
explanation, not a consumed test fixture.

The [Task 2C provenance](task-2c/resume/README.md) and
[Task A reconstruction helper](task-a/capture.md) retain historical context.
The Task A helper is outside routine CI and needs its recorded source checkout;
its relocation into `scripts/` can accompany the tooling boundary follow-up.
The [Detail capture helper](../reviews/task-b8/capture.md) is separate from the
removed B.8 screenshots; write fresh captures into ignored `artifacts/`.
