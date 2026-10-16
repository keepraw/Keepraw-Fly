# Globe regression inputs

These committed historical measurements are shared by unit tests and browser E2E.
They are formal test inputs, not scratch output or measurements to regenerate on
every run. All three files were moved byte-for-byte from the following paths at
[`3d6495f`](https://github.com/keepraw/Keepraw-Fly/tree/3d6495f93cc840a16395549ac20e1a37dce53fce/docs/visual-review):

| File                       | Original path under `docs/visual-review/` | Consumer                                                                                                      |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `texture-audit.json`       | `task-1b-5/texture-audit.json`            | `apps/web/src/globe/globe-night-response.test.ts` checks source texture hashes, histograms and tonal response |
| `display-pixels.json`      | `task-1b-5/display-pixels.json`           | `e2e/globe-night-response.pw.ts` uses the historical Dark pixel counts and region definitions                 |
| `display-diagnostics.json` | `task-1b-6/display-diagnostics.json`      | `e2e/globe-night-style.pw.ts` compares emission against the historical B5 measurements                        |

The [night-texture diagnosis](../../../docs/archive/visual-review/task-1b-5/diagnosis.md)
explains the source measurements. Texture source metadata and licensing remain in
[`globe-night-texture.source.json`](../../../apps/web/src/globe/globe-night-texture.source.json)
and [third-party notices](../../../THIRD_PARTY_NOTICES.md). The six approved PNG
references and their original approval/scene manifest remain together in
[`docs/visual-review/task-1b-7b2/`](../../../docs/visual-review/task-1b-7b2/README.md).

`scripts/audit-globe-night.mjs` writes fresh candidates to
`artifacts/globe-night-audit/texture-audit.json`, never here. Replacing a fixture
requires a deliberate reviewed change: retain source provenance, compare the
candidate with the existing measurements, explain the baseline change and run
the consuming tests through CI. Do not copy new measurements over these inputs
as part of a routine capture. See the [evidence inventory](../../../docs/visual-review/README.md)
for retained history and each helper's ignored output directory.
