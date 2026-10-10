# Task 3 validation record

Local Windows desktop verification on 2026-10-10 (Asia/Shanghai). Starting remote head: `3e0b85590dc6625b67c0e8bf56e857bec9883b2b`. Working branch: `codex/desktop-passport-task-3-globe-integration`.

## Static checks and build

- Documentation consistency, Prettier, Stylelint and CSS token references: passed. CSS token audit: 14 stylesheets, 1,243 references, zero unresolved tokens.
- TypeScript workspace check: passed.
- Unit tests: 333 passed (3 CSS analysis tests, 68 core, 31 validator, 231 web). Schema has no unit test files.
- Production build: passed. Desktop Globe remains in a lazy chunk; initial Mobile does not mount it. The build reports the existing large-chunk warning. The Globe JS chunk is approximately 622 kB / 161 kB gzip, plus local day/night imagery and the interactive SVG fallback dependency. No external map service is used.
- Production preview smoke on the built output: passed. A fresh 1440×900 archive import loads the real WebGL scene and its three Globe assets; a fresh 390×844 Mobile import requests zero Globe assets and retains the Mobile summary. Neither session reports a page error. Local diagnostics: `artifacts/task-3-production-smoke.json`.
- Local tools: Node 24.19.0, desktop runtime pnpm 11.25.0, Playwright 1.63.0. The frozen repository lockfile is unchanged. CI independently uses the repository's pnpm 10.14.0 and Node 24.

## Actual browser tests

No test retry setting, timeout or approved hash was changed. The final current-suite runs covered every case:

| Engine   | Full run                                                                                                                                               | Serial diagnostic rerun                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Chromium | 134 cases: 133 passed, one 30-second navigation timeout while running concurrently with the other engines                                              | The identical navigation case passed in 13.8 seconds with no competing browser run |
| Firefox  | All 38 tagged cases passed                                                                                                                             | None needed                                                                        |
| WebKit   | 38 cases: 35 passed; texture-fallback readiness, formal pointer/accessibility and responsive-boundary checks exceeded deadlines during concurrent runs | All three identical cases passed in one serial run (25 seconds total)              |

The six formal Passport journeys passed in Chromium; the five tagged ones also passed in Firefox and WebKit. Earlier development failures were a deliberately caught invalid test fixture and two outdated SVG-only/selection-scope expectations, corrected before the final runs. Diagnostics are retained locally under `artifacts/task-3-final-chromium-results`, `artifacts/task-3-cross-browser-results`, `artifacts/task-3-isolated-navigation-results` and `artifacts/task-3-isolated-webkit-results`. This record distinguishes a clean full-run result from a passed serial recheck.

The Chromium runner executes the complete suite, including the six new formal Passport journeys. Firefox and WebKit run the repository's tagged compatibility journeys. Existing SVG-specific tests intentionally disable WebGL2 using [the fallback helper](../../../e2e/helpers/passport-svg.ts); formal 3D tests independently verify WebGL capability and require successful texture/shader initialization on capable engines.

Task 3 exercises actual flight imports, repeated and reverse routes, diverted arrival airports, period/search scope, empty searches, newest matching Archive row focus, stable canvas identity across selection, native pointer selection on the projected arc, airport clicks, arrow/Home controls, Dark/Light accessibility, disabled WebGL2, aborted texture loading, real context loss and explicit retry. GPU deletion instrumentation checks that textures/buffers/programs are released; retired metrics prove RAF stops after disposal. Settings/page navigation and the 760px Mobile transition also remove the canvas.

Existing Lab visual, scene/camera, night, fixed/realtime solar and SVG regression assertions are retained. The old formal-SVG isolation expectation was updated to assert the authorized formal Globe integration. Broader-search tests explicitly close a map exploration first because Task 3 map selections now filter the Archive. Their original counts and focus assertions remain intact.

## Screenshots and frozen material

- [63 formal Passport images](SCREENSHOTS.md): all five required physical viewports, three languages, two themes, native 100%/125%, and long-city records. 57 Desktop WebGL images and six existing Mobile images.
- [Browser evidence](browser-evidence.json): route data, projected labels, exact renderer host dimensions, DPR/effective viewport, complete KPI/Highlights text, independent Archive scrolling, right scroll height, bottom margin and SHA-256 for each capture. All measured Desktop cases fit; minimum bottom safety is approximately 24 CSS pixels, and map height ranges from approximately 200 to 537 CSS pixels.
- [Frozen material evidence](frozen-evidence.json): 17 renderer/math/light/solar/night/texture/Lab CSS/Control files match approved base `2b9378d` byte-for-byte. Approved Dark Control SHA-256 remains `c17d906dc74bd44d91e80f247bc784f6d41e6a19e083778dc2a54d07e8bf24d5`.
- Native zoom uses Chromium profile `partition.default_zoom_level`; DPR and effective CSS viewport are asserted. Physical 761px at 125% is Mobile. Images use real font loads and actual validated archive imports on `/#passport`, not Globe Lab.

## Remote CI and acceptance

The [initial CI run](https://github.com/keepraw/Keepraw-Fly/actions/runs/38052748612) failed Prettier in `PassportPage.tsx`. Formatting was fixed locally.

[Implementation CI run 38055009877](https://github.com/keepraw/Keepraw-Fly/actions/runs/38055009877) completed successfully on `7578541730a33bcc8a7f8e19fe5e42f9068fd045`:

- Verify: documentation, Prettier, CSS/token checks, TypeScript, 333 unit tests, all 134 Chromium journeys (10.2 minutes, no flaky/retried cases), and production build passed.
- Firefox: all 38 compatibility journeys passed. The runner's independently probed WebGL2 capability was unavailable; Globe journeys used the functional SVG path, and GPU-only steps did not execute there.
- WebKit: all 38 compatibility journeys passed, including the formal 3D pointer, texture failure, context loss and retry paths.
- Deployment: skipped by the workflow's branch/event condition. No site was published.

The [documentation delivery CI](https://github.com/keepraw/Keepraw-Fly/actions/runs/38055833596) on `6ed2f7b` concluded success, but Chromium reported **133 passed and one flaky** native-100%-zoom test, which passed on the workflow's existing retry #1. Its first attempt reported `text::BOM` in the Longest Flight text measurement. Firefox/WebKit each passed 38 without retries; static, unit and build checks passed. This is not described as a clean Chromium run.

An unchanged local diagnostic then failed while measuring a missing map node before the lazy Globe was mounted. The native-zoom journey now awaits independently verified Globe capability/readiness, settled fonts and finite animations before making the same geometry assertions. No clipping assertion, approved hash, layout, test timeout or retry setting changed. Both native 100% and 125% journeys then passed without retries in 11.7 seconds (`artifacts/task-3-native-zoom-readiness-results`). This synchronizes the browser measurement with the rendered page; it does not establish a confirmed cause for the remote `BOM` transient.

The final test-readiness delivery commit has its own status on [PR #35 checks](https://github.com/keepraw/Keepraw-Fly/pull/35/checks). The implementation run above refers to the exact code commit; it is not presented as a run for a newer delivery commit. Product code and all 63 screenshots remain unchanged after `7578541`.

Remaining: Owner's final visual acceptance. Review the approved cropped composition and collision-suppressed labels in narrow/125% cells; the picker exposes every airport and both route directions. PR #35 stays Draft. No PR merge or site deployment has been performed.
