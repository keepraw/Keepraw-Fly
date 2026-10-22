# Flight Passport digital travel journal

From Passport, choose **Share Flight Passport** to open the souvenir booklet.
The 1200 × 1600 PNG always contains a travel record leaf above a holder leaf,
with a horizontal sewn binding between them. Both light and dark app themes use
warm paper, navy ink and bronze details. Right-click or long-press the image to
save it. It is a fictional KEEPRAW FLY keepsake, not an identity or travel document.

## Data and local identity

- The record leaf uses the existing offline Equal Earth map and real great-circle
  routes from the complete archive. Year, search and airport filters do not affect
  this souvenir. Cancelled records are excluded. Dense maps retain the existing
  busiest-60 selection and its coverage label; totals still use the full archive.
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

The footer uses decorative journal text with spaces and `/`, deliberately outside
ICAO machine-readable document syntax. It contains no check digits or official
state/emblem. A readable souvenir disclaimer is printed on the holder leaf.

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
