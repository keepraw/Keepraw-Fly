# Flight Passport digital travel journal

From Passport, choose **Share Flight Passport** to open the souvenir booklet.
The 1200 × 1600 PNG always contains a travel record leaf above a holder leaf,
with a horizontal sewn binding between them. Both light and dark app themes use
cool ivory paper, deep space navy ink, steel/glacier blue maps and restrained
champagne details. Right-click or long-press the image to
save it. It is a fictional KEEPRAW FLY keepsake, not an identity or travel document.

## Data and local identity

- The record leaf uses the existing offline Equal Earth map and real great-circle
  routes from the complete archive. Year, search and airport filters do not affect
  this souvenir. Cancelled records are excluded. Dense maps retain the existing
  busiest-60 selection; the map coverage label compares displayed routes with all
  **Recorded routes**, including pairs with missing coordinates.
- Distance, reliable duration, flights, airports, airlines and countries use the
  existing share statistics. Routes count all recorded airport pairs with opposite
  directions merged, including pairs without coordinates; the map retains its
  separate count of drawable pairs. Unknown distance/time
  coverage remains visible.
- First flight and record period are the earliest and latest non-cancelled service
  dates, without timezone conversion. Only those two date boundaries are added
  to the image model. Flight IDs, flight numbers, bookings, tickets, memberships,
  seats, airport labels and other flight metadata remain excluded.
- **Edit name** accepts a travel nickname of up to 32 Unicode graphemes. No real
  identity details are required. The default holder label is localized.
- `keepraw-fly.passport-profile.v1` in localStorage holds only `{ name, number }`.
  `KRF-` plus 64 random bits is generated once with Web Crypto and reused across
  reopening, reloads, nickname edits and archive changes. It is unrelated to any
  internal identifier. Other tabs observe profile updates through storage events.
- The profile does not enter the IndexedDB archive, JSON/CSV export, import or
  flight editing paths. Clearing site storage removes it; changing browser or
  origin creates a separate souvenir identity. Back up the PNG to keep a copy.
- If local saving fails, the journal explains that persistence is unavailable;
  the generated number stays stable for the current app session. Failed name
  saves keep the editor open with an error and can be retried.

The footer contains exactly two equal-length, monospaced decorative character
lines, derived from the fictional brand, local souvenir number and archive counts.
Periods, tildes, spaces and `/` deliberately exclude ICAO machine-readable document
syntax. No check digits or official country codes are generated. The localized
souvenir disclaimer appears discreetly beneath the image, outside the character area.

Click the image or focus it and press Enter/Space to enlarge it to its native
1200 × 1600 resolution. Scroll, swipe or use the focused region’s arrow keys to
move around. Zoom out uses a 900 × 1200 reading size; Fit to screen and Exit
enlarged view restore the complete booklet. Escape first returns to fit, then
closes the dialog and restores focus to Share Flight Passport. Image context
menus, long-press saving and the Blob URL remain native in every view.

All Canvas field labels, notes and statistics use the existing i18n resources
in all ten supported locales, including regional English fallback. Text uses
actual Canvas measurements: concise labels fit one line where practical and
long names split at measured grapheme boundaries without clipping.

## Rendering and verification

`poster-layout.ts` defines separate record, binding and holder rectangles.
`poster-render.ts` paints each paper leaf independently before drawing the hinge;
there is no source-image slicing or DOM screenshot. Preview and PNG use the same
Canvas 2D renderer and existing locale font preparation. The finished preview is
still a Blob-backed `<img>`, preserving native image saving. Blob URLs are released
when replaced or closed. No UI framework or runtime dependency was added.

Run `pnpm dev` to preview, import an existing archive or use the demo, open Passport,
then choose Share Flight Passport. Check the book at 320, 390, 760, 761 and 1440 px
and in a short landscape viewport. Edit the nickname, close/reopen and reload;
confirm the number persists and the flight archive is unchanged. Save the image
and inspect both leaves, dates, route coverage and the entire binding.

Automated coverage lives in `e2e/share-passport.pw.ts`,
`e2e-csp/content-security-policy.pw.ts`, `poster-data.test.ts` and
`passport-profile.test.ts`. It checks real totals, independent leaf geometry,
all released locales, long Unicode names, both distance units, DPR, dense maps,
font/storage/export failure, retry, native save/focus and Blob revocation.
The share E2E retains full PNG and viewport captures in Playwright's test output;
CI uploads them with its Chromium diagnostics. Fresh manual captures belong under
ignored `artifacts/`, not the historical approved visual references.
