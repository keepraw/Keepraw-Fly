# Airport crosswalk audit for 0.13.0

Review of the existing Fly-to-Airport History physical identities. The companion CSV records
the selected mappings, direct ID matches, unmatched Fly IDs and alternative candidates
at baseline `5bc027a139b8204f81c112168da92ac2fcc8c5c1`. For the four reviewed links,
the CSV `manual_review` field gives the final decision. Fields such as `mapped`
and `committed_formal_ids` record the baseline.
[Complete CSV](airport-crosswalk-0.13.0.csv)

| Audit result                                                               | Count |
| -------------------------------------------------------------------------- | ----: |
| Committed crosswalk links                                                  | 5,893 |
| Fly IDs already equal to a formal ID                                       |    30 |
| Unmatched Fly IDs                                                          | 1,962 |
| Unmatched Fly IDs with one or more qualified candidates                    |     0 |
| Fly IDs with multiple evidence candidates                                  |   137 |
| Fly IDs with competing qualified formal candidates                         |     0 |
| Fly IDs with multiple committed owners                                     |     0 |
| Formal sites linked to multiple Fly IDs                                    |     1 |
| Multi-link sites with conflicting Fly names, countries or reference points |     0 |
| Proximity-only candidate pairs                                             |     6 |
| Committed links without matching code or name                              |     0 |
| Committed links with differing normalized names                            | 1,189 |
| Committed links needing manual review                                      |    74 |

## Follow-up decisions

Four links are **B. Different physical airports**. The four `legacyIds` associations
were removed, leaving 5,889 links. Both IDs in each pair still resolve to their
original physical positions. Existing flight endpoint IDs continue to take
precedence over date-based lookup. The other 70 review flags remain as recorded.

The published 0.13.0 claims for all four IATA and ICAO pairs use continuity
inference. Their certain intervals are `[2000-01-01, 2026-11-19)` on the
Airport History IDs shown below. Fly applies the reviewed operating-site
handoffs to those specific claims while retaining the published outer bounds.
Where the operating-site handoff is bounded by two dates, the intervening days
remain uncertain. The pinned upstream dataset remains byte-for-byte intact.

### PQM — Palenque International Airport

- **B. Crosswalk removed. Identities split.** The Fly ID
  `apt_0705905f-5933-4e0c-8928-082674ee1b31` represents the former facility.
  It retains the source name and city `Palenque International Airport`, country
  MX, zone `America/Mexico_City`, former codes PQM / MMPQ and position
  `17.5334, -91.9845`. Its original Fly status defaulted to operating. Its
  reviewed status is closed. The replacement is Airport History ID
  `apt_ee3b4101-0ecd-4f9e-a574-4e2477735b67`, Palenque International Airport at
  `17.533153, -92.015484`, the current PQM / MMPQ site. The two reference
  points are **3.285 km** apart. In the pinned snapshot, row `322590`
  (`MX-0395`, closed) is `17.533596, -91.984442`, 0.023 km from the Fly point.
  Row `4744` (`MMPQ`, small airport) is the replacement.
- SCT reports the old airport closed to all operations and the new airport
  started operations on **2014-03-13**. SENEAM supplement S 44/16 identifies
  the closed MMPQ at 17°32′00″N, 091°59′00″W and cancels its 2009 chart. The
  2016 international designation publishes the new point near 17°31′59″N,
  092°00′56″W and confirms March 2014 operations. The operator publishes
  PQM / MMPQ for the new facility. The first administrative allocation dates
  remain unverified. [SCT yearbook](https://micrs.sct.gob.mx/images/DireccionesGrales/DGP/PDF/DEC-PDF/Anuario_2018.pdf) · [Archived SENEAM supplement](https://www.edgardos.com.mx/eAIP/other_documents/pdfs/000/000/175/original/Boletin_de_Suplementos_2016.pdf) · [Diario Oficial designation](https://www.gob.mx/cms/uploads/attachment/file/810337/palenque-16-12-2016-16032023.pdf) · [Airport operator](https://www.gob.mx/grupomundomaya/es/articulos/aeropuerto-internacional-de-palenque) · [IMT 2008 historical PQM listing](https://imt.mx/archivos/Publicaciones/Manual/mn2008.pdf)

### MKM — Mukah Airport

- **B. Crosswalk removed. Identities split.** Fly ID
  `apt_79e98365-bb8e-4d43-b91c-34f42e4ed6b5` represents the old Mukah
  STOLport. It retains Mukah Airport, city Mukah, MY, zone `Asia/Kuching`,
  former codes MKM / WBGK and `2.90639, 112.08`. Its original Fly status
  defaulted to operating. Its reviewed status is closed. The replacement
  Mukah Airport, Airport History ID `apt_261f97ee-84c4-4c97-a77a-24dd7db7fedf`,
  is `2.881944, 112.043333`, **4.896 km** away. Snapshot row `31918`
  (`MY-0009`, closed) is `2.907082, 112.077756`, 0.261 km from the Fly
  point. Row `350992` (`WBGK`, medium airport) is the replacement.
- Malaysia's Ministry of Transport documents construction at a new site
  beginning **2017-08-11** to replace the STOLport and operation from
  **2021-06-17**. The old AIP AD 4.1 records WBGK at 02°54′25″N,
  112°04′30″E. CAAM NOTAM D0578/21 makes new WBGK operation effective
  June 17, and the current eAIP lists the replacement runway near
  02°52′55″N, 112°02′36″E. Sarawak publishes MKM / WBGK for that
  replacement. The exact time the old site stopped handling traffic and
  the initial MKM allocation remain unverified. [Ministry announcement](https://www.mot.gov.my/en/Announcement/PRESS%20RELEASE%20YBM%20-%20NEW%20AIRPORT%20FOR%20MUKAH%20SARAWAK%20FROM%2017%20JUNE%202021%20-%2016062021.pdf) · [Historical AIP AD 4.1](https://aip.caam.gov.my/aip%20pdf/AD/AD4/Index%20To%20Aerodromes.pdf) · [CAAM NOTAM summary](https://www.caam.gov.my/wp-content/uploads/2021/12/JUL-NOTAM-Summary-Comb.pdf) · [CAAM eAIP WBGK](https://aip.caam.gov.my/aip/eAIP/2026-02-19-AIRAC/html/eAIP/WM-AD-2.WBGK-en-MS.html) · [Sarawak Ministry of Transport](https://mot.sarawak.gov.my/web/subpage/webpage_view/116)

### DSE — Kombolcha Airport

- **B. Crosswalk removed. Identities split.** Fly ID
  `apt_85ce2ba2-27bc-4d41-bbcc-1d934641c784` is the former Combolcha Airport.
  It retains the name Combolcha Airport, city Dessie, ET, zone
  `Africa/Addis_Ababa`, historical DSE / HADC and `11.0825, 39.7114`.
  Its original Fly status defaulted to operating. Its reviewed directory
  status is unknown because the formal closure record is unavailable.
  Airport History ID `apt_18516e40-15cd-4374-a4fb-9e71ff0e3706` is the
  replacement Kombolcha Airport at `11.10975, 39.725911`, **3.419 km**
  away. Snapshot row `30949` (`ET-0010`, tagged closed) is
  `11.0825, 39.711399`, less than 0.001 km from the Fly point. Row
  `507651` (`HADC`, small airport) is the replacement.
- Ethiopia AIP AD 1.3-3, dated **2014-06-26**, lists the older HADC airstrip
  near 11°05′N, 039°43′E with serviceability unknown. AD 2-HADC-1,
  dated **2015-06-25**, describes the new paved north-south runway and
  an aerodrome reference at 11°06′05″N, 039°43′38″E. The government's
  March 2015 diagnostic reports the new airport in operation. Ethiopian
  Airlines records the 2014 start of its services, announced for September 10.
  The Ethiopian Meteorology Institute pairs DSE with HADC, and the US
  archival DOT code list records DSE for Dessie before the move. The closure
  day and exact code transfer day remain unverified. Fly keeps
  **2014-06-27 through 2015-06-24** uncertain for both codes. [Archived Ethiopia AIP](https://pdfcoffee.com/aip-ethiopia-2-pdf-free.html) · [Government diagnostic](https://mui.gov.et/wp-content/uploads/2024/09/study.pdf) · [Ethiopian Airlines history](https://ethiopiancorporatecms.azurewebsites.net/AboutEthiopian/History/1) · [Contemporary service announcement coverage](https://www.ch-aviation.com/news/30856-ethiopian-to-expand-domestic-network-this-month) · [Ethiopian Meteorology Institute](https://www.ethiomet.gov.et/documents/5/1640597436.pdf) · [US National Archives code list](https://s3.amazonaws.com/NARAprodstorage/lz/electronic-records/rg-570/ODSurveys/632_9-12CL.pdf)

### BTI — Barter Island LRRS Airport

- **B. Crosswalk removed. Identities split.** Fly's ID
  `apt_e0a09678-0e50-49b5-bcf2-56bc499ede2d` already represents the
  **inland replacement**. It retains Barter Island Airport, city Barter
  Island, US, zone `America/Anchorage`, BTI / PABA and
  `70.113111, -143.653611`. Its original Fly status defaulted to
  operating and it remains the operating site. The published Airport History
  ID `apt_2ab143ee-cd3b-4d44-99e0-5aaa35d55afc`, Barter Island Long
  Range Radar Station Airport at `70.134003, -143.582001`, represents
  the **former coastal runway**, **3.567 km** from the Fly point. Snapshot
  row `5337` has that former point and retains stale operating metadata
  and BTI / PABA. Row `340806` (`US-3040`, Kaktovik South Airstrip,
  small airport) is `70.11308, -143.655033`, 0.054 km from the Fly point.
  It identifies the inland runway area and supplies corroborating location
  evidence. The former runway is closed in Fly.
- The FAA documents the relocation and adopts the inland reference
  70°06′47″N, 143°39′13″W, effective **2017-04-27**. The USAF plan
  documents the opening of the inland civil airport in **2016**, the
  retirement of the coastal runway and the demolition of its hangar
  in **2017**. The FAA's Location Identifiers lists BTI / PABA, and its
  2014 airport plan listed the proposed replacement separately as +08O.
  The precise day of the civil handover and code transition remains unverified.
  Fly keeps **2016-01-01 through 2017-04-27** uncertain and uses the inland
  Fly ID from **2017-04-28**, the first full local day after the rule took effect.
  [FAA final rule](https://www.federalregister.gov/documents/2017/03/06/2017-04181/amendment-of-class-e-airspace-barter-island-ak) · [FAA Location Identifiers](https://www.faa.gov/air_traffic/publications/atpubs/lid/L_G1.htm) · [FAA 2015–2019 NPIAS, appendix A](https://www.faa.gov/sites/faa.gov/files/airports/planning_capacity/npias/current/npias-2015-2019-report-appendix-a.pdf) · [USAF plan, sections H.1.1 and H.3.2](https://naccesu.uri.edu/wp/wp-content/uploads/2019/04/Ref-A_2020-PRE-FINAL-USAF-PRSC-Remote-Sites-INRMP-_Appendix.pdf) · [Alaska DNR project fact sheet](https://dnr.alaska.gov/projects/astar/binders/Kaktovik.pdf)

## Method

Each Fly record is compared against the formal IATA and ICAO assignments, normalized
airport names and physical coordinates. Current formal codes use verified coverage
on the last civil day of the manifest horizon. Airport History supplies assignment dates.
The OurAirports snapshot supplies the comparison country through the formal external ID.

The CSV includes pairs sharing an assignment, a normalized name, a committed link or a
reference point within 0.4 km. A qualified candidate meets the original crosswalk's
evidence rules. These require a matching ICAO or normalized name within 3 km and the
same country, both IATA and ICAO within 5 km, or IATA within 0.4 km and the same country.
The audit exposes candidates in both directions before applying the committed links.
Proximity without supporting codes or names warrants manual review. Country differences
and reference points over 3 km apart also warrant review, even with agreeing codes.
Name differences are recorded on every examined pair. An agreeing normalized name is
one signal alongside the codes and location.

## Manual review

Treat the flags as leads for independent verification of the physical identity at
both ends of each link. Prioritize old Fly reference points near a different airport
in the pinned snapshot.

| Fly IATA | Formal site                                    | Formal OurAirports ID | Other snapshot sites near the Fly reference point                |
| -------- | ---------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| PQM      | Palenque International Airport                 | 4744                  | 322590 MX-0395 Palenque Old Airport (closed, 0.023 km)           |
| MKM      | Mukah Airport                                  | 350992                | 31918 MY-0009 Old Mukah STOLport (closed, 0.261 km)              |
| DSE      | Kombolcha Airport                              | 507651                | 30949 ET-0010 Combolcha Airport (closed, 0.000 km)               |
| BTI      | Barter Island Long Range Radar Station Airport | 5337                  | 340806 US-3040 Kaktovik South Airstrip (small_airport, 0.054 km) |

| Flag on a committed link                      | Count |
| --------------------------------------------- | ----: |
| IATA and proximity only                       |    50 |
| country discrepancy                           |    11 |
| different snapshot airport near the Fly point |     4 |
| reference points over 3 km apart              |    13 |

| Fly ID                                     | Formal airport ID                          | Old IATA / ICAO | Formal name                                               |    km | Review reason                                                                   |
| ------------------------------------------ | ------------------------------------------ | --------------- | --------------------------------------------------------- | ----: | ------------------------------------------------------------------------------- |
| `apt_0705905f-5933-4e0c-8928-082674ee1b31` | `apt_ee3b4101-0ecd-4f9e-a574-4e2477735b67` | PQM / MMPQ      | Palenque International Airport                            | 3.285 | reference points over 3 km apart; different snapshot airport near the Fly point |
| `apt_07a67aea-6aec-4cb6-bd50-87022ef57d6d` | `apt_925d1111-2cce-4e64-92de-406fd8efc6b5` | KNU / VICX      | Kanpur Airport                                            | 0.000 | IATA and proximity only                                                         |
| `apt_1a86a806-dba4-47f5-b566-e7230f7f2aba` | `apt_f5a558f4-66da-485f-8a16-0d5d65956481` | ABU / WRKA      | AA Bere Tallo (Haliwen) Airport                           | 0.274 | IATA and proximity only                                                         |
| `apt_3324eb80-cf97-4783-8165-883c0b439fe4` | `apt_e635470c-5f2b-4993-ad38-70cf6ee505ad` | BQN / TJBQ      | Rafael Hernández International Airport                    | 0.007 | country discrepancy                                                             |
| `apt_347c4296-6db3-401c-b954-6a9aa3f6f317` | `apt_247cdff3-6860-4059-a303-fdbd8634382c` | HBX / VAHB      | Hubballi Airport                                          | 0.308 | IATA and proximity only                                                         |
| `apt_3791009b-339e-4d32-9757-c62bc72a4ee5` | `apt_faa4eef0-4f1c-4fcd-8758-a16819ddc5fa` | LNI / AK71      | Point Lonely Short Range Radar Site Airfield              | 0.167 | IATA and proximity only                                                         |
| `apt_39451175-b7eb-4399-be47-763691f74a7c` | `apt_07cd01b2-ff5f-4bf2-9191-991cd522c71e` | MLV / YMEU      | Merluna Airport                                           | 3.590 | reference points over 3 km apart                                                |
| `apt_3d3eefe5-265e-49b8-9345-35b91797f970` | `apt_b8a612b7-8261-413b-b1d3-4ea787b8e706` | LUM / ZPLX      | Dehong Mangshi International Airport                      | 0.000 | IATA and proximity only                                                         |
| `apt_3f2914ae-6417-4dc6-afbe-9ef313b2a78f` | `apt_3cbf6db8-b2c9-401a-80ef-eccf5658a80c` | ION / FCOI      | Impfondo Airport                                          | 3.764 | reference points over 3 km apart                                                |
| `apt_43206285-3332-4874-9b23-074baf9d69bc` | `apt_c7b539ed-dd64-47f6-b57c-da2b2c2a2342` | LOH / SETM      | Ciudad de Catamayo Airport                                | 0.032 | IATA and proximity only                                                         |
| `apt_46421a53-489c-44c2-aec6-02f238da350a` | `apt_f67c86d0-6926-4bda-a392-8f0dde8bb9c3` | RPR / VARP      | Swami Vivekananda Airport                                 | 0.000 | IATA and proximity only                                                         |
| `apt_4648a300-3761-4bb5-b981-6abe392cb203` | `apt_7b89326c-9844-4073-bbdf-62f51f112963` | PSE / TJPS      | Mercedita International Airport                           | 0.170 | country discrepancy                                                             |
| `apt_47c10881-c844-4240-888a-95d0377bfeff` | `apt_70558988-e475-4ca2-9814-f43f45a1c10c` | YKD / CNS7      | Kincardine Municipal Airport                              | 0.000 | IATA and proximity only                                                         |
| `apt_4940ebc2-f66d-4269-ab6b-846575684873` | `apt_c0879758-d54a-4911-b840-c939f8a4fe3c` | HUG / MGHT      | Huehuetenango Airport                                     | 4.780 | reference points over 3 km apart                                                |
| `apt_4ab87a08-1d31-46b9-ae77-d1346503450d` | `apt_4e8be493-b2f6-4012-8406-a22941063ee4` | HUF / KHUF      | Terre Haute Regional Airport, Hulman Field                | 0.110 | IATA and proximity only                                                         |
| `apt_4ba7bcff-9153-4b6a-bc7e-81c08b14a6ff` | `apt_032b62c7-417d-4a34-ab36-2a67cffa3672` | EOZ / SVEZ      | Elorza Airport                                            | 4.822 | reference points over 3 km apart                                                |
| `apt_51c4636e-7499-48eb-920c-0e5021e86992` | `apt_4236da05-14aa-4304-8e0f-d1e0a4194cbb` | NNA / GMMY      | Kenitra Air Base                                          | 0.000 | IATA and proximity only                                                         |
| `apt_51f45263-605e-415d-88a6-6a66b1847f7c` | `apt_3c0ecc0b-2a2c-41cf-9854-255bf0518215` | TOB / HLGN      | Tobruk International Airport                              | 0.000 | IATA and proximity only                                                         |
| `apt_52e895f8-9114-4365-9c14-a1a3a89d29eb` | `apt_870b4ea2-84a4-4517-8fd2-b5653bed01d0` | SOC / WARQ      | Adisoemarmo International Airport                         | 0.054 | IATA and proximity only                                                         |
| `apt_53c970c6-0ff1-4d69-9976-cad0635246a1` | `apt_e235d297-802d-4072-80b0-d07b512b5ab3` | ISU / ORSU      | Jalal Talabani International Airport                      | 0.202 | IATA and proximity only                                                         |
| `apt_576d0324-ffdc-495d-9e39-d18ebce81876` | `apt_2f12476c-a7e9-4426-8b1d-67bbadfeb22e` | IXD / VIAL      | Prayagraj Airport                                         | 0.000 | IATA and proximity only                                                         |
| `apt_5a6eb8f6-a9c1-4278-a52e-68820bfdfc2a` | `apt_f2cdc3de-e04e-44ee-a969-2168d3ecce54` | STT / TIST      | Cyril E. King Airport                                     | 0.414 | country discrepancy                                                             |
| `apt_5b2cdd75-2b4e-4e67-82d4-a0e0ed11c0db` | `apt_e13cefb5-5026-4427-9c59-997c4c38a03b` | STX / TISX      | Henry E. Rohlsen Airport                                  | 0.068 | country discrepancy                                                             |
| `apt_5ea13e0d-e703-4d72-9c4c-d35d21c5bd12` | `apt_aa72b106-a38d-417a-b68a-60085e4fcacb` | SSN / RKSM      | Seoul Air Base (K-16)                                     | 0.163 | IATA and proximity only                                                         |
| `apt_68d55f79-89a4-4301-9ec6-96e016060107` | `apt_23d7329a-c853-495f-9ff8-4a71d6ef5086` | BCO / HABC      | Jinka Airport                                             | 3.699 | reference points over 3 km apart                                                |
| `apt_6cc0cad9-29ec-4af4-874e-0ee4a194031c` | `apt_61ea5043-2ace-4fa3-bc35-19a2d1defddf` | AZN / UZKA      | Andijan International Airport                             | 0.000 | IATA and proximity only                                                         |
| `apt_6d1ccec8-d030-4e2b-b581-6e5e70e20deb` | `apt_02092224-b472-40ac-9d73-7cbcd44d4450` | HMB / HEMK      | Suhaj International Airport                               | 0.038 | IATA and proximity only                                                         |
| `apt_6e5eb584-1b5b-46b6-bfb9-15650c02a460` | `apt_58d641c2-3df7-4703-b8d3-9f3d71ee3430` | NYK / HKNY      | Nanyuki Civil Airport                                     | 0.032 | IATA and proximity only                                                         |
| `apt_72b30211-143a-4972-81e4-6504b8f62b71` | `apt_36f11d49-57ad-4293-ad21-fbfa51b1b240` | PGZ / SSZW      | Ponta Grossa Airport - Comandante Antonio Amilton Beraldo | 0.037 | IATA and proximity only                                                         |
| `apt_77222290-edf6-495f-8283-e7651c147939` | `apt_2b64cc75-289b-44ff-b643-5cd052075986` | HRE / FVHA      | Robert Gabriel Mugabe International Airport               | 0.000 | IATA and proximity only                                                         |
| `apt_787c209e-8705-4f61-90b1-147613a74a9f` | `apt_ea91ed35-1135-4675-a6b7-5fdfc6f004ef` | SIG / TJIG      | Fernando Luis Ribas Dominicci Airport                     | 0.039 | country discrepancy                                                             |
| `apt_791b4bb5-0ed9-40aa-aeb3-09e6cb0a48a1` | `apt_54898995-4978-4625-babc-b9cd68f6e10d` | AEB / ZBGS      | Baise (Bose) Bama Airport                                 | 0.000 | IATA and proximity only                                                         |
| `apt_79e98365-bb8e-4d43-b91c-34f42e4ed6b5` | `apt_261f97ee-84c4-4c97-a77a-24dd7db7fedf` | MKM / WBGK      | Mukah Airport                                             | 4.896 | reference points over 3 km apart; different snapshot airport near the Fly point |
| `apt_7bfbc476-2a92-4e7b-9c2c-5e73979abed7` | `apt_ed134cdf-b1d9-4305-96e7-6b11134ca3d0` | TIM / WABP      | Mozes Kilangin Airport                                    | 0.173 | IATA and proximity only                                                         |
| `apt_7d2d9107-3230-480e-bdf6-ab520227e787` | `apt_67e95557-9bfa-4f96-9613-59fbfbd7b512` | TRK / WALR      | Juwata International Airport / Suharnoko Harbani AFB      | 0.266 | IATA and proximity only                                                         |
| `apt_8354c522-d8fb-4f7f-be6c-3be92b6bf997` | `apt_fad81635-c341-4161-b2cd-493427f9f95c` | IXG / VABM      | Belagavi Airport                                          | 0.000 | IATA and proximity only                                                         |
| `apt_83e9af01-4d16-4d86-bb20-11c0b6690278` | `apt_dd63545c-0a58-46c8-bc9c-f7eb9ecd91c1` | CPX / TJCP      | Benjamin Rivera Noriega Airport                           | 0.002 | country discrepancy                                                             |
| `apt_85ce2ba2-27bc-4d41-bbcc-1d934641c784` | `apt_18516e40-15cd-4374-a4fb-9e71ff0e3706` | DSE / HADC      | Kombolcha Airport                                         | 3.419 | reference points over 3 km apart; different snapshot airport near the Fly point |
| `apt_8868983f-0c72-47ad-983c-e76c511bec9d` | `apt_4c8693f2-c39c-4e5a-9abe-e9c25a1fc20c` | WOL / YWOL      | Shellharbour Airport                                      | 0.000 | IATA and proximity only                                                         |
| `apt_887a042f-a64b-4ad3-aa53-fd4e95563998` | `apt_18d21e9a-ed9a-415d-93c2-d371f0444e14` | ROO / SWRD      | Maestro Marinho Franco Airport                            | 0.190 | IATA and proximity only                                                         |
| `apt_9035c5ba-1abd-46a6-82c2-872485c777dd` | `apt_23c8dd9e-b4f9-4f47-bd98-5b0212a177c8` | MAZ / TJMZ      | Eugenio Maria De Hostos Airport                           | 0.003 | country discrepancy                                                             |
| `apt_9137b1da-bcbb-4ded-be50-475898db8e41` | `apt_0fd3915b-6dd8-4391-a840-9992db9683cf` | RVI / URRR      | Rostov-on-Don Airport                                     | 0.000 | IATA and proximity only                                                         |
| `apt_931f170b-4c94-4d1a-90b6-7804b04ca526` | `apt_752e1d3c-b9ba-4a31-9cfa-609988bd9eef` | SXG / FLSN      | Senanga Airport                                           | 3.633 | reference points over 3 km apart                                                |
| `apt_9631ad46-117b-462f-ae12-5a4eb780f409` | `apt_a65a1044-b964-4b87-8627-8eb6c98fc25c` | PTO / SSPB      | Juvenal Loureiro Cardoso Airport                          | 0.070 | IATA and proximity only                                                         |
| `apt_9a1d8fd3-e1f0-461f-8fc0-7a217f760703` | `apt_2e2f54c0-4382-4f46-9a04-f6e296e2ee18` | SNZ / SBSC      | Santa Cruz Air Force Base                                 | 0.000 | IATA and proximity only                                                         |
| `apt_9a5fc3aa-c7a4-43c4-8332-0d5b5e457f9e` | `apt_5f674089-5df8-430d-aa0d-0ebbe38df508` | BEO / YPEC      | Lake Macquarie Airport                                    | 0.178 | IATA and proximity only                                                         |
| `apt_a3d3ecf8-df02-45d0-b60a-843dd6c5c6ab` | `apt_356ba561-4a66-4506-bbba-a2b189043549` | FNB / ETNU      | Neubrandenburg Trollenhagen Airport                       | 0.000 | IATA and proximity only                                                         |
| `apt_a414e8fe-0c16-4363-959d-51a1c4ef44b1` | `apt_0b7c70b1-c25f-43d7-8f79-ceb43048752c` | PLW / WAML      | Mutiara - SIS Al-Jufrie Airport                           | 0.276 | IATA and proximity only                                                         |
| `apt_a463617b-6100-41b1-9fc6-5430cf529ae4` | `apt_8db6da7b-88b5-4ee8-ba5b-473c00fdd226` | PHI / SNYE      | Pinheiro Airport                                          | 4.253 | reference points over 3 km apart                                                |
| `apt_a972d80f-c325-44ec-9d99-1b8af04d0326` | `apt_a67666b7-36f5-4194-adca-fa966005c636` | WGP / WADW      | Umbu Mehang Kunda Airport                                 | 0.000 | IATA and proximity only                                                         |
| `apt_a9f3e7cc-3e41-4661-a269-bba64faaa0d7` | `apt_aa5df83e-a91e-47ed-9635-0ff818229de2` | LUW / WAMW      | Syukuran Aminuddin Amir Airport                           | 0.399 | IATA and proximity only                                                         |
| `apt_ab87539e-cb6b-49c8-b1fc-813a12617b4a` | `apt_d6a1f3bf-bebb-4b44-8ff5-27589a78bd28` | JBK / ZWQT      | Qitai Jiangbulake Airport                                 | 4.007 | reference points over 3 km apart                                                |
| `apt_b1358a34-49bc-44d5-9e0d-ada0f760f517` | `apt_4645acf7-af66-48dd-a09d-eececac955f4` | TJQ / WIOD      | H A S Hanandjoeddin International Airport                 | 0.186 | IATA and proximity only                                                         |
| `apt_b23c85ec-dbe6-4b9f-8011-fefc9590d9c1` | `apt_13abe86c-d6be-4551-b0d4-5404396e1393` | NYT / VYEL      | Nay Pyi Taw International Airport                         | 0.000 | IATA and proximity only                                                         |
| `apt_b32d83f9-b44f-4cff-b8ac-3905a91dd4dd` | `apt_759bfdca-bf91-4853-9c35-14f00b84e085` | DBM / HADM      | Debre Markos Airport                                      | 4.178 | reference points over 3 km apart                                                |
| `apt_b93cf47a-da06-4df3-9553-3cbf8d962cd1` | `apt_a79f0b90-980d-4cdd-b341-b93a61247aab` | SKL / XBRO      | Broadford Airstrip                                        | 0.031 | IATA and proximity only                                                         |
| `apt_bff85307-bea6-4324-9604-c9c5ee906047` | `apt_d050ad30-4884-4551-93f9-8b44b47a039d` | MNH / OORQ      | Mussanah Airport                                          | 0.000 | IATA and proximity only                                                         |
| `apt_c5b25c8e-01a9-4d96-9ee7-19120d6a9f39` | `apt_e1d0e65d-c0cb-49ca-a7eb-94813e6d0cc7` | CEF / KCEF      | Westover Metropolitan Airport / Westover Air Reserve Base | 0.002 | IATA and proximity only                                                         |
| `apt_c5f6b10a-92fd-43fb-b7b4-40b691c826c8` | `apt_c6a0e84e-b896-4a24-aadd-dbac89f0f6fe` | BXT / WRLC      | LNG Badak Airport                                         | 0.279 | IATA and proximity only                                                         |
| `apt_c621279c-cd47-4b23-bf90-00a43debfe14` | `apt_0dbbdc68-b2e5-4474-899f-62724493b0ab` | SRG / WARS      | Jenderal Ahmad Yani Airport                               | 0.295 | IATA and proximity only                                                         |
| `apt_c8a21845-9f88-404a-aab7-a6ae57a3e024` | `apt_894922d5-d460-40eb-bd7b-1be4791da287` | NRR / TJRV      | José Aponte de la Torre Airport                           | 0.452 | country discrepancy                                                             |
| `apt_cd64866e-5b2f-4e00-9457-05eb4363dcb4` | `apt_9b69c8df-1be6-4f82-8b10-e4bf935c183c` | BKS / WIPL      | Fatmawati Soekarno Airport                                | 0.000 | IATA and proximity only                                                         |
| `apt_d9ea6991-eb02-4300-bd1e-49eba7864ae5` | `apt_661c3182-5ef7-437f-87bf-c1686510f6f7` | LCX / ZSLD      | Liancheng Guanzhishan Airport                             | 0.174 | IATA and proximity only                                                         |
| `apt_dd1320c1-8079-466b-a638-1740bf3a9cf7` | `apt_d31aa2d1-fd69-486d-b323-b8bbf7a8e1c1` | VQS / TJVQ      | Antonio Rivera Rodriguez Airport                          | 0.001 | country discrepancy                                                             |
| `apt_df10c635-5531-4fca-a2c6-1c151b1c1188` | `apt_ccd2b548-e310-43e0-9e21-edf005736787` | VIY / LFPV      | Vélizy-Villacoublay Air Base                              | 0.114 | IATA and proximity only                                                         |
| `apt_e0476315-5a52-4325-926a-5a838021b0d8` | `apt_aaf7d966-daca-4c0b-9e64-cde4cd24c419` | ARE / TJAB      | Antonio Nery Juarbe Pol Airport                           | 0.035 | country discrepancy                                                             |
| `apt_e0a09678-0e50-49b5-bcf2-56bc499ede2d` | `apt_2ab143ee-cd3b-4d44-99e0-5aaa35d55afc` | BTI / PABA      | Barter Island Long Range Radar Station Airport            | 3.567 | reference points over 3 km apart; different snapshot airport near the Fly point |
| `apt_e3d6e3a2-8dd9-4f36-aaa7-cad54e2e4ba3` | `apt_743a8911-1da8-42b6-ba67-a146c8ce36e3` | PGK / WIPK      | Depati Amir Airport                                       | 0.000 | IATA and proximity only                                                         |
| `apt_e6270ff8-b8fd-467c-b7ad-08701cd83142` | `apt_daeadf51-3784-4f9a-89a4-96fbec4353d0` | IGL / LTBL      | Çiğli Airbase                                             | 0.000 | IATA and proximity only                                                         |
| `apt_eb1c7c8f-7880-4702-80b6-f5ed6350f5d1` | `apt_a2ab5c48-368b-4348-886e-ca1049ade091` | OGL / SYGO      | Eugene F. Correia International Airport                   | 0.199 | IATA and proximity only                                                         |
| `apt_eebdfce3-095c-493f-94cf-0b9d4c6c9fda` | `apt_2109b249-186d-4be9-a286-8333bec0a4d8` | LVI / FLLI      | Harry Mwanga Nkumbula International Airport               | 0.325 | IATA and proximity only                                                         |
| `apt_f00a77a3-02a9-4a39-b45c-361724417701` | `apt_62550c91-ce4c-4633-a957-e9384a5aab4a` | SJU / TJSJ      | Luis Munoz Marin International Airport                    | 0.035 | country discrepancy                                                             |
| `apt_f674552e-70d6-4c3a-9986-85e2e4b89a2f` | `apt_051e7e31-3f9a-484c-91a0-11f3d2fbe649` | TTE / WAMT      | Sultan Babullah Airport                                   | 0.081 | IATA and proximity only                                                         |
| `apt_fe8908c7-035b-47f8-8dce-f03dbd2fd73b` | `apt_491397b3-c5bb-4a9b-a676-c853af4b66ff` | MIJ / K1Q9      | Mili Island Airport                                       | 0.264 | IATA and proximity only                                                         |

### Multiple Fly IDs linked to one formal site

| Formal airport ID                          | Fly IDs                                                                                | Fly name, country and location evidence |
| ------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------- |
| `apt_27095b41-dc75-481a-83d1-4287953741bc` | `apt_1ad51a7a-8a2e-494e-820a-5201c8570b39`, `apt_b03b092e-89f9-4cb3-bbb1-22508918211f` | Consistent                              |

Filter the CSV by `record_type`, `qualified_formal_candidate_count` or
`potential_cross_site_merge` to inspect every unmatched and competing pair.

## Inputs

- Formal dataset commit `2c39e2f040d65dd32142ffcbb4ca62b5c459abf0` and SHA-256 `a834b0153bd897b1f2cc5aaf1300ec5037f4ed43a596848543d84adfb5f99c34`.
- Formal directory SHA-256 `e16b8ec5a4d3d3d745d4ba4dda2cd97476fae7138ac3e80d9d4c452753efbc21`.
- Fly directory SHA-256 `655a5ed1d2241373163c133bb49fb0790a88b00c03bb85a2f57beeefcacd1818`.
- OurAirports snapshot `d97df1673cc5ba61a09b17ab5936091a669a04ca` and SHA-256 `27c6500d0a742edece15c5aaf960e08c01df0d4356c5c86255897b5d3749ad3b`. [Snapshot](https://raw.githubusercontent.com/davidmegginson/ourairports-data/d97df1673cc5ba61a09b17ab5936091a669a04ca/airports.csv)

Run the evidence scan at the baseline commit to reproduce the original candidate
rows. Use a separate output directory to retain the decisions recorded here.

```sh
python3 scripts/update-airport-history.py --fetch-ourairports /tmp/ourairports.csv
python3 scripts/audit-airport-crosswalk.py --ourairports /tmp/ourairports.csv --output-dir /tmp/airport-crosswalk-baseline
```
