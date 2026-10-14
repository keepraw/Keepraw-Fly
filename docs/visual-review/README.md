# Retained evidence and capture tools

These paths contain historical evidence supporting active tests or capture tools.
They remain at their original locations to preserve those consumers. Start with
[current documentation](../README.md) and [Globe implementation](../globe.md) for
architecture; completed reviews and obsolete experiments are in the
[archive](../archive/README.md).

| Retained group                                                      | Role and current consumer                                                                                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Task 1B-5 texture audit](task-1b-5/texture-audit.json)             | Historical histograms and texture hashes read by `apps/web/src/globe/globe-night-response.test.ts`; `scripts/audit-globe-night.mjs` also targets this directory |
| [Task 1B-5 display pixels](task-1b-5/display-pixels.json)           | Historical measurements read by `e2e/globe-night-response.pw.ts`                                                                                                |
| [Task 1B-5 transfer curves](task-1b-5/transfer-curves.svg)          | Companion to the [archived diagnosis](../archive/visual-review/task-1b-5/diagnosis.md), kept with the linked numerical evidence                                 |
| [Task 1B-6 display diagnostics](task-1b-6/display-diagnostics.json) | Historical measurements read by `e2e/globe-night-style.pw.ts`                                                                                                   |
| [Approved Control](task-1b-7b2/README.md)                           | Six immutable PNGs and their manifest; `scripts/capture-task-2c.mjs` reads the approved Dark Control directly                                                   |
| [Task 2C font/long-city evidence](task-2c/resume/README.md)         | Historical request/hash/geometry provenance kept together; `scripts/capture-task-2c.mjs` retains this directory as its default output                           |
| [Task A capture helper](task-a/capture.md)                          | Unchanged historical reconstruction script; review and source bundle moved to the archive                                                                       |

Historical geometry, test counts and capture approvals are not current page
baselines. The Control design reference remains unchanged; use current tests and
fresh captures for present-day layout assertions. Reports at commit-pinned GitHub
links keep their original paths.

Do not move these data or replace them with newly generated output in a
documentation-only PR. Before a future relocation, account for all source/test
consumers and treat any test or script changes as a separate scope.
