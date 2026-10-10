# Task 3 — Production Desktop Globe integration

Status: **Task 3 visually approved by the Owner; PR #35 merged into `main` as `0bb6660d41605dbeb1da3bc3f15df5b56798aba8`. GitHub Pages automatic deployment was still paused at this checkpoint; merging is not a publishing instruction.**

Task 2C was visually accepted and Task 3 development authorized on 2026-10-10. Implementation history began at `3e0b85590dc6625b67c0e8bf56e857bec9883b2b` on the former `codex/desktop-passport-task-3-globe-integration` branch, based on `codex/globe-prototype-experiment` at `2b9378d0a27146a8650508c0a54f04b709b9d976`. PR #33, #34 and #35 have since been merged in order; the old branch and Draft instructions below refer to earlier checkpoints.

## Production behavior

- The official Desktop Passport lazily mounts the approved `GlobeMap`/Three renderer in its existing map cell. Its renderer, shaders, camera math, solar math, ocean, atmosphere, night response/emission, textures and Lab stylesheet remain unchanged.
- `buildRouteSegments` uses actual validated flight records. The surrounding Globe network follows Lifetime, Year and Search; selecting an airport or directed route filters Archive/KPI/Highlights, selects the newest matching flight, scrolls it into view and moves keyboard focus to its row. The surrounding network remains available to select another route directly.
- Period/search network arrays remain stable across Archive focus, selected-record changes and airport/route selection. These interactions no longer recreate the WebGL scene. A genuinely changed period/search network is disposed and composed once using the existing approved default camera algorithm; route/airport selection uses the existing approved camera transition.
- Repeated flights aggregate counts, reverse directions share the approved physical stroke, and the picker retains both directed choices. Overlap and reverse picking reuse the existing renderer. Diverted flights use the actual arrival airport. Cancelled or unknown-coordinate records are not invented as flown geometry.
- Pointer airport labels and route hit testing, arrows, zoom, Home and native keyboard-accessible airport/route pickers operate on the formal page.
- Appearance and Fixed Sun / Real-time Sun use the existing persisted Settings record. System appearance follows the OS media query. Realtime updates retain the existing visibility-aware minute timer.
- No WebGL2, texture failure and actual `WEBGL_lose_context` loss switch to the original interactive SVG. Retry restores the selected state. The wrapper immediately disposes a failed renderer; unmount, page leave, desktop/mobile transition and data replacement also dispose the instance. SVG fallback receives Archive route hover/selection highlights.
- Shared Lab styles supply host/canvas sizing, labels, controls and legend. Passport-specific rules supply scoped label/button styling, full-height grid sizing and fallback status overlay without reducing the SVG viewport.
- Six KPI and three Highlights remain on one screen, the Archive scrolls independently, and the right side has no separate scroll. Longest Flight has no mini-map. The existing Mobile branch and short-height exception remain intact.

## Visual evidence

[Screenshot index](SCREENSHOTS.md) · [Browser measurements and image hashes](browser-evidence.json)

The original 63 images were actual `/#passport` captures, never Lab substitutes: English/Simplified/Traditional, Dark/Light, 1440×900, 1366×768, 1280×720, 1024×768 and 761×900 at 100% and native 125%, plus three long-city archives at 1280×720. Task 4 retained 12 representative PNGs in the current tree and moved the rest to [historical Git evidence](../CLEANUP-2026-10-10.md); the complete browser-evidence JSON is unchanged. Zoom uses Chromium profile preferences and verifies DPR plus the effective CSS viewport; no CSS zoom or DPR-only emulation.

At native 125%, physical 761×900 becomes an effective CSS width of 609px and intentionally uses the existing Mobile design. All other matrix entries mount real WebGL 3D. There are 57 Desktop captures and six Mobile captures. Desktop checks assert a filled renderer host, actual route data, six KPI, all three Highlights, complete text, no right scrolling and a bottom safety margin of at least 24 CSS pixels (fractional rounding accounted for). Small map cells retain the approved collision suppression; all airports and both route directions remain available through the picker.

The default Globe keeps the approved cinematic crop, including the cropped lower hemisphere. This is not a new camera or lighting design. The Owner has approved the formal-page composition, including narrower viewports and 125% native zoom.

## Validation

[Validation record](VALIDATION.md)

[Implementation CI](https://github.com/keepraw/Keepraw-Fly/actions/runs/38055009877) passed on `7578541730a33bcc8a7f8e19fe5e42f9068fd045`: static checks, TypeScript, 333 unit tests, Chromium 134/134, Firefox 38/38, WebKit 38/38 and production build. Deployment was skipped. Linux Firefox had no usable WebGL2 context, so its Globe journeys verified the capability-based SVG path; Chromium and WebKit completed the 3D paths. Final delivery changes can be checked separately through [PR #35 checks](https://github.com/keepraw/Keepraw-Fly/pull/35/checks).

The documentation-head run concluded success but recorded one native-100%-zoom flaky. A local diagnostic exposed measurement before the lazy map existed. That journey now waits for actual Globe readiness, fonts and finite animations before retaining all original layout assertions; its subsequent remote Chromium run passed 134/134 without retries. That run exposed the same missing-node race in Firefox long-city measurements, so the shared typography entry also waits for an actual scene/SVG and two paint frames. Related local Chromium 9/9 and Firefox 7/7 passed without retries. The exact remote transients and local diagnostics remain in the validation record. These final delivery changes affect test synchronization only; product code, frozen material and screenshots are unchanged.

The initial remote CI at `3e0b855` failed Prettier in `PassportPage.tsx`; it was not a validated integration. The current work fixes that formatting and tests actual local browsers. Existing SVG regression journeys deliberately disable WebGL2 to exercise the formal fallback while retaining their original assertions. Tests that assumed selecting a map record did not filter Archive now explicitly close the new exploration before testing a broader search. The former Lab-isolation assertion now verifies the authorized formal Globe integration. No approved pixel hash or visual assertion has been relaxed.

Task 3 E2E covers real duplicate/reverse/diverted data, period/search updates, Archive focus, stable canvas identity during selection, direct pointer picking, keyboard camera controls, both themes, accessibility, all three failure paths, retry, native GPU deletions and stopped RAF after disposal, persisted solar settings and Mobile transitions. Existing Lab camera/light/night/solar tests remain in the full regression.

## Delivery boundary

**Final outcome:** Owner visually accepted Task 3 and all three implementation PRs were subsequently merged. The approved Globe render, textures, shaders and Control baseline remain frozen. Task 4 trims redundant review PNGs without changing any runtime code or image bytes. Publication remains a separate Owner decision.
