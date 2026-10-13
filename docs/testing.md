# Browser test layers

Chromium owns the full regression suite. The Firefox and WebKit projects select
only tests explicitly tagged `@cross-browser` in [Playwright configuration](../playwright.config.ts).
An untagged new E2E runs in Chromium automatically. The browser-layer split retains
the full regression coverage in Chromium, while the 3D Globe and engine-sensitive
behaviors have their own targeted tests.

```bash
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e --project=chromium --workers=1
pnpm test:e2e --project=firefox --workers=1
pnpm test:e2e --project=webkit --workers=1
pnpm test:e2e --list
```

`pnpm test:e2e` runs all three projects with their respective layers. CI runs
static checks and the production build in `checks`, six Chromium shards
in `chromium`, and the existing Firefox/WebKit matrix in `cross-browser`. Both
matrices keep `fail-fast: false`. Browser jobs use `--workers=1`; retries and
`fullyParallel: false` remain unchanged. Each Chromium shard uses
`--shard=N/6` for N from 1 to 6; their disjoint union must include every Chromium
test. This retains the full Hero geometry, layout and pixel assertions without
reinstating the removed success-only design-review screenshot collection; the
Chromium jobs retain their 20-minute timeout.

The existing check name `verify` is an aggregate gate with `always()`: every
static, Chromium and cross-browser dependency must succeed, including all six
Chromium shards and both compatibility engines. A failed, cancelled or skipped
dependency fails the gate. On a push to `main` only, the `deploy` job waits
for a successful `verify` and publishes the build artifact uploaded by `checks`
in that same run. PR CI does not upload a Pages artifact or deploy. The
independent Pages workflow has been removed.

Every browser job uploads HTML/JSON reports and failure screenshots/retained traces,
including on failure. Chromium diagnostics are named `playwright-chromium-shard-N`
for N from 1 to 6; Firefox and WebKit each have separate diagnostic artifacts.
Playwright captures screenshots only on failure and retains traces on failure;
success-only manual review screenshots and duplicate success attachments are no
longer generated in routine CI. `scripts/report-playwright.mjs` adds counts,
per-file test durations (including retries) and failure diagnostics to the job
summary and a check annotation. It fails on skipped/unexpected tests, global
errors or an empty report. Browser installation remains `install --with-deps`;
no browser cache or new dependency was introduced.

## Flight Detail 3D Globe

`detail-map-curve.pw.ts` contains regression tests requiring a real, ready
WebGL canvas. Unavailable WebGL fails those tests; there is no capability skip or
SVG substitute. They cover single-route framing and Home at 761/1024/1440px,
resize after interaction, pointer/wheel/keyboard controls, diversion, cancellation,
unknown airports, three languages, Light/Dark/System, Fixed/Realtime solar,
760/761px lazy loading, all renderer failures and retry, StrictMode, hidden tabs,
navigation and delayed texture cleanup. Mounted preference and language changes
must preserve the canvas and user's camera.
Changing the route of the same flight clears selected and hovered airports before
the replacement scene focuses the new route. Unit tests additionally sample the
entire arc for short, long, date-line, polar, antipodal and coincident routes,
and reject invalid coordinates while accepting `(0,0)`.

Shared layout journeys independently probe WebGL capability before requiring a
ready canvas or the explicit localized error/retry UI. Passport's SVG interactions
and real WebGL regressions remain covered. Generated diagnostics stay in ignored
`test-results/` and `playwright-report/`.

## Responsive and browser coverage

The full responsive flight-row tests retain eight viewports, both themes and all
192 row checks. Reachability, date text, clipping and hit testing still run for
every row. [`expectFlightRowGeometry`](../e2e/helpers/flight-row-geometry.ts)
collects row rectangles in one browser evaluation and checks the same non-null,
non-overlap, date-width and desktop scroll-left invariants.

The current suite evolves with the product; **do not use historical per-file
counts as a current inventory**. Use `pnpm test:e2e --list` to inspect discovery
and project selection. Relevant coverage includes:

- [`keepraw-fly.pw.ts`](../e2e/keepraw-fly.pw.ts): editing, Settings, import
  flows, accessibility and responsive app journeys.
- [`unified-page-theme.pw.ts`](../e2e/unified-page-theme.pw.ts): live System
  appearance, Settings dialogs, persistence affordances, export and cancellation.
- [`responsive-boundaries.pw.ts`](../e2e/responsive-boundaries.pw.ts) and
  [`cross-browser-smoke.pw.ts`](../e2e/cross-browser-smoke.pw.ts): mobile and
  desktop boundaries, scrolling, controls and browser-sensitive focus.
- [`detail-map-curve.pw.ts`](../e2e/detail-map-curve.pw.ts) and the Globe
  suites: real WebGL, failure recovery, camera and visual/lighting behavior.
- [`persistent-storage.pw.ts`](../e2e/persistent-storage.pw.ts),
  [`document-persistence.pw.ts`](../e2e/document-persistence.pw.ts) and
  [`archive-recovery.pw.ts`](../e2e/archive-recovery.pw.ts): storage and
  archive failure/recovery paths.

Firefox/WebKit select only `@cross-browser` cases. Those smoke tests exercise
actual browser differences (layout, SVG, WebGL, scrolling, native storage and
keyboard focus) without repeating every Chromium business or viewport matrix.
When updating test tags, compare the discovered lists for all three projects;
never infer current coverage from an old fixed count.

## Adding E2E tests

Add ordinary tests without a tag; Chromium runs them. Add `{ tag: "@cross-browser" }`
only when the assertion depends on engine behavior (native storage, focus, input
events, SVG rendering, CSS/container queries, layout clipping or scrolling).
For a large mixed journey, extract a bounded smoke scenario instead of tagging
the entire locale/viewport/theme or business-error matrix. Keep locator/state
waiting; do not add fixed sleeps or raise timeouts to hide slow smoke tests.

After editing tags or projects, inspect `pnpm test:e2e --list` and run all three
projects. The Chromium list must still contain every pre-existing regression.

## Local verification

For focused changes, run the relevant tests first; before requesting review,
run `pnpm check:docs`, `pnpm format:check`, `pnpm test`, `pnpm build` and the
appropriate browser projects. Use `pnpm test:e2e --list` to inspect all
discovered cases. GitHub Actions runs the complete six-shard Chromium matrix
and Firefox/WebKit smoke suites before `verify` can pass.

The 2026-10-06 historical 97/15/15 and subsequent 134/38/38 counts described
earlier development phases, not the present suite; consult current Playwright
discovery and the CI job summaries for authoritative counts and durations.
