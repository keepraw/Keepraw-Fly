# Task A — validation record

Base main: `802c5d510d1e4c96633a4259e58fccb0fb83522b`, unchanged after fetching again.
Branch: `codex/task-a-unified-page-theme`. No deployment configuration was changed.

Local runtime: Node.js 24.19.0, pnpm 10.14.0, Playwright 1.63.0, Chromium 153,
Firefox 155 and WebKit 26.6. Dependencies were initially installed with the
preinstalled pnpm 11.25.0 using the frozen lockfile; all reported validation commands
use the repository's required pnpm 10.14.0. No lockfile or dependency changes.

Temporary runtime libraries were unpacked under `/tmp` for Firefox/WebKit. WebKit's
launcher resets `LD_LIBRARY_PATH`, so missing system libraries were linked into its
temporary browser bundle. Its ldconfig-only host check cannot discover those files;
local E2E uses `PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1` after a real browser
launch and application startup succeeded. This does not skip any test or assertion.
Firefox requires execution outside the default process sandbox to access its
temporary profile. Chromium uses a temporary launcher that pins this environment's
proxy CA public key for font downloads; no persistent user trust store was changed.

## Commands

| Command                     | Result                                                                |
| --------------------------- | --------------------------------------------------------------------- |
| `pnpm format:check`         | Passed, including final evidence formatting                           |
| `pnpm lint:css`             | Passed                                                                |
| `pnpm check:css-tokens`     | Passed; zero unresolved tokens                                        |
| `pnpm check:docs`           | Passed, including evidence links                                      |
| `pnpm typecheck`            | Passed                                                                |
| `pnpm test`                 | Passed: 7 script, 94 core, 31 validator and 278 web tests (410 total) |
| `pnpm test:e2e --workers=2` | Initial 262/270; corrected failures rerun 8/8; new native zoom 1/1    |
| `pnpm build`                | Passed; existing large-chunk warning retained                         |

## Added coverage and failures addressed

36 added Detail unit cases verify explicit expected city names in all three
languages, title/stop agreement, multi-airport groups, unknown-IATA fallback and
diversion semantics. Existing timing/facts assertions are retained.

29 new Chromium browser cases cover the seven-viewport, three-language theme/System
matrix, Settings workflows in both themes, CSS/native 125% zoom and complete Detail
cities/times/status colors. The Portal keyboard/System isolation test also runs in
Firefox and WebKit. Existing Passport palette assertions were updated to expect
the newly shared page colors, retaining every assertion.

Initial focused runs exposed environment certificate/library problems and test
locator assumptions (a fitted map can disable zoom-in; persistent-storage success
changes its button label). Those were corrected without removing assertions.
The new backdrop cancellation check found a focus-restoration bug: Settings now
prevents the backdrop's default mousedown focus move, retaining the other dialogs'
behavior. Native Tab navigation establishes focus-visible in all three engines.

The first full run caught Recovery's reuse of `.settings-page`. The shared theme
now explicitly excludes `.recovery-page` using `:where()` to preserve specificity;
Recovery source and global defaults are unchanged. Its original dark-color and
accessibility test passed on rerun.

Two existing Settings regression tests expected the former global dark text color.
Their expected value now matches Passport's approved `#e5eaf2`; their accessibility,
responsive and business assertions remain intact. The other five initial failures
were WebKit: one mobile Passport Axe check and four 30-second timeouts in existing
map/Chinese typography journeys. The isolated mobile Axe rerun passed without code
or assertion changes. `pnpm test:e2e --last-failed --workers=1` passed all eight
failures (2.5 minutes). No timeout, retry policy, test project or assertion was
weakened. The initial full run took 25.7 minutes; its failures remain recorded
here rather than being described as a clean first run.

The native 125% case was added after the initial full run was discovered and passed
separately (1/1); the final inventory is 271 tests: 175 Chromium, 48 Firefox and
48 WebKit. Both updated import-success semantic checks also passed separately (2/2).

CI status at preparation: not started yet; the Draft PR will trigger the existing
workflow. Its description reports the current remote CI status separately. No
workflow or deployment setting has been edited.

The final main recheck through the GitHub connector returned the same baseline
SHA. At delivery, the terminal HTTP proxy was returning GitHub 503 connection
errors while the connector remained available; this is an environment transport
limitation, not a repository permission failure.

## Review status

Owner visual approval and physical-device inspection remain pending. Native
Chromium 125% profile zoom is automated and passed. No Draft-to-Ready transition,
merge, Pages deployment or enabling
automatic deployment is authorized by this record.
