# Third-party notices

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

## Natural Earth Vector

Keepraw Fly bundles optimized SVG paths generated from the Natural Earth Vector
1:110m land polygons, version 5.1.2. The exact source URL and SHA-256 checksum
are recorded in `apps/web/src/data/world-map.source.json`.

Natural Earth map data is in the public domain. The upstream terms and notice
are included in `apps/web/src/data/LICENSE.natural-earth`.

## d3-geo

Keepraw Fly uses `d3-geo` version 3.1.1 to generate the Natural Earth 1
projection and to project airport points and great-circle routes. The library
and its bundled `d3-array` 3.2.4 and `internmap` 2.0.3 dependencies are
distributed under the ISC License. Their license texts are included in
`apps/web/src/data/LICENSE.d3-geo`, `LICENSE.d3-array` and
`LICENSE.internmap`.

Run `pnpm update:world-map` to regenerate the checked-in SVG paths and refresh
the upstream license files from their pinned versions.
