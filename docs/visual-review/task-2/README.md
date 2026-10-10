# Task 2 — Desktop Passport statistics and solar preference

PR #34 only, base `codex/desktop-passport-redesign-checkpoint`. Control is approved; Task 2 Desktop UI awaits owner visual review. PR stays Draft. Stop here before Task 3 / production WebGL integration.

## Desktop statistics and Highlights

Six existing KPIs form one compact region: Distance, Flights, Flight duration, Airports, Airlines, Countries/Regions. Existing calculations, units, locale formatting, cancellation/diversion semantics, search, annual/lifetime and archive behavior are reused unchanged.

The secondary row shows total arrival delay, the most visited city/IATA with visit frequency, and localized longest-flight cities with duration and selected-unit distance. Actual duration is used when both actual times exist; otherwise the established scheduled-duration helper applies. Unknown delay stays `—`, recorded zero stays formatted zero, and early arrivals never offset positive delay. The arrival-delay explanation remains available through title/accessibility description.

Airport/route buttons retain filtering, pressed state, keyboard operation and highlighting. The city name remains visible at narrower desktop widths. Typography uses tabular numbers and restrained shared separators. Mobile Passport and Flight Detail have no design changes; 760/761 is preserved; Highlights are hidden at desktop heights ≤540px.

## Unedited browser review

Repository Demo, Lifetime, English, kilometers, DPR1, reduced motion. Production Passport continues to use its established SVG map. No fabricated routes, miniature Highlight maps or screenshot compositing.

| Viewport   | Dark                               | Light                                |
| ---------- | ---------------------------------- | ------------------------------------ |
| 1440 × 900 | [Dark](passport-dark-1440x900.png) | [Light](passport-light-1440x900.png) |
| 1366 × 768 | [Dark](passport-dark-1366x768.png) | [Light](passport-light-1366x768.png) |
| 1280 × 720 | [Dark](passport-dark-1280x720.png) | [Light](passport-light-1280x720.png) |
| 1024 × 768 | [Dark](passport-dark-1024x768.png) | [Light](passport-light-1024x768.png) |
| 761 × 900  | [Dark](passport-dark-761x900.png)  | [Light](passport-light-761x900.png)  |

[Capture manifest](screenshots.json) records untouched PNG hashes, browser version, all six values, all three Highlights and actual geometry. No page/right-region overflow or clipped map controls occurred. At 1440 × 900, the map is **578.05px** high, KPI strip **64.95px**, Highlights **64px**; the checkpoint map was **576.06px**. At 761px, the same six KPIs use two compact rows. Archive scrolling remains independent.

Generate this exact ten-image set using `node scripts/capture-task-2.mjs` with the local development server running. It checks overflow and the approved Globe reference SHA-256 before/after capture.

![Desktop Dark review](passport-dark-1440x900.png)

![Desktop Light review](passport-light-1440x900.png)

## Globe evidence cleanup

[Canonical references](../task-1b-7b2/README.md) and [complete deletion/retention inventory](../task-1b-7b2/cleanup-inventory.json): 124 → 6 historical Globe PNGs, 118 deleted, **68,539,317 bytes** removed from the current tree. All six retained references are unchanged. Approved Dark Control SHA-256: `c17d906dc74bd44d91e80f247bc784f6d41e6a19e083778dc2a54d07e8bf24d5`.

Numerical evidence, original hashes/results, provenance, textures, tests, source concepts and licensing artifacts remain. Git history is intact.

## Persistent solar preference and migration

Settings → General exposes **Fixed Sun / Real-time Sun**, with English, Simplified Chinese and Traditional Chinese labels and an explanation of their meaning. Default is `fixed`. `ViewerSettings.solarMode` reuses the existing preferences record and ordered persistence queue; no separate storage or portable archive field was added.

The IndexedDB loading path normalizes missing/invalid modes to `fixed` while preserving all other preferences and the archive. No database version change is needed: the existing key/value record accepts the additional field. Read-time normalization does not rewrite a historical record; the next ordinary settings save persists the normalized preference. Real-time survives reload and navigation.

Globe Lab reads the App-owned preference directly. Its existing radio controls write through the same settings callback/queue. Mode changes do not touch routes, theme, quality, camera or selection and introduce no renderer/texture initialization. Existing UTC astronomy, minute-boundary refresh and visibility handling remain unchanged. Returning to Fixed restores the canonical world-space direction.

**Reset Lighting** restores the approved lighting parameters and diagnostic toggles only. It keeps the persistent solar preference, camera, selection, filters and theme. A translated title/accessibility description explains this scope.

Focused migration tests exercise missing, `null`, invalid string, numeric, `fixed` and `realtime` records in real fake-IndexedDB tables, retain language/theme/units/time format/power-user/backup fields, verify read-time storage is unchanged, round-trip a normal settings save and compare the entire archive record. The browser regression exercises Settings → reload → Lab → Reset Lighting → Fixed → reload → Settings, plus all three localized labels. Existing deterministic UTC/camera/renderer/visibility tests remain active.

[Scope audit](scope-audit.json) confirms nine frozen source files, all six retained PNGs and all fourteen changed historical JSON reports preserve their original content (apart from added screenshot lifecycle metadata). Core calculations, domain schema, mobile styles, shaders, camera math, solar math, picking and fallback code remain unchanged.

## Actual validation and remaining limitations

| Check                                                                    | Result                                                                                                                                                |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation, formatting, CSS lint/tokens, typecheck, build, diff check | Passed                                                                                                                                                |
| Unit suite                                                               | **330 passed**: web230 + core66 + validator31 + CSS AST3                                                                                              |
| Chromium full suite                                                      | **117 passed / 1 failed** on the old Settings control-count assertion                                                                                 |
| Chromium Settings follow-up                                              | **1 passed** after updating 7 → 8 controls and explicitly checking the fifth General select and Fixed default; all 118 current test cases have passed |
| WebKit full project                                                      | **25 passed / 1 failed**: existing Globe screenshot test timed out waiting for the Fit recorded routes button to stabilize                            |
| WebKit isolated follow-up                                                | **1 passed**, 16.6s, unchanged product code/assertions/timeouts/retries; all 26 current project cases have passed                                     |
| Firefox full project                                                     | All **26** cases blocked at native browser launch: `browserType.launch: spawn UNKNOWN`; no application assertions ran                                 |
| Formal screenshots                                                       | **10 captured**, geometry and hashes verified, all ten visually inspected                                                                             |
| Frozen sources / retained evidence                                       | **9 sources + 6 PNGs + 14 historical JSON reports** verified unchanged                                                                                |

[Machine-readable results](test-results.json) and [exact changed-file list](changed-files.json) complement the capture and cleanup inventories. Local full/follow-up logs and traces remain in ignored `artifacts/task-2-*` and `test-results/`; they are not another tracked screenshot archive.

Two earlier Chromium runs were interrupted after trace inspection showed Vite serving the App's timestamped storage module alongside the test's untimestamped module. Terminal interruption had left a child listener alive. After stopping the verified workspace listener and checking the App import was clean, all storage fault-injection cases passed. No storage assertions were removed.

The known WebKit `globe-lab.pw.ts:328` axe color-contrast issue **did not recur**. Its full-run interaction/motion/accessibility check passed. The separate screenshot timeout above is retained explicitly, with its original trace and passing isolated follow-up; no WCAG rules, retries or timeouts were weakened.

Remaining local limitations: Firefox cannot launch on this Windows host; WebKit showed the recorded transient screenshot timeout; build retains the existing >500kB chunk warning. No outstanding Task 2 application defect was reproduced. Owner review of the final Desktop UI remains pending.

At the owner's final instruction, PR #34 is updated directly without waiting for or monitoring CI. The [PR checks](https://github.com/keepraw/Keepraw-Fly/pull/34/checks) are linked for reference only; no new-head CI success is claimed here.

## Commits and handoff

- `cd6a1b00e66ab30907fba3e9673e939485f54eb2` — obsolete screenshot cleanup and canonical inventory.
- `2583808a2490c0a4ffa9519a65e7129ef766e067` — compact statistics, localized Highlights, regressions and ten review captures.
- The final solar-preference commit contains Settings/Lab synchronization, IndexedDB normalization, migration/browser regressions and this handoff; its SHA is recorded in PR #34 and the delivery message.

Push destination is exclusively `codex/globe-prototype-experiment`. PR #34 stays Draft on its existing base. No merge, Task 3, production WebGL integration or new camera exploration occurred. Await owner visual approval of Task 2.
