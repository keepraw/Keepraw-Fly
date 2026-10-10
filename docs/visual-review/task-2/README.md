# Task 2B — Statistics Visual Fidelity Pass

PR [#34](https://github.com/keepraw/Keepraw-Fly/pull/34), existing branch `codex/globe-prototype-experiment`, baseline `fa3e10d457d84df96a47b59b4d1fd403451bc4a9`. Remote HEAD was checked before changes and matched the baseline. Keep Draft; owner visual approval remains pending. Stop before Task 3.

## Continuous statistics dashboard

The six existing KPIs and their calculations are retained. Three aligned columns now restore the information density of concept Panels 01/04 without introducing separate cards:

- **Total arrival delay:** prominent total plus native HTML/CSS annual columns. Positive delays use the existing `arrivalDelayMinutes` helper; early arrivals contribute zero; missing actual arrivals and diversions remain unknown; cancelled flights are excluded. The latest three service years with non-cancelled records are shown in chronological order. Unknown years show `—` without a bar; recorded zero uses a baseline tick. When a scope has more than three years, a visible caption identifies the latest-three-year chart while the total continues to cover that entire scope.
- **Most visited:** up to four localized city/IATA rows, actual counts and proportional bars relative to the highest count. Origin and actual destination each count once; diversions use the recorded diversion airport. Ties sort by IATA code. Every row retains the established airport selection, filter toggle, focus and `aria-pressed` interaction.
- **Longest flight:** prominent origin/destination IATA, complete localized cities, and separate duration/distance values. Actual duration is preferred when both actual times exist; otherwise scheduled duration applies. Distance follows km/mi preferences. The route remains a keyboard-accessible selection button. Empty filtered data uses plain unavailable states. **This module contains no map, image, SVG or canvas.**

All three modules use the exact same Lifetime / Year / Search / selection scope as the six KPIs. No fabricated demo values, chart library or dependency was added.

## Browser evidence and previous-layout comparison

Ten existing candidate PNG paths are replaced in place. Captures are unedited Chromium browser screenshots of the repository Demo, Lifetime, English, kilometers, DPR1 and reduced motion. They retain the production 2D SVG map.

| Viewport   | Dark                               | Light                                | Map height before → after | Highlights before → after |
| ---------- | ---------------------------------- | ------------------------------------ | ------------------------- | ------------------------- |
| 1440 × 900 | [Dark](passport-dark-1440x900.png) | [Light](passport-light-1440x900.png) | 578.05 → 498.05px         | 64 → 144px                |
| 1366 × 768 | [Dark](passport-dark-1366x768.png) | [Light](passport-light-1366x768.png) | 447.48 → 367.48px         | 64 → 144px                |
| 1280 × 720 | [Dark](passport-dark-1280x720.png) | [Light](passport-light-1280x720.png) | 401.13 → 321.13px         | 64 → 144px                |
| 1024 × 768 | [Dark](passport-dark-1024x768.png) | [Light](passport-light-1024x768.png) | 402.22 → 289.31px         | 64 → 226.80px             |
| 761 × 900  | [Dark](passport-dark-761x900.png)  | [Light](passport-light-761x900.png)  | 520.73 → 371.42px         | 77.48 → 226.80px          |

At narrower desktop widths the delay/ranking occupy the first row and the route/details occupy the second. At 1024px six KPIs still fit on one row; at 761px they use two rows. The map remains the largest visual region at each requested size. Flight Archive retains its independent scrollport. Desktop height ≤540px continues to hide Highlights, and the 760/761 boundary and Mobile Passport are preserved.

[Capture manifest](screenshots.json) records the previous baseline geometry, current DOM dimensions, source archive SHA-256, arrival timestamps and calculated yearly delays, endpoint records, actual/scheduled duration records, chart proportions and localized route facts. Every capture passes document/right-region overflow, visible Highlight text range, map-control boundary and frozen Control hash assertions. `node scripts/capture-task-2.mjs` regenerates this exact ten-image set with the local development server running.

![Desktop Dark](passport-dark-1440x900.png)

![Desktop Light](passport-light-1440x900.png)

## Actual Demo data

The [source archive](../../../packages/core/data/demo.keepraw-fly.json) contains 24 non-cancelled flights. Its six KPIs remain **143,204 km · 24 flights · 181h 46m · 20 airports · 16 airlines · 11 countries**.

| Service year | Positive arrival delay | Recorded actual arrivals |
| ------------ | ---------------------- | ------------------------ |
| 2024         | 38 min                 | 6                        |
| 2025         | 53 min                 | 7                        |
| 2026         | 66 min                 | 9                        |

The annual sum is **157 min = 2h 37m**. Unknown arrival times do not create recorded zero values.

| Rank | City / IATA         | Visits | Bar proportion |
| ---- | ------------------- | ------ | -------------- |
| 1    | San Francisco · SFO | 9      | 100%           |
| 2    | Los Angeles · LAX   | 5      | 55.56%         |
| 3    | Shanghai · PVG      | 5      | 55.56%         |
| 4    | London · LHR        | 4      | 44.44%         |

Longest flight remains **LAX / Los Angeles → SYD / Sydney**, **14h 27m**, **12,061 km / 7,494 mi**. The manifest provides the original timestamps and endpoints behind these displayed values.

## Protected work

[Task 2B scope audit](task-2b-scope-audit.json) verifies 44 protected source/reference/configuration files byte-for-byte against the baseline: Globe camera/Home, rendering, lighting, shaders, night emission and UTC solar behavior; storage/settings and solar preference persistence; core KPI/duration/distance calculations; production SVG map; Flight Detail and shared/mobile Passport CSS; the original solar pixel test and Playwright configuration. The six canonical Globe PNGs are unchanged.

Approved Dark Control SHA-256 remains `c17d906dc74bd44d91e80f247bc784f6d41e6a19e083778dc2a54d07e8bf24d5`. The [118-image cleanup inventory](../task-1b-7b2/cleanup-inventory.json), [canonical references](../task-1b-7b2/README.md), [historical Task 2 scope audit](scope-audit.json), [Task 2 validation](test-results.json) and [Task 2 file list](changed-files.json) remain intact. Prior commits `cd6a1b0`, `2583808` and `fa3e10d` are preserved as ancestors.

## Validation and handoff

Current validation results and limitations are recorded in [Task 2B results](task-2b-results.json). New tests cover annual aggregation, unknown/zero/early/cancelled/diverted records, Top 4 and stable ties, filter scope, keyboard airport/route toggles, real proportional bars, localized cities/IATA, units and empty states. Existing suites cover Dark/Light, all requested sizes, short landscape, three languages, archive scrolling, mobile boundary, Globe and solar preferences.

The map zoom regression still verifies every zoom step and the established 8x cap. Its number of clicks now derives from the actual fitted map scale because the statistics dashboard changes the map height. Other existing test edits only update selectors/counts for the new structure or add requested viewport coverage. The attempted solar-test synchronization change was reverted because it did not resolve the repeated hash mismatch and was outside Task 2B. Globe sources, the original solar test, Playwright configuration, assertion thresholds, hash comparisons, timeouts and retries are unchanged.

**Full E2E remains unresolved.** Earlier Chromium runs returned 117 passed / 2 failed, 118 passed / 1 failed, and 115 passed / 4 failed. The original solar assertion at `e2e/globe-solar.pw.ts:130` failed in the first two runs; the third run with the abandoned synchronization attempt also failed, alongside two navigation timeouts and the immediate overflow assertion at `e2e/passport-legend.pw.ts:153`. Causes are not established. Logs, retained traces/screenshots, error locations and reproduction history are listed in the results manifest. The first run's default-output trace was overwritten before dedicated output directories were used; the second run retains the same failure with the original test. Firefox was blocked by Windows `browserType.launch: spawn UNKNOWN`; WebKit was not executed for Task 2B. Full local runs have stopped. Passed static/unit/build checks are reused; only one final Task 2B targeted run is performed.

[PR checks / CI](https://github.com/keepraw/Keepraw-Fly/pull/34/checks). Final commit and CI run URL are recorded in the delivery message. No merge, deployment, PR #33 change or Task 3 work. Await owner visual acceptance of Task 2B.
