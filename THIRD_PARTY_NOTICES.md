# Third-party notices

## MiSans / MiSans TC webfonts

Chinese UI typography uses **MiSans** (Simplified Chinese) and **MiSans TC**
(Traditional Chinese), copyright Xiaomi. The fonts remain subject to Xiaomi's
independent font license; see the [official font site](https://hyperos.mi.com/font/zh/)
and [official font license](https://hyperos.mi.com/font-download/MiSans字体知识产权许可协议.pdf).
They are not licensed under Keepraw Fly's MIT License or Apache-2.0.

The approved third-party distribution is
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
Chinese font downloads. No font binary is repackaged or committed here.

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

The dataset is distributed under the MIT License. Its license text is included
in `packages/core/data/LICENSE.airportsdata`.

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
owners. The icons are used for airline identification, and the application
falls back to the airline designator when no icon is available.

Run `pnpm update:airline-icons` after updating the dependency to refresh the
generated IATA/ICAO-to-asset registry.

## Airline logo PNG supplements

Keepraw Fly also bundles only the PNG logos needed by the local airline dataset
from [imgmongelli/airlines-logos-dataset](https://github.com/imgmongelli/airlines-logos-dataset),
at revision `7b001fb8d5d0a2f875d57b2b5a8a8056b2fbc63a`. The upstream README
declares the repository MIT-licensed and credits publicly available IATA/ICAO
sources. The selected files are copied into `assets/airlines/` and renamed to
their IATA codes; the application never requests the upstream repository at
runtime. The upstream notice is retained in
`apps/web/src/data/NOTICE.airlines-logos-dataset.md`.

Airline logos and trademarks remain the property of their respective rights
holders and are used only to identify the airline.

## OpenCC.js

Keepraw Fly uses [OpenCC.js](https://github.com/nk2028/opencc-js), version
1.4.1, under the Apache License 2.0. It is a development-only dependency used
by the airport localization update script to normalize generated labels to
Mainland Simplified Chinese. It is not included in the browser runtime.

## Natural Earth Vector

Keepraw Fly bundles optimized SVG paths generated from the Natural Earth Vector
1:110m admin 0 country polygons, version 5.1.2. The exact source URL and SHA-256 checksum
are recorded in `apps/web/src/data/world-map.source.json`.

Natural Earth map data is in the public domain. The upstream terms and notice
are included in `apps/web/src/data/LICENSE.natural-earth`.

## d3-geo

Keepraw Fly uses `d3-geo` version 3.1.1 to generate the Equal Earth
projection and to project airport points and great-circle routes. The library
and its bundled `d3-array` 3.2.4 and `internmap` 2.0.3 dependencies are
distributed under the ISC License. Their license texts are included in
`apps/web/src/data/LICENSE.d3-geo`, `LICENSE.d3-array` and
`LICENSE.internmap`.

Run `pnpm update:world-map` to regenerate the checked-in SVG paths and refresh
the upstream license files from their pinned versions.

## Three.js (development Globe Lab)

The isolated, development-only Globe Lab uses Three.js 0.186.1 and its
OrbitControls / Line2 addons under the MIT License. The complete notice is
included in `apps/web/src/globe/LICENSE.three`. Normal production builds exclude
the experiment and this dependency's browser code.

## NASA Blue Marble (development Globe Lab)

The Globe Lab bundles resized NASA Earth Observatory Blue Marble Next Generation
July 2004 imagery with topography and bathymetry. NASA is credited in the Lab;
no endorsement is implied. Source URL, usage guidelines, checksum, dimensions,
asset sizes and generator are recorded in
`apps/web/src/globe/globe-texture.source.json`. The source contains no NASA logos
or identifiable people. NASA informational imagery usage terms are linked there;
this is not a claim that all NASA imagery is unrestricted.

## NASA Black Marble (development Globe Lab)

The Lab also bundles downsampled, lossless grayscale NASA Earth at Night / Black
Marble 2016 imagery, credited to NASA Earth Observatory / Joshua Stevens, using
Suomi NPP VIIRS data from Miguel Román, NASA GSFC. It provides historical,
geographically registered city-light intensity rather than live observations.
Source URL, source and output SHA-256 hashes, dimensions, bounds, processing,
usage guidelines and generator are recorded in
`apps/web/src/globe/globe-night-texture.source.json`. NASA's informational imagery
guidelines apply; no endorsement, logos or identifiable people are included.
