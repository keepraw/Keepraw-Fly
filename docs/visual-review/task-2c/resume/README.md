# Task 2C — resumed review

Visual acceptance remains **Pending Owner review**. PR #33/#34 stay Draft.

[Validation record](validation-results.json) · [Complete browser/font evidence](browser-evidence.json) · [Long city evidence](long-cities/browser-evidence.json) · [Native zoom minimum reproduction](native-zoom-probe.json)

The normal archive covers 72 cases: six physical viewport sizes × three languages × two themes × native 100%/125% browser zoom. Each cell below links the actual viewport PNG. This custom capture is separate from formal Playwright E2E.

| Physical viewport / native zoom | en Dark                                      | en Light                                      | CN Dark                                         | CN Light                                         | TC Dark                                         | TC Light                                         |
| ------------------------------- | -------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | ------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------ |
| 1646×928 / 100%                 | [PNG](passport-en-dark-1646x928-zoom100.png) | [PNG](passport-en-light-1646x928-zoom100.png) | [PNG](passport-zh-CN-dark-1646x928-zoom100.png) | [PNG](passport-zh-CN-light-1646x928-zoom100.png) | [PNG](passport-zh-TW-dark-1646x928-zoom100.png) | [PNG](passport-zh-TW-light-1646x928-zoom100.png) |
| 1440×900 / 100%                 | [PNG](passport-en-dark-1440x900-zoom100.png) | [PNG](passport-en-light-1440x900-zoom100.png) | [PNG](passport-zh-CN-dark-1440x900-zoom100.png) | [PNG](passport-zh-CN-light-1440x900-zoom100.png) | [PNG](passport-zh-TW-dark-1440x900-zoom100.png) | [PNG](passport-zh-TW-light-1440x900-zoom100.png) |
| 1366×768 / 100%                 | [PNG](passport-en-dark-1366x768-zoom100.png) | [PNG](passport-en-light-1366x768-zoom100.png) | [PNG](passport-zh-CN-dark-1366x768-zoom100.png) | [PNG](passport-zh-CN-light-1366x768-zoom100.png) | [PNG](passport-zh-TW-dark-1366x768-zoom100.png) | [PNG](passport-zh-TW-light-1366x768-zoom100.png) |
| 1280×720 / 100%                 | [PNG](passport-en-dark-1280x720-zoom100.png) | [PNG](passport-en-light-1280x720-zoom100.png) | [PNG](passport-zh-CN-dark-1280x720-zoom100.png) | [PNG](passport-zh-CN-light-1280x720-zoom100.png) | [PNG](passport-zh-TW-dark-1280x720-zoom100.png) | [PNG](passport-zh-TW-light-1280x720-zoom100.png) |
| 1024×768 / 100%                 | [PNG](passport-en-dark-1024x768-zoom100.png) | [PNG](passport-en-light-1024x768-zoom100.png) | [PNG](passport-zh-CN-dark-1024x768-zoom100.png) | [PNG](passport-zh-CN-light-1024x768-zoom100.png) | [PNG](passport-zh-TW-dark-1024x768-zoom100.png) | [PNG](passport-zh-TW-light-1024x768-zoom100.png) |
| 761×900 / 100%                  | [PNG](passport-en-dark-761x900-zoom100.png)  | [PNG](passport-en-light-761x900-zoom100.png)  | [PNG](passport-zh-CN-dark-761x900-zoom100.png)  | [PNG](passport-zh-CN-light-761x900-zoom100.png)  | [PNG](passport-zh-TW-dark-761x900-zoom100.png)  | [PNG](passport-zh-TW-light-761x900-zoom100.png)  |
| 1646×928 / 125%                 | [PNG](passport-en-dark-1646x928-zoom125.png) | [PNG](passport-en-light-1646x928-zoom125.png) | [PNG](passport-zh-CN-dark-1646x928-zoom125.png) | [PNG](passport-zh-CN-light-1646x928-zoom125.png) | [PNG](passport-zh-TW-dark-1646x928-zoom125.png) | [PNG](passport-zh-TW-light-1646x928-zoom125.png) |
| 1440×900 / 125%                 | [PNG](passport-en-dark-1440x900-zoom125.png) | [PNG](passport-en-light-1440x900-zoom125.png) | [PNG](passport-zh-CN-dark-1440x900-zoom125.png) | [PNG](passport-zh-CN-light-1440x900-zoom125.png) | [PNG](passport-zh-TW-dark-1440x900-zoom125.png) | [PNG](passport-zh-TW-light-1440x900-zoom125.png) |
| 1366×768 / 125%                 | [PNG](passport-en-dark-1366x768-zoom125.png) | [PNG](passport-en-light-1366x768-zoom125.png) | [PNG](passport-zh-CN-dark-1366x768-zoom125.png) | [PNG](passport-zh-CN-light-1366x768-zoom125.png) | [PNG](passport-zh-TW-dark-1366x768-zoom125.png) | [PNG](passport-zh-TW-light-1366x768-zoom125.png) |
| 1280×720 / 125%                 | [PNG](passport-en-dark-1280x720-zoom125.png) | [PNG](passport-en-light-1280x720-zoom125.png) | [PNG](passport-zh-CN-dark-1280x720-zoom125.png) | [PNG](passport-zh-CN-light-1280x720-zoom125.png) | [PNG](passport-zh-TW-dark-1280x720-zoom125.png) | [PNG](passport-zh-TW-light-1280x720-zoom125.png) |
| 1024×768 / 125%                 | [PNG](passport-en-dark-1024x768-zoom125.png) | [PNG](passport-en-light-1024x768-zoom125.png) | [PNG](passport-zh-CN-dark-1024x768-zoom125.png) | [PNG](passport-zh-CN-light-1024x768-zoom125.png) | [PNG](passport-zh-TW-dark-1024x768-zoom125.png) | [PNG](passport-zh-TW-light-1024x768-zoom125.png) |
| 761×900 / 125%                  | [PNG](passport-en-dark-761x900-zoom125.png)  | [PNG](passport-en-light-761x900-zoom125.png)  | [PNG](passport-zh-CN-dark-761x900-zoom125.png)  | [PNG](passport-zh-CN-light-761x900-zoom125.png)  | [PNG](passport-zh-TW-dark-761x900-zoom125.png)  | [PNG](passport-zh-TW-light-761x900-zoom125.png)  |

At physical 761×900 and native 125%, CSS width is about 608.8px and the existing Mobile layout is expected. Desktop retains independent Archive scrolling, six KPIs, three Highlights above the existing ≤540px compact exception, and no right-side scrolling or Longest Flight map.

## Font and zoom findings

- The old zoom wait compared Mobile natural content height to `innerHeight`. The final 761px case carried Mobile geometry into the next locale/theme iteration. The helper now validates the actual CSS breakpoint, uses the fractional `visualViewport` for desktop height/bottom distance, and restores the desktop viewport before language/theme changes. No timeout/retry changes.
- CDN 4.3.1 declares separate Medium/Semibold families, all with weight 400. The loader maps complete native `@font-face` rules onto MiSans/MiSans TC at 400/500/600. Complete rule replacement supports Firefox’s read-only face descriptors. Native remote sources, `font-display: swap`, Unicode ranges and non-blocking load/failure handling are retained.
- Final font evidence includes six CSS groups, real WOFF2 responses and hashes, rendered Regular/Medium/Semibold PostScript faces with local font sources disabled, and one stylesheet request per locale/weight/profile. English retains Inter/system CSS. Inter’s local availability remains environment dependent.
- Narrow, short Desktop Chinese delay values use 1.25rem and keep units on one line. Normal 1440×900 typography is unchanged. Mixed numeric/unit text now participates in column bounds checks.

## Long city review

The extra synthetic archive uses actual ADD, JNB, EZE, AMS, CPT, LHR and CDG identities from the offline catalog. It has a separate complete 72-case geometry matrix and 18 representative PNGs; [browse its screenshot manifest](long-cities/browser-evidence.json). ADD→JNB verifies real long Chinese archive city names; ranking/Longest Flight retain full localized names with permitted wrapping.

An existing localization gap remains: the Archive city-group label for EZE/BUE falls back to `Buenos Aires` while ranking/Longest Flight use the Chinese airport city name. Archive city ellipsis is existing behavior and retains the full route title. This change does not alter city-group data or Mobile design.

## Validation boundaries

See [validation-results.json](validation-results.json) for exact runs, stages, source hashes, logs and failures. Earlier local full Firefox/WebKit runs had failures; their logs remain available. Final Task 2C focused results and remote CI must be read separately. The latest PR description records final pushed-HEAD CI; a previous commit’s success never validates a later commit.

All 14 checkpoint PNGs and the frozen Globe/solar sources and approved Control hash are preserved. No font binaries are committed. Project MIT, distribution-code Apache-2.0 and Xiaomi’s independent font license remain distinct.
