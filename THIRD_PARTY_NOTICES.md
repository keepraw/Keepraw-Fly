# Third-party notices

## airportsdata

Keepraw Fly bundles a generated subset of the
[mborsetti/airportsdata](https://github.com/mborsetti/airportsdata) dataset:
operational airport records that have a three-letter IATA code, coordinates and
an IANA timezone. The generated source metadata and upstream revision are stored
in `packages/core/data/airports.source.json`.

The dataset is distributed under the MIT License. Its license text is included
in `packages/core/data/LICENSE.airportsdata`.

Run `pnpm update:airports` to refresh the generated airport data from a pinned
upstream revision.
