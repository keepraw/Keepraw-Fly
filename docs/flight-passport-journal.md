# Flight Passport digital travel journal

From Passport, choose **Share Flight Passport** to view the finished 1200 × 1600
PNG. The upper leaf retains the offline Equal Earth world map, real great-circle
routes, airport dots and paper texture. The lower leaf retains holder information,
flight statistics and the sewn binding. The viewer has no toolbar, second name
editor, saving instructions or disclaimer captions. The image remains a Blob-backed
`<img>` with native right-click / long-press saving. Click or Enter/Space enlarges;
Escape restores the whole photograph, then closes it. Clicking the backdrop also
closes it. Focus stays in the viewer and returns to the Passport share action.

Both leaves share the existing plane wordmark and a right-aligned localized page
title: route map on page 01 and holder profile on page 02. The map retains its
projection scale and full width beneath the header. Holder details use a fixed
grid: name and number, authority and first flight, then a full-width record period.
Names can occupy two grapheme-safe lines with one fitted font size; statistics
and coverage notes keep their existing positions below the grid.

## Existing data and settings

- Totals and map geometry still come from the full archive, independently of year,
  search and airport filters. Cancelled flights are excluded. Dense maps retain
  the busiest-60 selection and statistics retain all flights. Selection diagnostics
  remain in the model; the image no longer prints map coverage or legend captions.
- Distance, duration, flights, airports, airlines, countries and recorded route
  counts use the existing share statistics. Missing distance/time coverage notes
  describe those statistics inside the photograph.
- First flight and record period remain the earliest/latest non-cancelled service
  dates. They never become birth or expiry dates. Flight IDs, flight numbers,
  bookings, tickets, memberships, seats and airport labels remain excluded.
- Holder names come from `document.profile.name`, the same archive-backed data
  edited in Settings. The photograph respects `primary`, with the existing native
  or romanized value as fallback. MRZ prefers the saved `romanized` value.
- The schema has one unstructured name, not separate surname/given-name fields.
  An explicit comma follows ICAO's primary/secondary convention (`ERIKSSON, ANNA
MARIA` → `ERIKSSON<<ANNA<MARIA`). Without a comma the whole saved name is the
  primary identifier, as allowed by Part 3 §3.4; surname order is never guessed.
- No existing pinyin converter was present. When romanization is absent, Han
  characters use pinned `pinyin-pro` 3.29.5 with surname-at-head pronunciation and
  no tones. Original settings are untouched. Automatic pinyin is deterministic,
  but is not a verified passport spelling; a saved romanized name always wins.
  Latin diacritics and special letters are transliterated under Part 3 §6.A.
- Empty names, unsupported scripts or an unencodable primary identifier yield a
  39-filler name field and a machine-readable `missing-name` or
  `name-needs-romanization` issue in `PosterCopy.mrzIssues`. They do **not** invent
  a holder. Such a result is incomplete specimen data, not a fully personalized
  ICAO passport. The existing Settings romanized field supplies the correction.

## Local identity and display number

`keepraw-fly.passport-profile.v1` remains backward compatible. Old `{name, number}`
records with a `KRF-` plus 16-hex-digit number migrate to `{name, id, number}`:

- `id` preserves the full old 64-bit local souvenir identity and its `KRF-` prefix.
  It is not a flight/archive ID or a machine-readable passport number.
- The displayed `number` is a deliberate nine-character base-36 design:
  `base36(BigInt(full 64-bit identity) mod 36^9)`, uppercase and left-padded with
  zeroes. It uses the complete old identity, not a truncated prefix or a different
  random value. The photograph and MRZ receive this exact same value.
- The old nickname remains stored verbatim for lossless migration, but Settings
  owns the displayed name. Migration never copies over or overwrites Settings.
- A new local identity is generated once with Web Crypto and persisted. Blocked
  storage retains it for the current session. Reopening, name edits, flight edits
  and reloads with persisted storage keep the number stable.
- The space is `36^9 = 101559956668416` values (about 46.5 bits). This fits a local
  keepsake with one active identity per browser origin; there is no central
  allocation or global uniqueness guarantee. Independent identities can collide.
  Clearing storage creates a new identity. This is not an identity system.

The older ICAO supplementary guidance also discusses long-number continuation in
optional data with a relocated check digit. This application's legacy `KRF-…`
value is an opaque souvenir identifier, not an issued passport number, so this
implementation deliberately selects the redesigned short-number option instead.
`buildTd3Mrz` rejects numbers longer than nine characters, punctuation and empty
numbers; it never silently truncates them, deletes their hyphens, or emits an
incomplete continuation. Any future actual long-number support requires its own
encoder and tests.

## TD3 encoding and explicit specimen policy

Normative sources checked:

- [ICAO Doc 9303 Part 3, eighth edition](https://www.icao.int/sites/default/files/publications/DocSeries/9303_p3_cons_en.pdf),
  §§3.4, 4.6–4.9, 5 and 6.A: name conventions, dates, codes, transliteration and
  check digits.
- [ICAO Doc 9303 Part 4, eighth edition, amendments through 20 February 2026](https://www.icao.int/sites/default/files/publications/DocSeries/9303_p4_cons_en.pdf),
  §§4.2.2–4.2.4 and 4.4, Appendix A: TD3 fields, truncation, checks and document
  codes. The current ordinary specimen uses `PP`, including the harmonized
  secondary document code, rather than arbitrarily choosing a second letter.
- [ICAO supplement, release 14](https://www.icao.int/security/mrtd/downloads/supplements%20to%20doc%209303/supplement%20to%20icao%20doc%209303%20-%20release_14.pdf):
  historical long-number continuation discussion.

`td3-mrz.ts` builds two lines of exactly 44 characters. Line 1 contains `PP`, the
three-letter specimen issuer and a 39-character name field. Names use `<` within
components and `<<` between explicit primary/secondary identifiers. Long names
follow Part 4 truncation rules, reserving a secondary initial when present and
ending a truncated field in a letter.

Line 2 contains the 9-character number and its check, nationality, six-character
birth date and check, sex, six-character expiry and check, 14-character optional
data and check, then the composite check. The algorithm assigns 0–9 to digits,
10–35 to A–Z and zero to `<`; weights 7, 3, 1 repeat from the left and the weighted
sum is reduced modulo 10. The composite checks concatenated positions 1–10,
14–20 and 22–43, with continuous weights across the concatenation. Empty optional
data uses 14 fillers and numeric check `0`.

The project schema stores **no** birth date, nationality, sex or document expiry.
`SOUVENIR_TD3` declares the product's specimen policy, independently of flights:

| Field             | Value         | Meaning/source                                                                        |
| ----------------- | ------------- | ------------------------------------------------------------------------------------- |
| Issuing code      | `UTO`         | ICAO's fictional Utopia specimen code, not an actual Keepraw issuing-state allocation |
| Visible authority | `KEEPRAW FLY` | Product authority for the souvenir only                                               |
| Nationality       | `XXX`         | Unspecified nationality code, not an assertion of citizenship or statelessness        |
| Birth date        | `<<<<<<`      | Unknown birth date under Part 3 §4.8; check digit `0`                                 |
| Sex               | `<`           | Unspecified under Part 4 §4.2.2.2                                                     |
| Expiry            | `491231`      | Product-defined fixed souvenir end date, 2049-12-31; **not** a user date              |
| Optional data     | 14 fillers    | No personal number collected or inferred                                              |

ICAO's unknown-birth-date permission does not authorize an unknown expiry date.
The encoder therefore requires an explicit valid expiry; it rejects `<<<<<<`.
The declared fixed souvenir date avoids fabricating a personal fact or inferring
one from the first flight. The specimen issuer, unspecified fields, automatic
pinyin and fixed expiry remain explicit issues in `PosterCopy.mrzIssues`.

This implements TD3 data layout and checks. It does **not** issue a real travel
credential, establish legal authority, or certify full document compliance.
Empty/unencodable names remain an explicit compatibility limitation. No bundled
OCR-B font exists: the renderer measures the existing monospace stack, starts at
30 canvas units and adds uniform tracking to centre both complete lines at 90%
of the content width. Both rows share their size, origin and baseline spacing.
A Canvas tracking probe selects native letter spacing or explicit equal-width
glyph positions when tracking is absent or ineffective. Only drawing changes;
the encoder's characters, fields and checks remain unchanged.
Physical OCR-B printing, dimensions and optical certification are outside this
PNG keepsake's scope. No new UI disclaimers or captions are drawn.

## Automated verification

- `td3-mrz.test.ts` reproduces the official Part 4 Appendix A 2026 Eriksson
  specimen exactly, including all five check digits, then independently
  recomputes every check with a separate implementation. Tests cover field
  positions, alphabets, lengths, long names/numbers, punctuation, Latin/Han and
  unsupported scripts, empty settings, missing personal data and determinism.
- Pinned `mrz` 5.0.2 is a development-only independent parser. Tests parse the
  official vector and generated souvenir with autocorrection disabled, checking
  names, numbers and all validation details. Its state table omits ICAO's `UTO`
  specimen code: tests explicitly expect only that code-table rejection (issuer
  and nationality in the official vector; issuer only in the souvenir). They do
  not rewrite the code, modify the parser table or claim `valid: true`.
- `passport-profile.test.ts` checks migration, preservation of the legacy name,
  stable display number, malformed/blocked storage and reload.
- `poster-data.test.ts` retains archive statistics, privacy and route coverage.
- `e2e/share-passport.pw.ts` exercises the real Canvas → PNG → Blob `<img>` flow,
  Settings edits, full-archive totals, native saving, focus, zoom, retry, blocked
  storage, DPR, dense maps and font failure. It checks 320–1440 px plus short
  landscape viewports; the locale/unit matrix verifies measured text boxes,
  aligned fields, both complete MRZ lines and absence of removed captions. The
  matrix also forces system fonts with long mixed-script names and emoji. MRZ
  tests inspect actual Canvas calls and ink bounds with native, absent and
  ineffective tracking, checking equal cell advances and 88–92% width occupancy.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint:css`, `pnpm check:css-tokens`,
`pnpm format:check`, `pnpm build` and
`pnpm exec playwright test e2e/share-passport.pw.ts --project=chromium`.
Browser tests may retain screenshots of actual generated output for diagnostics;
no design mockups or image-generation tools participate in implementation.
