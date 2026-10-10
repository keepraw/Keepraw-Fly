# Task 2C — resumed review (historical evidence)

Task 2C was visually approved by the Owner and merged through PR #34. Its original verification covered 72 normal screenshots (six viewport sizes × three languages × two themes × native 100%/125% zoom), plus 18 long-city screenshots. The full PNG capture set is preserved in the [pre-cleanup Git snapshot](https://github.com/keepraw/Keepraw-Fly/tree/0bb6660d41605dbeb1da3bc3f15df5b56798aba8/docs/visual-review/task-2c/resume). The current checkout retains four representative images; redundant PNGs were removed in [Task 4 evidence cleanup](../../CLEANUP-2026-10-10.md).

[Validation record](validation-results.json) · [Complete browser/font evidence](browser-evidence.json) · [Long city evidence](long-cities/browser-evidence.json) · [Native zoom minimum reproduction](native-zoom-probe.json)

## Retained Task 2C images

- [Simplified Chinese Dark · 1440×900 · 100%](passport-zh-CN-dark-1440x900-zoom100.png)
- [Traditional Chinese Light · 1440×900 · 100%](passport-zh-TW-light-1440x900-zoom100.png)
- [Simplified Chinese Dark · 1646×928 · native 125%](passport-zh-CN-dark-1646x928-zoom125.png)
- [English Light · 1024×768 · native 125%](passport-en-light-1024x768-zoom125.png)

At physical 761×900 and native 125%, CSS width is about 608.8px and the existing Mobile layout is expected. Desktop retains independent Archive scrolling, six KPIs, three Highlights above the existing ≤540px compact exception, and no right-side scrolling or Longest Flight map.

## Font and zoom findings

- The old zoom wait compared Mobile natural content height to `innerHeight`. The final 761px case carried Mobile geometry into the next locale/theme iteration. The helper now validates the actual CSS breakpoint, uses the fractional `visualViewport` for desktop height/bottom distance, and restores the desktop viewport before language/theme changes. No timeout/retry changes.
- CDN 4.3.1 declares separate Medium/Semibold families, all with weight 400. The loader maps complete native `@font-face` rules onto MiSans/MiSans TC at 400/500/600. Complete rule replacement supports Firefox’s read-only face descriptors. Native remote sources, `font-display: swap`, Unicode ranges and non-blocking load/failure handling are retained.
- Final font evidence includes six CSS groups, real WOFF2 responses and hashes, rendered Regular/Medium/Semibold PostScript faces with local font sources disabled, and one stylesheet request per locale/weight/profile. English retains Inter/system CSS. Inter’s local availability remains environment dependent.
- Narrow, short Desktop Chinese delay values use 1.25rem and keep units on one line. Normal 1440×900 typography is unchanged. Mixed numeric/unit text now participates in column bounds checks.

## Long city review

The extra synthetic archive uses actual ADD, JNB, EZE, AMS, CPT, LHR and CDG identities from the offline catalog. It has a separate complete 72-case geometry matrix and 18 historical representative PNGs (retired from the checkout); [review its measurement and screenshot manifest](long-cities/browser-evidence.json). ADD→JNB verifies real long Chinese archive city names; ranking/Longest Flight retain full localized names with permitted wrapping.

An existing localization gap remains: the Archive city-group label for EZE/BUE falls back to `Buenos Aires` while ranking/Longest Flight use the Chinese airport city name. Archive city ellipsis is existing behavior and retains the full route title. This change does not alter city-group data or Mobile design.

## Validation boundaries

See [validation-results.json](validation-results.json) for exact runs, stages, source hashes, logs and failures. Earlier local full Firefox/WebKit runs had failures; their logs remain available. Final Task 2C focused results and remote CI must be read separately. The latest PR description records final pushed-HEAD CI; a previous commit’s success never validates a later commit.

The 14 earlier checkpoint PNGs were retired from the current checkout (recoverable at the pre-cleanup commit). The frozen Globe/solar sources and approved Control hash remain preserved. No font binaries are committed. Project MIT, distribution-code Apache-2.0 and Xiaomi’s independent font license remain distinct.
