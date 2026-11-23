# Browser test layers

Chromium owns the full regression suite. The Firefox and WebKit projects select
only tests explicitly tagged `@cross-browser` in [Playwright configuration](../playwright.config.ts).
An untagged new E2E runs in Chromium automatically. The browser-layer split retains
the full regression coverage in Chromium, while engine-sensitive
behaviors have their own targeted tests.

```bash
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e --project=chromium --workers=1
pnpm test:e2e --project=firefox --workers=1
pnpm test:e2e --project=webkit --workers=1
pnpm test:e2e --list
```

`pnpm test:e2e` runs all three projects with their respective layers. The
[CI workflow](../.github/workflows/ci.yml) is authoritative for runner versions,
workers, timeouts, runtime pins and upload policy. Static checks/build run in
`checks`; Chromium runs the full suite across six shards, and Firefox/WebKit run
compatibility smoke projects. Production CSP/font journeys run separately in
`csp` for all three engines. Both matrices keep `fail-fast: false`.

Chromium uses `CI_CHROMIUM_SHARD=N/6` and
[`scripts/playwright-shards.mjs`](../scripts/playwright-shards.mjs) to balance whole
files by measured duration and discover new files. Its disjoint union must retain
every test. Firefox uses one worker and WebKit uses two in the compatibility matrix.
Chromium downloads its locked browser on Ubuntu 24.04; compatibility and CSP jobs
use the pinned official Playwright container and check matching installed runtimes.
Firefox runs headed on an Xvfb display. Test retries and
`fullyParallel: false` remain defined by the Playwright configuration.

The `verify` aggregate gate uses `always()` and requires `checks`, all Chromium
shards, both compatibility engines and all CSP jobs to succeed. A failed,
cancelled or skipped dependency fails the gate, with one exception: a pull
request that changes only Markdown files skips the browser jobs (Chromium,
compatibility and CSP), and the gate then requires exactly that skip. Only a successful push-to-main
run deploys the production artifact from that same run. PR CI never deploys.
The checks job also packages the exact build and verifies release/deployment tools.

Browser jobs publish the workflow-configured HTML/JSON reports and retained
failure screenshots/traces. `scripts/report-playwright.mjs` summarizes counts,
per-file durations and diagnostics and fails on skipped/unexpected tests, global
errors or an empty report. Normal CI does not collect success-only design galleries.

## Manual captures

Manual capture helpers default to ignored `artifacts/`; their output does not
replace a committed regression input or approved visual reference.

Reusable helpers live in `scripts/` and run from the repository root:

| Helper                                    | Prerequisites and ignored default output                               |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `capture-detail-hero.mjs`                 | Running dev server and Chromium; `artifacts/detail-hero/`              |
| `capture-task-2c.mjs`                     | Running dev server and Chromium/font access; `artifacts/task-2c/`      |
| `capture-theme-history.mjs before\|after` | Recorded Task A checkout, dev server and Chromium; `artifacts/task-a/` |
| `capture-neon-lab.mjs`                    | Running development server and Chromium; `artifacts/neon-lab/`         |

For Hero captures set `BASE_URL`, `LABEL` and optionally `OUT`; keep overrides
under ignored `artifacts/`. It reads the existing Detail regression fixture and
records 16 viewport/theme/data scenarios after font and map readiness.
The historical theme helper is documented with its [source provenance](archive/visual-review/task-a/README.md).
Task 2C retains the byte-verified approved Dark Control input and its
[font evidence instructions](archive/visual-review/task-2c/resume/README.md).

## Production 2D maps

Production Passport and Flight Detail render SVG and need no WebGL.
`passport-map.pw.ts` covers the themed Passport map on desktop and mobile:
pointer, keyboard and picker selection, zoom, pan and reset, and the absence of
canvases, filters and any request for the removed 3D globe. `flight-route-map.pw.ts` covers automatic
framing for short, date-line, polar and long-haul routes, diversions, cancelled
flights, controls and per-flight camera reset. `map-theme-preference.pw.ts`
covers switching, persistence and the invalid-ID fallback. Unit tests in
`apps/web/src/map2d/` sample the framing and identity rules directly.

The app has no WebGL renderer; most journeys run with WebGL2 refused
(`helpers/passport-svg.ts`). Generated diagnostics stay in ignored `test-results/` and
`playwright-report/`.

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
- [`views-routing.pw.ts`](../e2e/views-routing.pw.ts): the four views and their
  fragments, the addressable Flight across reload, Back and Forward, legacy
  fragments, Settings parts, and the Compact tab bar with its touch targets.
- [`unified-page-theme.pw.ts`](../e2e/unified-page-theme.pw.ts): live System
  appearance, Settings dialogs, persistence affordances, export and cancellation.
- [`responsive-boundaries.pw.ts`](../e2e/responsive-boundaries.pw.ts) and
  [`cross-browser-smoke.pw.ts`](../e2e/cross-browser-smoke.pw.ts): mobile and
  desktop boundaries, scrolling, controls and browser-sensitive focus.
- [`passport-map.pw.ts`](../e2e/passport-map.pw.ts) and
  [`flight-route-map.pw.ts`](../e2e/flight-route-map.pw.ts): production 2D maps.
- [`persistent-storage.pw.ts`](../e2e/persistent-storage.pw.ts),
  [`document-persistence.pw.ts`](../e2e/document-persistence.pw.ts) and
  [`archive-recovery.pw.ts`](../e2e/archive-recovery.pw.ts): storage and
  archive failure/recovery paths.

Firefox/WebKit select only `@cross-browser` cases. Those smoke tests exercise
actual browser differences (layout, SVG, scrolling, native storage and
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

Use [engineering standards](engineering-standards.md#quality-gates) for the
repository-wide command checklist. Run focused journeys when their code, inputs
or capture paths change; inspect `pnpm test:e2e --list` for current discovery.
GitHub Actions runs the complete Chromium, compatibility and CSP matrices before
`verify` can pass. Historical test counts and audit timings are not a current
inventory or evidence that a new change passed.
