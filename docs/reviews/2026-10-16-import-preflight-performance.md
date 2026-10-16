# CSV and Flighty preflight performance (P2-2)

Baseline: `2338fa63724bc5d907a88518ccba931719479adb` (latest main when work started, including PR #67). This addresses P2-2 from the audit in PR #63.

## Cause and changes

Each offset-free timestamp scans all 113 quarter-hour offsets from -14:00 to +14:00. Previously, each candidate constructed an `Intl.DateTimeFormat`, although its configuration depended only on the airport timezone. CSV also formatted the scheduled departure twice, and timezone validation created another formatter for every timestamp. Flighty uses the same CSV conversion pipeline.

Reuse the fixed formatter configuration by timezone, with a FIFO limit of 128 entries and no caching of invalid zones. Reuse the departure's local parts and pass numeric instants to candidate formatting instead of allocating a `Date` for each candidate. The candidate range, DST gap/overlap detection, explicit instants, minute precision, validation order, diagnostics and duplicate matching rules remain unchanged.

Formatter reuse alone reduced the 500-row Chromium synchronous median from 6,018.7 ms to 370.5 ms (93.8%). That still blocks interaction long enough to justify cooperative batches. Both import controls now run the same row and duplicate-assessment generators with an 8 ms work budget between timer yields. The synchronous APIs drain those same generators, so there is one implementation of the validation and matching rules. Flighty mapping also yields between rows. No worker, dependency or duplicate index was introduced.

The preview shows a localized checking state and disables confirmation until the complete result is ready. Changing the file, CSV mapping or archive snapshot invalidates the previous result immediately. Cancellation, replacement and unmount abort unfinished work; late results cannot update the preview. A fresh generator per effect also supports React Strict Mode's effect replay.

## Comparable measurements

Measured on 2026-10-16 in one Linux x64 cloud workspace: AMD EPYC 9V74, 5 exposed logical CPUs, Node 24.19.0, headless system Chromium 154.0.8037.57, no CPU throttling. Installed Vite 8.3.3 serves source modules; this is a function benchmark, not a production page-load or rendering benchmark. Dependencies and runtime were unchanged between baseline and optimized measurements. No concurrent test suite ran during the measurements.

The benchmark creates 100/500 valid rows with unique flight numbers and dates starting 2024-01-01, JFK to LAX, local scheduled times 09:00/12:00, no actual times and no existing flights. Unique timestamps prevent repeated-input memoization from skewing the results; the dates cross DST transitions. Parsing, module loading and mapping detection are outside the timer; row conversion and duplicate assessment are included. IDs use a deterministic incrementing factory. Each case has one warm-up and three measured runs; the table reports medians.

| Runtime / execution       | Rows |              Baseline ms | Optimized ms | Reduction |
| ------------------------- | ---: | -----------------------: | -----------: | --------: |
| Node, synchronous         |  100 |                  1,133.8 |         77.6 |     93.2% |
| Node, synchronous         |  500 |                  6,118.0 |        343.9 |     94.4% |
| Chromium, synchronous     |  100 |                  1,159.1 |         69.8 |     94.0% |
| Chromium, synchronous     |  500 |                  6,018.7 |        344.1 |     94.3% |
| Chromium, UI batch runner |  100 | 1,159.1 (synchronous UI) |        106.2 |     90.8% |
| Chromium, UI batch runner |  500 | 6,018.7 (synchronous UI) |        560.5 |     90.7% |

Measured samples in ms:

| Case         | Baseline                    | Optimized synchronous | Optimized batched     |
| ------------ | --------------------------- | --------------------- | --------------------- |
| Node 100     | 1,133.8 / 1,051.2 / 1,176.2 | 83.5 / 77.1 / 77.6    | —                     |
| Node 500     | 6,118.0 / 6,128.2 / 5,760.1 | 377.1 / 343.9 / 339.6 | —                     |
| Chromium 100 | 1,383.5 / 1,155.6 / 1,159.1 | 68.5 / 69.8 / 71.3    | 106.2 / 105.0 / 106.6 |
| Chromium 500 | 5,843.3 / 6,018.7 / 6,528.1 | 336.0 / 345.2 / 344.1 | 560.5 / 587.3 / 535.2 |

A zero-delay interval ran alongside the batched browser calls. All measured 100-row runs allowed 17 timer callbacks, with a maximum observed timer gap of 12.3 ms. The 500-row runs allowed 83–92 callbacks, with maximum gaps of 13.1 / 12.4 / 16.1 ms. This is an event-loop responsiveness probe, not a guarantee of frame rate or a hard execution deadline. Previously the synchronous calls occupied the main thread for their entire duration. Timer yields add elapsed time compared with the optimized synchronous calls while allowing input and rendering between slices.

Reproduce from the repository root with dependencies and a Playwright Chromium browser installed (or set `PLAYWRIGHT_EXECUTABLE_PATH`):

```sh
node scripts/benchmark-import-preflight.mjs
```

Port 5173 must be free. To remeasure the baseline, copy this script into a clean checkout of the baseline commit with the same dependencies and runtime. The script detects the absence of the batch API and reports synchronous timings only. It asserts that every fixture can import and that every row is new; it does not enforce machine-dependent timing thresholds in CI.

## Regression coverage and limits

Focused tests cover formatter constructor counts across 100 distinct four-timestamp rows, identical synchronous/batched CSV and Flighty results, both explicit DST overlap instants, seconds truncation, exact/possible duplicates, invalid rows, warning/source-line preservation, scheduling and cancellation. Existing PR #67 CSV/Flighty/editor tests and duplicate-detection tests remain in the targeted validation. Browser regressions exercise cancellation during processing, disabled confirmation, replacement and CSV mapping invalidation in all three CI browser engines.

Local validation is limited to these targeted unit tests, web type checking, changed-file formatting, documentation consistency, whitespace checks and this benchmark. Full unit tests, production build and browser journeys run in GitHub Actions.

An individual row and an individual duplicate lookup are indivisible; 8 ms is a cooperative budget, not a hard upper bound. Very large existing archives can still make one linear duplicate lookup expensive, and CSV text parsing remains synchronous. Extremely large files, slow/mobile devices, many-zone formatter churn and production rendering were not benchmarked here. These limits do not justify changing matching rules or the exhaustive timezone checks in this performance fix.
