# Documentation archive

These records preserve why earlier decisions were made. Their code descriptions,
line numbers, measurements, test counts, approval status and deployment statements
belong to the recorded checkpoints. Use [active documentation](../README.md) for
current implementation and operations. Follow-ups are not closed by archiving.

这些记录保留历史决策依据；内容只对应报告记录的版本。当前实现与操作方式见
[长期维护文档](../README.md)。归档不代表未完成事项已经解决。

## Historical / Archive Documentation — completed records

| Record                                                              | Original path under `docs/`            | Why retained                                                                                               |
| ------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [CSS audit](audits/css-audit.md)                                    | `css-audit.md`                         | PR #9/#10 deletion evidence, token fixes and cascade pitfalls; candidates need a fresh audit before action |
| [i18n release audit](audits/i18n-audit.md)                          | `i18n-audit.md`                        | PR #58 defect/acceptance evidence, cache limits and detailed native-review checklist                       |
| [Task 5A palette review](reviews/task-5a.md)                        | `reviews/task-5a.md`                   | Historical mobile palette verification and unresolved-at-the-time CI/approval status                       |
| [Task 5B city-label audit](reviews/task-5b-city-label-audit.md)     | `reviews/task-5b-city-label-audit.md`  | Display-label rationale and recorded source-data anomalies; recheck before correcting data                 |
| [Task B.8 Detail sky references](reviews/task-b8/README.md)         | `reviews/task-b8/README.md`            | Two retained Light/Dark screenshots from before the later Hero viewport fix                                |
| [Task A shared-theme review](visual-review/task-a/README.md)        | `visual-review/task-a/README.md`       | Commit-pinned comparisons and original `capture-source.bundle` for reconstruction                          |
| [Task 1B-5 texture diagnosis](visual-review/task-1b-5/diagnosis.md) | `visual-review/task-1b-5/diagnosis.md` | Pre-change response analysis; links to retained numerical test inputs                                      |

The B.8 screenshots moved with their report to `reviews/task-b8/screenshots/`.
The Task A bundle moved with its report to `visual-review/task-a/`. Reports and
their assets were not merged or deleted. Historical external links remain pinned
to the original Git revisions and paths.

## Obsolete Documentation — archived design history

These four reports are obsolete **as current implementation guidance**: they
describe a DEV-only prototype, earlier material/camera candidates and pending
approval before production integration. Their technical experiments retain
historical value, so all four are preserved separately in `globe/`.

| Record                                                  | Original path under `docs/`   | Distinct historical scope                                           |
| ------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| [Initial prototype](globe/globe-prototype.md)           | `globe-prototype.md`          | Technology choice, first camera and initial performance constraints |
| [Task 1B-1 lighting](globe/globe-cinematic-lighting.md) | `globe-cinematic-lighting.md` | First world-space solar/night/atmosphere experiment                 |
| [Task 1B-2 scene](globe/globe-cinematic-scene.md)       | `globe-cinematic-scene.md`    | Revised composition, route grouping and framing measurements        |
| [Task 1B-3 art direction](globe/globe-art-direction.md) | `globe-art-direction.md`      | A/B material comparison preceding the approved Control              |

Their chronology and measurements differ; merging them would blur which
implementation was actually reviewed. For current behavior use
[Globe implementation](../globe.md); for the approved design reference use the
[Control record](../visual-review/task-1b-7b2/README.md).

## Evidence retained at original paths

Historical evidence used by active tests or capture tools stays in
[`docs/visual-review/`](../visual-review/README.md). The linked index lists each
group and its consumers. Capture scripts also keep their original paths:

- [Detail capture helper](../reviews/task-b8/capture.md), whose script resolves
  repository fixtures relative to its own location.
- [Task A capture helper](../visual-review/task-a/capture.md), whose unchanged
  output default names the original task directory.

New captures should use ignored `artifacts/` output, not overwrite frozen evidence.
The dated [license review](../license-review-2026-10-10.md) remains active because
font and airline-logo permission questions still need decisions. Maintained
[locale notes](../i18n-locales.md#related-evidence-and-open-follow-ups) keep the
i18n native-review, cache and reference-data follow-ups discoverable.

## Adding an archive record

Preserve the original date, source revision, measurements and approval wording.
Add an archive-status note and link to the maintained subject. Move associated
assets together unless an active consumer requires their paths; repair local
links and update this index. Use Git moves so reviewers can follow file history.
The existing `pnpm check:docs` scans this archive recursively; it has no archive
exemption. No documentation checker, test or CI rule changed for this cleanup.
