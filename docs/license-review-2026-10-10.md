# Third-party license and provenance review — 2026-10-10

This is a source-and-documentation audit of the dependencies, fonts, imagery,
airline branding and offline datasets specifically identified for Task 4.
It describes what the repository actually uses on `main` at
[`3287cbcd40f8a8128bc7fa59d18fb08d51eedc44`](https://github.com/keepraw/Keepraw-Fly/tree/3287cbcd40f8a8128bc7fa59d18fb08d51eedc44)
and what source permissions remain unverified. It is **not legal advice,
an independent chain-of-title investigation, or a certification that every
transitive npm dependency and logo has been cleared**. See also the
[public third-party notices](../THIRD_PARTY_NOTICES.md).

No application code, font files, airline art, Globe visual settings or GitHub
Pages deployment workflow are modified by this review.

## Immediate Owner decisions

### 1. MiSans webfont CDN — permission unresolved (priority: high)

- **Actual usage:** `apps/web/src/typography/load-webfonts.ts` loads
  `misans-webfont@4.3.1` CSS and subsetted WOFF2 files from jsDelivr for
  Simplified and Traditional Chinese at weights 400/500/600. Keepraw Fly
  commits **no font binaries** and shows an attribution link in Settings.
- **Official permission:** Xiaomi's [MiSans license agreement](https://hyperos.mi.com/font/en/download/)
  and [FAQ](https://hyperos.mi.com/font/en/faq/) permit use in commercial
  products and embedded fonts, with an explicit notice in the software.
  The agreement separately restricts font adaptation, further distribution
  and redistribution of the font software and its components.
- **Upstream packaging:** [mobeicanyue/misans-webfont](https://github.com/mobeicanyue/misans-webfont)
  uses a font subsetting process. Its Apache-2.0 repository code license does
  **not** grant rights over Xiaomi's separately licensed font binaries.
  Its README also describes the project as intended for learning/exchange.
- **Gap:** No direct evidence was found of Xiaomi authorizing that publisher's
  specific subset creation and subsequent font-file redistribution by CDN.
  The fact that Keepraw Fly only links to a CDN does not settle that issue.
  This is **not a finding that Keepraw Fly has violated the license**; it is an
  unresolved permission and provenance question.
- **Owner choice before wider publicity:** Ask Xiaomi/the authorized rights
  holder to clarify permitted third-party WOFF2 subsetting and CDN delivery;
  alternatively use a font distribution explicitly licensed for that workflow
  or system-font fallback. Do not silently treat Apache-2.0 as covering the
  font. No font-loading behavior is changed in this PR.

### 2. Airline logos — independent artwork rights not verified (priority: high)

- **SVG source:** [Soaring Symbols](https://github.com/soaring-symbols/soaring-symbols)
  publishes under MIT; the text is retained in
  `apps/web/src/data/LICENSE.soaring-symbols`. The source explicitly says
  individual airline logos remain the property of their rights holders.
- **PNG source:** [imgmongelli/airlines-logos-dataset](https://github.com/imgmongelli/airlines-logos-dataset)
  describes its repository as MIT in its README. The source revision and
  credits are in `apps/web/src/data/NOTICE.airlines-logos-dataset.md`.
  **408** source PNG files under `assets/airlines/` have **408** byte-identical
  served counterparts under `apps/web/public/assets/airlines/` (Git blob
  hashes compared on the audited commit).
- **Gap:** These repo-level MIT claims are not proof of per-airline copyright,
  logo redistribution or trademark rights. Nominative use for carrier
  identification and distribution of image files are different legal
  questions; the latter has not been cleared for all files.
- **Owner choice:** Before branding-focused marketing or large-scale public
  redistribution, assess the provenance and permitted use of logos, seek
  permission where necessary, or replace/remove uncertain images. Existing
  fallback to the airline designator helps if future removal is chosen.
  This review does not change, delete or relicense any logo.

## Reviewed sources with traceable notices

### Keepraw Fly project license and marks

- `LICENSE` is **MIT**, copyright 2026 Keepraw Fly contributors.
  It governs original project software/documentation subject to third-party
  rights and notice obligations; it does not transfer ownership of external
  fonts, imagery, data or carrier marks.
- `TRADEMARK.md` reserves project names and identifiers separately from the
  software license. This notice should not be mistaken for proof of trademark
  registration or exclusive rights in every jurisdiction.

### Three.js — production runtime, MIT

- `apps/web/package.json` declares `three` `^0.186.1`. The
  `apps/web/src/globe/globe-renderer.ts` production module imports Three.js,
  OrbitControls, Line2, LineGeometry and LineMaterial, and
  `PassportGlobe.tsx` mounts the production globe.
- The current [Three.js MIT license](https://threejs.org/license/) matches
  the retained `apps/web/src/globe/LICENSE.three` notice.
- **Correction:** Three.js is not confined to the development Globe Lab.
  The released application's browser build contains it in the lazy Globe
  chunk. This licensing review changes documentation, not the bundle.

### NASA daytime and nighttime globe textures — NASA media guidelines

- **Daytime:** NASA Earth Observatory **Blue Marble Next Generation,
  July 2004**, credit **Reto Stöckli**. Provenance, original SHA-256,
  derived 2048/4096 WebP dimensions and generator are recorded in
  `apps/web/src/globe/globe-texture.source.json`.
- **Nighttime:** NASA Earth Observatory **Earth at Night / Black Marble
  2016**, **Joshua Stevens**, using **Suomi NPP VIIRS** data from
  **Miguel Román / NASA GSFC**. Source/asset SHA-256 values, dimensions,
  process and generator are in
  `apps/web/src/globe/globe-night-texture.source.json`.
- Both asset pairs are imported directly by production
  `apps/web/src/globe/globe-renderer.ts`, not only by Globe Lab.
- NASA's [Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
  generally cover informational web and 3D simulation uses, including
  texture maps, require appropriate acknowledgment, and prohibit implied
  NASA sponsorship or endorsement. Material belonging to identified
  third parties and commercial/promotion-specific use may require more
  checks. No NASA insignia or identifiable people appear in these source
  textures according to the recorded source metadata. **Do not call this
  a blanket NASA MIT license or claim NASA approved the product.**

### Offline airport and airline datasets

- `mborsetti/airportsdata`: **MIT**, pinned input revision
  `d306f66b5c33617e0bc13d413fea07292a5d9211` and 7,884 airport
  records in `packages/core/data/airports.source.json`; the copy of
  `LICENSE.airportsdata` also acknowledges upstream `mwgg/Airports`.
  [Original repository](https://github.com/mborsetti/airportsdata).
- Wikidata structured data: **CC0 1.0**, covering the checked-in airline
  code/name data and airport localization overlay, with retrieval metadata
  in `packages/core/data/airlines.source.json` and
  `packages/core/data/airport-locales.source.json`.
  [Wikidata's licensing policy](https://www.wikidata.org/wiki/Wikidata:Licensing)
  differentiates CC0 structured data from other site content. CC0 does
  not waive airlines' trademark rights in logos and names.

### Natural Earth, d3-geo and OpenCC.js

- **Natural Earth Vector** 1:110m (v5.1.2): public domain under
  [Natural Earth's terms](https://www.naturalearthdata.com/about/terms-of-use/).
  Source SHA-256 and attribution terms are retained in
  `apps/web/src/data/world-map.source.json` and
  `apps/web/src/data/LICENSE.natural-earth`.
- **d3-geo 3.1.1** and bundled **d3-array 3.2.4** and **internmap 2.0.3**:
  ISC, with the appropriate files in `apps/web/src/data/`. The
  `LICENSE.d3-geo` copy also contains an upstream GeographicLib MIT
  notice; preserve the full combined text.
- **OpenCC.js 1.4.2**: the root `package.json` specifies the exact version;
  the [npm package](https://www.npmjs.com/package/opencc-js) is marked
  **MIT AND Apache-2.0**, including bundled Apache-licensed dictionary
  derivatives. The package is a build/development tool for Chinese
  localization generation and is not served in the browser application.
  The old notices incorrectly said `1.4.1` and Apache-2.0 only.

## Evidence cleanup and historical PR status

- PRs [#33](https://github.com/keepraw/Keepraw-Fly/pull/33),
  [#34](https://github.com/keepraw/Keepraw-Fly/pull/34),
  [#35](https://github.com/keepraw/Keepraw-Fly/pull/35) and
  [#36](https://github.com/keepraw/Keepraw-Fly/pull/36) are merged.
- The approved six Globe Control screenshots, four Task 2C representatives
  and twelve Task 3 representatives are retained. The superseded 161 PNGs
  were removed by PR #36. See
  [Task 4 screenshot cleanup](visual-review/CLEANUP-2026-10-10.md).
- `docs/visual-review/task-3/SCREENSHOTS.md` and the resumed Task 2C
  screenshot index were updated in PR #36. The original browser JSON
  manifests still contain historic screenshot identifiers, not promises
  that every file remains checked out.
- Earlier milestone handoff documents preserve their original validation
  chronology; outstanding merge/publish warnings are historical, not
  instructions to merge already-completed PRs.

## Boundaries of this review

This is not an exhaustive software-bill-of-materials investigation of every
transitive npm package, a warranty of worldwide asset rights, or a substitute
for rights-holder or legal confirmation. This change does **not** enable
GitHub Pages deployment or perform release actions. A future license or
branding decision should be a separate, Owner-approved change.
