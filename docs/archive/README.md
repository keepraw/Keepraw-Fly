# Historical archive

This archive preserves selected decisions and source provenance. It is not a
store for completed tasks or routine audit output. Use [current documentation](../README.md)
for implementation and operations; historical defaults, measurements and approval
statements apply only to their recorded revisions.

## Design rationale

| Record                                                          | Lasting value                                                                                                                                      |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Globe technology selection](globe/globe-prototype.md)          | Why Three.js was chosen over a projected SVG/Canvas globe or Globe.gl, including control and dependency tradeoffs                                  |
| [Globe composition and routes](globe/globe-cinematic-scene.md)  | Why representative activity, aspect-aware framing and shared physical strokes preserve geographic and directed-flight semantics                    |
| [Globe material alternatives](globe/globe-art-direction.md)     | The rejected brighter treatment and A/B tradeoffs explain why route hierarchy leads the visual design; later approved Control remains the baseline |
| [Night-texture diagnosis](visual-review/task-1b-5/diagnosis.md) | Measured evidence explains low-signal recovery, the retained noise floor and bounded peaks in the current night-response tests                     |

These records describe distinct decisions rather than parallel specifications.
The earlier lighting implementation report, CSS/i18n acceptance audits, Task 5A/5B
completion reports and superseded Detail captures are available in Git history.
Their remaining lessons and open questions now belong to the current visual,
Globe and locale guides.

## Source provenance exception

[Task A provenance](visual-review/task-a/README.md) retains a small reconstruction
note and its source bundle. The bundled capture revision is not retrievable from
the GitHub repository and equivalence to published trees has not been established.
Its future value is uncertain, so the bundle is preserved until that mapping is
verified. The full task report and gallery remain in Git history.

## Retention policy

Keep a record only when it explains a lasting choice or rejected alternative, or
preserves source provenance that is not otherwise recoverable. Link it from the
owning topic, identify the recorded revision and explain why Git history alone is
insufficient. Do not add pass/fail logs, routine screenshots, completion reports
or temporary investigations simply because a task finished.

Before deleting an old report, carry unresolved actions into current guidance.
Reassess a retained record when its owning design is superseded; remove it if its
useful rationale is already covered by maintained guidance and Git history.
Machine-readable fixtures belong with tests. The [legacy evidence inventory](../visual-review/README.md)
records existing path debt without making it an archive admission rule.
