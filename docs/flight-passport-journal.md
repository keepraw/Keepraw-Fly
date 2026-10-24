# Flight Passport digital travel journal

From Passport, choose **Share Flight Passport** to view the finished 1200 × 1684
PNG. The upper leaf retains the offline Equal Earth world map, real great-circle
routes, airport dots and paper texture. The lower leaf retains holder information,
flight statistics and the sewn binding. The viewer has no toolbar, second name
editor, saving instructions or disclaimer captions. The image remains a Blob-backed
`<img>` with native right-click / long-press saving. Click or Enter/Space enlarges;
Escape restores the whole photograph, then closes it. Clicking the backdrop also
closes it. Focus stays in the viewer and returns to the Passport share action.

Both leaves share the existing plane wordmark and a right-aligned localized page
title: route map on page 01 and holder profile on page 02. The map is framed on
the recorded geography beneath the header (see Route map framing). Holder details
use a fixed grid: name and number, then a single metadata row for authority,
first flight and record period. Names can occupy two grapheme-safe lines with one
fitted font size. The number keeps the metadata fields' label → value cadence
(one rhythm step deeper for the larger name), so its cap height lines up with the
top of the name instead of sinking to the name's baseline. A shared eight-unit
rhythm and one 56-unit section gap (last baseline → next label baseline) separate
the heading, identity (after the name's reserved second line), metadata and
statistics. The six secondary statistics use equal columns and a 104-unit row
pitch, with measured ink clearance between first-row figures and second-row
captions; the grid runs down to the fixed machine-readable zone with no caption
row beneath it. Small field and statistic labels use a `label` ink one step
darker than `muted`; the distance label keeps its gold accent.

## Route map framing

`posterMapFrame` fits the map to every plottable airport and every sampled
great-circle point (the same sampling as the drawn polylines, so a long route's
bulge is never cut), projected with Equal Earth around the existing
`posterCenterLongitude`. The box is fitted into the map rectangle with a uniform
48-unit margin and one scale on both axes. A 45° minimum span keeps one or two
short hops from being over-magnified, and a world-spanning archive keeps at least
the whole-world scale. With nothing plottable the frame falls back to the whole
inhabited world (83° N … 57° S). The frame slides toward the inhabited band
without ever cutting content; the visible area is clipped to the rectangle and
that band, with feathered edges. Seam splitting is unchanged, so no route
draws across the map. The same offline world geometry is used: no new map asset,
tiles or service. Route core lines have a 1.8-unit width and 0.35 opacity floor,
and airport dots a 3.6-unit minimum radius with 1.8-unit strokes, so routes stay
individually legible in 480-pixel previews.

## Existing data and settings

- Totals and map geometry still come from the full archive, independently of year,
  search and airport filters. Cancelled flights are excluded. Dense maps retain
  the busiest-60 selection and statistics retain all flights. Selection diagnostics
  remain in the model; the image no longer prints map coverage or legend captions.
- Distance, duration, flights, airports, airlines, countries and recorded route
  counts use the existing share statistics. The photograph prints no coverage
  caption: totals are not qualified even when some flights lack a distance or a
  time (deliberate product decision). The poster model no longer carries the
  known/unknown counts; the 3A share model keeps them for its own renderer.
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
Empty/unencodable names remain an explicit compatibility limitation.

## TD3 page and print geometry

`poster-layout.ts` centralizes the physical references and book geometry. A leaf
is 1136 × 800 design units, derived by rounding 88/125 of its width (ratio 1.42,
within 0.04% of nominal TD3). Two equal leaves, a 32-unit binding and 26-unit
outer top/bottom margins derive the 1200 × 1684 integer PNG. The frame inset is
24 units; glyph ink stays inside a further 16-unit print margin. Both leaves
share these margins, header offset and binding relationship. The map rectangle
is derived from leaf height; framing keeps one uniform projection scale on both
axes.
The native image viewer and zoom sizes use the same artboard dimensions through
CSSOM custom properties, with no separate CSS aspect-ratio constant.

The nominal MRZ spans the final 23.2 mm of the 88 mm leaf (210.84 units, 26.36%).
Figure 3 and Part 4 §4.2.1.3 place its first character 6 mm from the paper's left
edge; the 114 mm reference arrangement is independent of the statistics columns.
IBM Plex Mono at 36 units uses a fixed 2.54 mm pitch (23.08352 units, 10 cpi),
with only the small gap between its natural advance and that pitch. The complete
44-character rows occupy approximately 89% of the leaf width within the 91.2%
reference arrangement. No content-column centring or fill-to-width tracking is
used. The upper baseline is 13.6 mm from the bottom, with 6.35 mm between rows:
approximately Y=1534.4 and 1592.1 in the exported artboard. Both rows have ample
clearance above the Y=1634 paper frame.

The full reference MRZ height fits without reducing the statistics row spacing:
a single metadata row reclaims room from the former stacked fields. Labels and
ordinary values share one baseline gap; long names retain their reserved second
line. Serif distance figures remain the main statistic, with smaller serif figures
and lighter units in the three-column/two-row grid. No rectangular MRZ wash is
drawn. Security curves fade continuously to very faint ink, and the separator is
a quiet hairline. No official marks or credential fields are added.

Native Canvas tracking is probed, with explicit cell positions when tracking is
absent or ineffective. Export validates actual ink bearings and paper print
boundaries as well as the outer safe area. Encoding, fields, checks and souvenir
policy remain unchanged. The references guide this digital keepsake's appearance;
the IBM Plex glyphs and decorative page frame do not establish physical OCR
conformance.
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
- `poster-data.test.ts` retains archive statistics, privacy and route coverage,
  plus route framing: world fallback, East Asia plus South Asia coverage above
  55% with uniform margins, great-circle bulges, the minimum span and seam splits.
- `poster-layout.test.ts` verifies equal TD3 leaves, derived canvas/binding/frame
  geometry, the paper-relative MRZ arrangement, shared metadata baselines and
  separated layout regions, the shared section gap, the number's cap alignment and
  the clearance above the MRZ rule. Browser checks measure actual label/value gaps and
  at least 24 units between statistics rows, including units and fallback faces.
- `e2e/share-passport.pw.ts` exercises the real Canvas → PNG → Blob `<img>` flow,
  Settings edits, full-archive totals, native saving, focus, zoom, retry, blocked
  storage, DPR, dense maps and font failure. It checks 320–1440 px plus short
  landscape viewports; the locale/unit matrix verifies measured text boxes,
  aligned fields, both complete MRZ lines and absence of removed captions. The
  matrix also forces system fonts with long mixed-script names and emoji. MRZ
  tests inspect actual Canvas calls and ink bounds with native, absent and
  ineffective tracking, checking fixed cell advances, paper margins and separator clearance.
- Additional font journeys load every role before measuring, decode the PNG and
  compare its pixels with the preview renderer. They exercise Chinese, English,
  Traditional Chinese, Japanese, Korean, accented/long names, missing names and
  missing distances/times without any coverage caption. A framing journey renders
  the fixture, an East Asia plus South Asia archive, and complete/incomplete
  archives, asserting the drawn route/airport box exceeds 55% of the map width
  and stays inside the visible map. Aborted font requests and retry after a timeout keep an
  already resolved fallback render pixel-identical. Production CSP tests check
  real font loading, native stylesheet SRI rejection and unchanged MiSans UI fonts.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint:css`, `pnpm check:css-tokens`,
`pnpm format:check`, `pnpm build` and
`pnpm exec playwright test e2e/share-passport.pw.ts --project=chromium`.
Browser tests attach actual generated PNGs to the Playwright report for visual review;
no design mockups or image-generation tools participate in implementation.

## Passport font loading

`poster-fonts.ts` owns five Canvas roles: display/name (500), field text/labels
(400), serif figures (400), brand (600) and monospace MRZ (400). Latin roles use
IBM Plex Serif, IBM Plex Sans, Barlow Semi Condensed and IBM Plex Mono. Chinese
labels have no added tracking; Latin labels use modest tracking. Large distance
figures retain serif numerals. Names fit by width, including two complete lines;
accented capitals also have room below their labels.

Simplified Chinese display text uses Source Han Serif SC Medium; labels use
Source Han Sans SC Regular. Traditional Chinese, Japanese and Korean use their
regional Noto Serif/Sans CJK counterparts from the same Adobe/Google typeface
project. The locale determines Han forms; native names in a Latin UI also trigger
CJK loading, with kana/Hangul selecting Japanese/Korean. Mixed-script names can
request additional regional faces. All faces register under private `KRF …`
names, so no website font stack or MiSans loading code changes.

The ten bundled Latin/Latin Extended WOFF2 assets total 175332 bytes (~171 KiB).
Their URLs are emitted by Vite, but FontFace loading happens only for passport
preparation. CJK fonts remain remote, Unicode-range subsetted, version-pinned
and SHA-384 SRI checked at the existing jsDelivr origin. No full CJK binaries,
new dependency or new CSP origin is introduced. Only glyphs actually drawn
(including names, uppercase accents and notes) select subsets. The serif role
requests only title/name glyphs; the browser
HTTP cache reuses them, and per-document promises reuse local faces/stylesheets.
First-use CJK network cost depends on glyph coverage, typically hundreds of KiB
to a few MiB, rather than downloading an entire multi-megabyte typeface.

Preparation awaits the exact font roles used for measurement and drawing, with
a six-second bound. Failed roles use explicit regional serif/sans or monospace
system fallbacks; successful local Latin roles remain available if the CDN fails.
The returned family mapping excludes unfinished private faces and is fixed for
that render, even if requests finish later. A new export may retry failed loads.
Fallback CJK glyphs depend on fonts installed on the device; a complete font
network failure cannot guarantee identical glyph shapes across operating
systems. All fallback measurements still use exactly the families drawn.
Preview and PNG export consume the same prepared mapping and Canvas renderer.

OFL notices, pinned package sources, WOFF2 checksums and byte counts are in
`src/share/fonts/` (relative to `apps/web`). Stylesheet SRI covers CSS, with the
same limitation and pinned font URLs as existing MiSans. Use
`node scripts/verify-passport-fonts.mjs --remote` to independently verify all
eight CSS pins against jsDelivr and unpkg. CSP is unchanged.
