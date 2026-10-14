> Historical task review. Measurements, validation outcomes, approval status and deployment statements describe the recorded checkpoint. See the [current documentation](../../README.md).

# Flight-list city-label audit (2026-10-11)

## Scope and result

This audit covers **display labels only**. Source airport records, localized airport
names, search indexes, airport codes and persisted flights are unchanged.

Inputs from `main`:

- `packages/core/data/airports.iata.json`: 7,884 airport directory records.
- `packages/core/data/airport-locales.json`: 4,469 localized airport rows,
  with separate simplified/traditional Chinese names.
- `packages/core/data/airport-city-groups.json`: 39 imported multi-airport city
  groups, plus the maintained CTU and NYC groups (41 unique groups in total).

The 4,469 localized rows were programmatically scanned. **353 city fields** end
with the Chinese administrative suffix `市` in each script; the compact display
formatter shortens **338** and preserves **15**. The test iterates over **all
353** suffix-bearing records in both Chinese scripts and verifies nonempty
results, balanced script behavior, preservation exceptions and unchanged English
labels. This is not a claim that all 4,469 airport-city translations have been
individually fact-checked.

The 15 intentionally preserved IATA codes are:
`BWU`, `BZE`, `GDN`, `JIB`, `KRP`, `LOE`, `LUX`, `MKZ`,
`SGN`, `TED`, `TUN`, `VII`, `YMM`, `YQB`, `ZVK`.

Some are well-established city names where `市` is meaningful
(e.g. 胡志明市, 伯利兹市, 魁北克市, 吉布提市, 卢森堡市);
others are two-character names or explicit municipality/local-government
names, preserved conservatively pending individual geographic validation.
These are not necessarily ideal final consumer labels.

Examples of changed display labels:

| IATA | Source                  | Compact list label                      |
| ---- | ----------------------- | --------------------------------------- |
| KHN  | 南昌市                  | 南昌                                    |
| CAN  | 广州市                  | 广州                                    |
| TSA  | 台北市 / 臺北市         | 台北 / 臺北                             |
| DAD  | 岘港市 / 峴港市         | 岘港 / 峴港                             |
| DAC  | 达卡市 / 達卡市         | 达卡 / 達卡                             |
| DRS  | 德累斯顿市 / 德累斯頓市 | 德累斯顿 / 德累斯頓                     |
| CJJ  | 清州市                  | 清州                                    |
| KWJ  | 光州广域市 / 光州廣域市 | 光州                                    |
| OKS  | 冈山市 / 岡山市         | 冈山 / 岡山 (source anomaly; see below) |

The same city-group display labels now drive both mobile and desktop
`FlightRow` presentations. All 41 multi-airport city groups have explicit
English, simplified Chinese and traditional Chinese display names. Previously,
33 groups lacked curated Chinese names and fell back to English.

Airport IATA codes still distinguish airports within one displayed city:
`PEK/PKX`, `SHA/PVG`, `TPE/TSA`, `EWR/JFK/LGA` and `HND/NRT`.

## Known source-data errors requiring separate correction

The suffix formatter cannot reliably repair a city assigned to the **wrong
geographic location**. These were found during the audit and are deliberately
flagged rather than silently treated as cleaned:

- **OKS (US)**: localized `冈山市` refers to Okayama, Japan. OKS is Garden
  County Airport in **Oshkosh, Nebraska**. See
  [IATA airport search](https://www.iata.org/PublicationDetails/Search/Search?airport.search=OKE&currentBlock=314384&currentPage=12572)
  and [FAA airport information](https://www.airnav.com/airport/koks).
- **NFO (TO)**: localized `宜野湾市` refers to Ginowan, Japan. NFO is
  Niuafoʻou Airport, Tonga, in the Angaha area. See
  [OurAirports](https://ourairports.com/airports/NFTO/changes.html).
- **GDN (PL)** and **YMM (CA)** use regional/municipal terms that may not
  be the best flight-list city label. Verify against geographic sources before
  changing airport records or assigning display-only overrides.

This PR fixes suffix inconsistency and multi-airport city-group localization;
it does **not** certify the geographic accuracy of every translated city in
the upstream airport locale dataset. Geographic corrections require a separate,
source-backed review and dedicated tests.

## Safeguards

- Source locale and airport directory JSON remain byte-for-byte unchanged.
- No change to flight schemas, persistence, search and IATA airport identity.
- No Globe, CSS, Flighty visual redesign, deployment or branch merge.
- Verify with `pnpm typecheck`, `pnpm test`, `pnpm format:check` and CI.
