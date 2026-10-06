# Browser test layers

Chromium owns the full regression suite. The Firefox and WebKit projects select
only tests explicitly tagged `@cross-browser` in [Playwright configuration](../playwright.config.ts).
An untagged new E2E runs in Chromium automatically. No existing test is deleted,
skipped, or removed from Chromium by this split.

```bash
pnpm exec playwright install chromium firefox webkit
pnpm test:e2e --project=chromium
pnpm test:e2e --project=firefox
pnpm test:e2e --project=webkit
pnpm test:e2e --list
```

`pnpm test:e2e` runs all three projects with their respective layers. CI keeps
Chromium in `verify` and separate Firefox/WebKit matrix jobs with `fail-fast: false`.
Failed browser jobs upload the HTML report, screenshots and retained traces.
Browser installation remains `install --with-deps` for each engine; no binary cache
is added because removing repeated tests is the primary saving, while system
dependencies still need installation on fresh runners.

## Full regression inventory

Counts are from Playwright discovery when introducing this split, not a fixed
limit on future tests. All files below continue running in Chromium.

| Test file | Chromium | Firefox / WebKit, each | Coverage retained in full regression |
| --- | ---: | ---: | --- |
| `archive-recovery.pw.ts` | 24 | 0 | Corruption, migrations, future versions, serialization, recovery retries, import confirmation matrix, locales, Axe |
| `desktop-readability.pw.ts` | 1 | 0 | Search/year statistics, adjacent navigation, locale/theme/viewport presentation matrix |
| `detail-map-curve.pw.ts` | 1 | 1 | Native SVG screen geometry, round endpoints and offline maps |
| `document-persistence.pw.ts` | 11 | 1 | Edited flight reload, plus all failed writes, retry, deletion, concurrent writes and queue ordering |
| `flight-row-navigation.pw.ts` | 1 | 0 | Every row hit area, keyboard outlines, both themes and viewport combinations |
| `keepraw-fly.pw.ts` | 20 | 0 | Complete editing, imports/validation/duplicates, Settings, localization, statistics, Axe and visual acceptance |
| `map-visibility-and-title.pw.ts` | 2 | 0 | Twelve-route contrast/frequency audit and all airport/locale title wrapping combinations |
| `passport-detail-return.pw.ts` | 5 | 5 | Internal/document scroll restoration, adjacent detail return, SVG airport/route keyboard selection and focus |
| `passport-legend.pw.ts` | 1 | 0 | Statistics, filters, all locale × theme × viewport combinations and Axe |
| `persistent-storage.pw.ts` | 12 | 1 | Native StorageManager capabilities, plus mocked permission/status/retry/localization matrices |
| `responsive-boundaries.pw.ts` | 13 | 1 | Full eight-viewport acceptance, both themes, every row/date, landscape forms/imports/confirmations and live 760/761 resize |
| `cross-browser-smoke.pw.ts` | 6 | 6 | Bounded compatibility checks listed below |
| **Total** | **97** | **15** | Original 91 tests retained, six added |

Before the split, each of Chromium, Firefox and WebKit ran 91 tests. Afterward,
Firefox and WebKit each run 15 (about 84% fewer); Chromium runs 97. Test counts do
not include the many individual viewport/row/theme loops inside a single test.

## Cross-browser smoke inventory

The same 15 cases run in Firefox and WebKit:

- Three boundary journeys: 760×900 light, 761×900 light, 844×390 dark. Check
  application startup, Passport/Detail/Settings layout, real theme styles,
  internal versus document scrolling, representative first/last date clipping,
  container query columns, map legend/control overlap, detail return and overflow.
- One short landscape editor journey: create and save a flight, airport keyboard
  selection, expanded modal scrolling, Tab focus trap, confirmation controls,
  Escape/focus restoration and a real persisted reload.
- One Passport SVG journey: non-scaling strokes, resolved frequency widths/colors,
  offline rendering, wheel zoom, pointer panning and fit controls at 761px.
- One English long-title journey at 760px: keyboard row activation, focus-visible,
  balanced wrapping and native text-range geometry; no locale/airport matrix.
- The existing detail SVG geometry/offline test.
- The existing successful edited-flight IndexedDB round-trip and reload test.
- All five Passport detail return/map-selection tests. These directly test
  browser scrolling, SVG keyboard events and native focus behavior.
- The existing native StorageManager capability/status test; it does not trigger
  headless permission prompts or assume storage protection is granted.
- The existing live 760↔761 resizing test across Passport, Detail and Settings;
  CSS columns, media-query driven DOM and retained search state must stay in sync.

The full responsive tests keep their original assertions. Shared helpers live in
[`e2e/helpers/responsive.ts`](../e2e/helpers/responsive.ts); the smoke checks reuse
the same clipping/overflow/layout assertions but sample two rows and three
important sizes instead of 96 rows per theme. Firefox/WebKit execute only the
live-resize test from `responsive-boundaries.pw.ts`.

## Why the other tests run only in Chromium

The 82 original cases no longer selected in Firefox/WebKit are still covered by
Chromium. Mocked recovery and persistence failures test application state machines,
not another browser engine. Import validation, duplicate rules, statistics,
defaults and translated copy also have shared application logic and unit coverage.
The full accessibility and visual acceptance matrices remain in Chromium.

Mixed presentation journeys are not tagged wholesale: their engine-sensitive
parts are retained as focused smoke checks for actual hit testing, keyboard focus,
scrollports, container queries, theme rendering, balanced text and SVG geometry.
This avoids repeating every business assertion, language, viewport and theme in
Firefox/WebKit while retaining the relevant compatibility checks.

## Adding E2E tests

Add ordinary tests without a tag; Chromium runs them. Add `{ tag: "@cross-browser" }`
only when the assertion depends on engine behavior (native storage, focus, input
events, SVG rendering, CSS/container queries, layout clipping or scrolling).
For a large mixed journey, extract a bounded smoke scenario instead of tagging
the entire locale/viewport/theme or business-error matrix. Keep locator/state
waiting; do not add fixed sleeps or raise timeouts to hide slow smoke tests.

After editing tags or projects, inspect `pnpm test:e2e --list` and run all three
projects. The Chromium list must still contain every pre-existing regression.

## Initial local verification

Verified on Windows on 2026-10-06, with zero retries, skips or failures:

| Project | Passed | Workers | Playwright elapsed time |
| --- | ---: | ---: | ---: |
| Chromium full regression | 97 | 2 | 199 seconds |
| Firefox smoke | 15 | 1 | 38 seconds |
| WebKit smoke | 15 | 1 | 56 seconds |

These timings exclude dependency/browser installation; Actions runner setup has
its own cost. The retained `responsive-boundaries` resize smoke took about four
seconds in Firefox and eight seconds in WebKit. Workspace type checking, changed
E2E TypeScript checks, documentation consistency and `git diff --check` also passed.
