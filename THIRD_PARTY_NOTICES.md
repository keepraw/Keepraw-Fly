# Third-party notices

Keepraw Fly's [MIT License](LICENSE) covers its own source code, not automatically
all third-party fonts, source imagery, datasets or airline marks. The notices
below describe actual development and production usage, and do not certify
third-party ownership or grant rights beyond the original terms. See the
[2026-10-10 license review](docs/license-review-2026-10-10.md) for source checks,
remaining permission questions and Owner decisions.

## MiSans / MiSans TC webfonts

Chinese UI typography uses **MiSans** (Simplified Chinese) and **MiSans TC**
(Traditional Chinese), copyright Xiaomi. The fonts remain subject to Xiaomi's
independent font license; see the [official font site](https://hyperos.mi.com/font/zh/)
and [official font license](https://hyperos.mi.com/font-download/MiSans字体知识产权许可协议.pdf).
They are not licensed under Keepraw Fly's MIT License or Apache-2.0.

The currently configured third-party distribution is
[mobeicanyue/misans-webfont](https://github.com/mobeicanyue/misans-webfont),
fixed at **4.3.1**. That project's distribution code uses
[Apache License 2.0](https://github.com/mobeicanyue/misans-webfont/blob/main/LICENSE);
this does not relicense Xiaomi's font files. The owner's originally specified
`4.003.1` returned 404 and was corrected to the published `4.3.1` with explicit
owner approval.

The viewer loads only the active Chinese locale's Regular (400), Medium (500)
and Semibold (600) CSS from `https://cdn.jsdelivr.net/npm/misans-webfont@4.3.1/`.
Those stylesheets use `font-display: swap` and `unicode-range` WOFF2 subsets.
English retains the existing Inter/system font stack and does not initiate
Chinese font downloads. No font binary is repackaged or committed here. The CSS points to
third-party-produced, subsetted WOFF2 files, served directly by jsDelivr.

Xiaomi's [official FAQ](https://hyperos.mi.com/font/en/faq/) permits commercial
and embedded font use with attribution; its [font agreement](https://hyperos.mi.com/font/en/download/)
separately prohibits unauthorized font adaptation and redistribution. The
upstream webfont package describes its subsetting process and is not evidence
that Xiaomi has authorized its publisher to repackage and redistribute font
binaries. We have not verified that separate permission. **The legal status of
this specific CDN/subset distribution is unresolved;** using a third-party CDN
does not itself clear it. No runtime change is made by this notice update.

jsDelivr is a third-party static-resource network dependency: it receives normal
resource-request metadata such as IP address. Stylesheet links omit credentials
and the page referrer; font requests contain no flight records, archive names or
search/filter values. An unavailable CDN leaves the application usable with the
existing system font fallbacks. Settings includes a visible Xiaomi attribution.

## airportsdata

Keepraw Fly bundles a generated subset of the
[mborsetti/airportsdata](https://github.com/mborsetti/airportsdata) dataset:
operational airport records that have a three-letter IATA code, coordinates and
an IANA timezone, plus the upstream IATA multi-airport-city relationships. The
generated source metadata and upstream revision are stored
in `packages/core/data/airports.source.json`.

The dataset is distributed under the MIT License. Its license text, including
its upstream `mwgg/Airports` acknowledgement, is included in
`packages/core/data/LICENSE.airportsdata`.

Run `pnpm update:airports` to refresh the generated airport data from a pinned
upstream revision.

## Wikidata airline and airport localization references

Keepraw Fly bundles an offline airline code/name reference and a Chinese airport
name/city overlay generated from [Wikidata](https://www.wikidata.org/). Wikidata
structured data is available under the Creative Commons CC0 1.0 dedication.
Snapshot metadata is recorded in `packages/core/data/airlines.source.json` and
`packages/core/data/airport-locales.source.json`.
`airline-overrides.json` contains a small maintained correction layer for
current high-use carriers where Wikidata reuses a designator for a subsidiary,
historic operator or branded service; it is applied after the generated data.

Run `pnpm update:airlines` and `pnpm update:airport-locales` to refresh these
checked-in runtime datasets. The application never queries Wikidata at runtime.

## Soaring Symbols

Keepraw Fly bundles airline SVG icons from
[soaring-symbols/soaring-symbols](https://github.com/soaring-symbols/soaring-symbols),
version 0.1.0-alpha.12, as local build assets. The library is distributed under
the MIT License; its license text is included in
`apps/web/src/data/LICENSE.soaring-symbols`.

Airline names, logos and trademarks remain the property of their respective
owners. The upstream library's MIT license does not independently establish
permission from every airline to redistribute all brand artwork. The icons are
used for airline identification, and the application falls back to the airline
designator when no icon is available.

Run `pnpm update:airline-icons` after updating the dependency to refresh the
generated IATA/ICAO-to-asset registry.

## Airline logo PNG supplements

Keepraw Fly also bundles only the PNG logos needed by the local airline dataset
from [imgmongelli/airlines-logos-dataset](https://github.com/imgmongelli/airlines-logos-dataset),
at revision `7b001fb8d5d0a2f875d57b2b5a8a8056b2fbc63a`. The upstream README
declares the repository MIT-licensed and credits publicly available IATA/ICAO
sources. The selected files are copied into `assets/airlines/` and mirrored into
`apps/web/public/assets/airlines/` under their IATA codes. At this audit,
408 source PNGs match 408 served copies by Git blob SHA; the application never
requests the upstream repository at runtime. The upstream notice is retained
in `apps/web/src/data/NOTICE.airlines-logos-dataset.md`.

The upstream README's repository-level MIT statement is **not evidence of an
individual grant from every airline** for its logos or any separately protected
artwork. These names, logos and trademarks may have independent rights holders;
we have not verified per-logo redistribution permission. The assets are used
for airline identification. See the linked review for this open question.

## OpenCC.js

Keepraw Fly uses [OpenCC.js](https://github.com/nk2028/opencc-js), version
**1.4.2** (`package.json`), as a development-only dependency for airport and
airline localization generation. The [published package metadata](https://www.npmjs.com/package/opencc-js)
identifies **MIT AND Apache-2.0** (including the Apache-licensed dictionary
material), not Apache-2.0 alone. It is not bundled into the browser runtime.

## Natural Earth Vector

Keepraw Fly bundles optimized SVG paths generated from the Natural Earth Vector
1:110m admin 0 country polygons, version 5.1.2. The exact source URL and SHA-256 checksum
are recorded in `apps/web/src/data/world-map.source.json`.

Natural Earth map data is in the public domain. The upstream terms and notice
are included in `apps/web/src/data/LICENSE.natural-earth`.

## d3-geo

Keepraw Fly uses `d3-geo` version 3.1.1 to generate the Equal Earth
projection and to project airport points and great-circle routes. The library and its bundled `d3-array` 3.2.4 and `internmap` 2.0.3 dependencies
are distributed under the ISC License; the retained `LICENSE.d3-geo` also
includes the required upstream GeographicLib MIT notice. Their license texts
are included in `apps/web/src/data/LICENSE.d3-geo`, `LICENSE.d3-array` and
`LICENSE.internmap`.

Run `pnpm update:world-map` to regenerate the checked-in SVG paths and refresh
the upstream license files from their pinned versions.

## Three.js (production Desktop Passport and Globe Lab)

The official Desktop Passport lazily loads the 3D Globe and its actual
`globe-renderer.ts`, which imports Three.js **0.186.1**, OrbitControls,
Line2, LineGeometry and LineMaterial. This is a **production browser runtime
dependency**, as well as a dependency of the earlier Globe Lab; it is not
development-only. Three.js is MIT-licensed, and its copyright/license notice
is retained in `apps/web/src/globe/LICENSE.three`.

## NASA Blue Marble (production Desktop Passport and Globe Lab)

The production 3D Globe bundles two resized Earth surface textures (2048 and
4096 px widths) derived from NASA Earth Observatory's **Blue Marble Next
Generation, July 2004** topography/bathymetry imagery, credited to **NASA
Earth Observatory / Reto Stöckli**. The same source was used by the earlier
Globe Lab. Exact source URL, source SHA-256, dimensions, processing generator
and output asset sizes are recorded in
`apps/web/src/globe/globe-texture.source.json`.

NASA's [Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
generally permit factual, educational and informational use of NASA imagery
(including texture maps and web simulations), subject to acknowledgments and
restrictions. NASA does **not** endorse Keepraw Fly, and this notice makes no
blanket claim that all imagery on NASA sites is public domain or freely
licensable. Third-party copyrighted items and promotional uses must be
checked separately. These textures contain no NASA insignia or identifiable
people.

## NASA Black Marble (production Desktop Passport and Globe Lab)

The production 3D Globe also bundles two downsampled nighttime-intensity
textures derived from NASA Earth Observatory's **Earth at Night / Black
Marble 2016** grayscale global composite. Credit: **NASA Earth Observatory /
Joshua Stevens; Suomi NPP VIIRS data from Miguel Román, NASA GSFC**. The
imagery represents a historical composite, not current or live light data.
Source URL, exact source and output SHA-256 values, 2048/4096 asset dimensions,
geographic registration and generator are recorded in
`apps/web/src/globe/globe-night-texture.source.json`. These images are used
both by the production Globe and the earlier Lab.

The same NASA [media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
and non-endorsement restrictions apply. The textures contain no NASA logos or
identifiable people; the NASA attribution describes the underlying imagery
and does not imply sponsorship or approval.
