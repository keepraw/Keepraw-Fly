# Locale terminology and translation review

The released options are `zh-CN`, `zh-TW`, `en-US`, `en-GB`, `ja-JP`,
`fr-FR`, `de-DE`, `es`, `pt-BR` and `ko-KR`. Every option except the British
English override has a complete resource. British English inherits US English
and overrides regional spelling, including cancelled, recognised, kilometres,
romanised, programme and licence. There are no additional released languages.

All user-facing sections are included: navigation, settings, editor, detail,
passport, statistics, maps, Globe and Globe Lab, JSON/CSV/Flighty import,
recovery, errors, empty/loading states and accessibility labels. `pnpm check:i18n`
checks recursive logical keys, variables, empty/malformed strings, cardinal
plural categories and actual resolution without unintended English fallback.
French, Spanish and Brazilian Portuguese include `many`; Japanese and Korean
use `other`. Quantity formatting preserves variable names with the built-in
`{{count, number}}` syntax. Identifiers and years are never grouped.

## Terminology reference

| Concept             | en-US / en-GB                      | zh-CN           | zh-TW         |
| ------------------- | ---------------------------------- | --------------- | ------------- |
| Scheduled / Actual  | Scheduled / Actual                 | 计划 / 实际     | 預定 / 實際   |
| Departure / Arrival | Departure / Arrival                | 出发 / 到达     | 出發 / 抵達   |
| Delay               | Delay                              | 延误            | 延誤          |
| Cancelled           | Canceled / Cancelled               | 已取消          | 已取消        |
| Diverted            | Diverted                           | 备降            | 轉降          |
| Terminal / Gate     | Terminal / Gate                    | 航站楼 / 登机口 | 航廈 / 登機門 |
| Cabin / Seat        | Cabin / Seat                       | 舱等 / 座位     | 艙等 / 座位   |
| Ticket Number       | Ticket number                      | 票号            | 票號          |
| Frequent Flyer      | Frequent flyer program / programme | 常旅客计划      | 常旅客計畫    |
| Flight Duration     | Flight duration                    | 飞行时间        | 飛行時間      |
| Distance            | Distance                           | 距离            | 距離          |
| Airport / Route     | Airport / Route                    | 机场 / 航线     | 機場 / 航線   |

| Concept             | ja-JP                | fr-FR                 | de-DE                 | es                            | pt-BR                  | ko-KR              |
| ------------------- | -------------------- | --------------------- | --------------------- | ----------------------------- | ---------------------- | ------------------ |
| Scheduled / Actual  | 予定 / 実績          | Prévu / Réel          | Geplant / Tatsächlich | Programado / Real             | Previsto / Real        | 예정 / 실제        |
| Departure / Arrival | 出発 / 到着          | Départ / Arrivée      | Abflug / Ankunft      | Salida / Llegada              | Partida / Chegada      | 출발 / 도착        |
| Delay               | 遅延                 | Retard                | Verspätung            | Retraso                       | Atraso                 | 지연               |
| Cancelled           | 欠航                 | Annulé                | Annulliert            | Cancelado                     | Cancelado              | 결항               |
| Diverted            | 目的地変更           | Dérouté               | Umgeleitet            | Desviado                      | Desviado               | 회항               |
| Terminal            | ターミナル           | Terminal              | Terminal              | Terminal                      | Terminal               | 터미널             |
| Gate                | 搭乗口               | Porte d’embarquement  | Gate                  | Puerta de embarque            | Portão de embarque     | 탑승구             |
| Cabin               | 搭乗クラス           | Classe de voyage      | Reiseklasse           | Clase de cabina               | Classe de cabine       | 좌석 등급          |
| Seat                | 座席                 | Siège                 | Sitzplatz             | Asiento                       | Assento                | 좌석               |
| Ticket Number       | 航空券番号           | Numéro de billet      | Ticketnummer          | Número de billete             | Número do bilhete      | 항공권 번호        |
| Frequent Flyer      | マイレージプログラム | Programme de fidélité | Vielfliegerprogramm   | Programa de viajero frecuente | Programa de fidelidade | 상용 고객 프로그램 |
| Flight Duration     | 飛行時間             | Durée du vol          | Flugdauer             | Duración del vuelo            | Duração do voo         | 비행시간           |
| Distance            | 距離                 | Distance              | Entfernung            | Distancia                     | Distância              | 거리               |
| Airport             | 空港                 | Aéroport              | Flughafen             | Aeropuerto                    | Aeroporto              | 공항               |
| Route               | ルート               | Itinéraire            | Route                 | Ruta                          | Rota                   | 노선               |

Terminal identifies the airport building; gate identifies the departure/arrival
gate. Scheduled and actual times remain distinct, expressed at each airport's
local time. Elapsed flight duration uses the existing absolute timestamp
calculation, never subtraction of local clock readings. Canceled flights have
no flown route; diverted flights retain the planned destination separately.

Flight Passport is the product's personal flight archive, not a travel document.
The names are 飛行護照 / 飞行护照, フライトパスポート, Carnet de vol, Flugpass,
Pasaporte de vuelos, Passaporte de voos and 비행 기록장. Airline and loyalty
program brands, IATA/ICAO, PNR, IANA, UTC, ISO 8601 and RFC3339 stay intact.
Actual CSV header names such as Flighty's `Date`, `Airline`, `Flight`, `From`
and `To` remain unchanged when identifying missing columns.

## Reference data and loading

The airport/airline databases were not expanded with unverified names. Exact
locale and language-level names fall back explicitly to English, including
airports, cities, countries and airline/loyalty brands. Switching the UI language
does not change saved distance units, 12/24-hour preferences or flight archives.

US English is the bundled fallback. Other locales are independent Vite static
JSON assets loaded on demand and stored in optional CacheStorage. The current
UI stays visible while a full resource loads; only the latest request commits.
The native i18next backend uses the same loader for standard `changeLanguage()`
calls and cloned instances, including independently mounted Globe modules.
Load failure keeps that UI and presents a localized retry. Other locales warm
sequentially 15 seconds after archive startup completes, so cached languages remain available for
offline switching. A never-cached locale still requires a connection; browser
cache clearing can remove cached translations. This does not alter local flight
storage or replace JSON backups. Static deployment needs no server runtime,
translation SDK or service worker. Japanese and Korean use system font stacks;
only the existing Chinese MiSans subsets download fonts.

## Semantic review and native-speaker follow-up

Public English UI strings were used for machine-assisted drafts, followed by AI
post-editing of aviation vocabulary, interface actions, counts, time semantics,
storage/backup warnings, recovery replacement/deletion and independent Globe
copy. No translation service is used at runtime and no English placeholders
were added to simulate completion. Automated checks and AI semantic review are
not professional native-speaker review. The following specific choices warrant
native review; they are complete translations, not untranslated keys:

| Locale / keys                                                                   | Review question                                                                                                            |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ja-JP: `nav.passport`, `passport.emptyTitle`                                    | Does the product name フライトパスポート read naturally as a personal flight archive?                                      |
| fr-FR: `nav.passport`, `flightEditor.frequentFlyerPlan`                         | Confirm Carnet de vol for this product and the membership wording for an airline loyalty account.                          |
| de-DE: `nav.passport`, `settings.storageProtectionDescription`                  | Confirm Flugpass as a product metaphor and the distinction between browser storage permission and a retention guarantee.   |
| es: `flightEditor.cabins.business`, `flightyImport.fileErrors.not-flighty-file` | Confirm neutral Spanish cabin wording and the airport gate-time explanation across regions.                                |
| pt-BR: `settings.newMembership`, `settings.frequentFlyerProfiles`               | Confirm cadastro/perfil wording for multiple loyalty accounts, rather than an airline subscription.                        |
| ko-KR: `status.diverted`, `status.divertedTo`, `nav.passport`                   | Confirm 회항 covers diversion to an alternate airport, not only return to origin; confirm 비행 기록장 as the product name. |
| All six: `globe.neutralProbe`, `globe.artDirectionA`, `globe.artDirectionB`     | Globe Lab diagnostic/art labels need specialist native review.                                                             |

Chinese resources are maintained independently. Taiwan wording uses 設定, 資料,
航廈, 登機門, 轉降 and 常旅客計畫; Simplified Chinese keeps its regional terms.
OpenCC must not overwrite reviewed Taiwan text.

## Open maintenance questions

The terminology questions above remain open until a named native reviewer records
acceptance or revisions. Review rendered airport-time, storage, import/recovery
and loyalty-account scenarios, not only isolated JSON strings. In particular:

- Korean diversion: review `status.diverted`, `status.divertedTo`,
  `flightDetail.divertedTo` and `import.issueMessages.cancelledDivertedConflict`
  together. Confirm an alternate landing as well as return to origin, including
  the airport particle `(으)로`.
- Taiwan: reconcile Globe's `globe.scheduled` wording `計畫` with the maintained
  scheduled-time term `預定`; review backup/recovery and app-installation copy
  without regenerating reviewed text through OpenCC.
- French: check `Porte d’embarquement` in both departure and arrival contexts,
  `Prévu / Réel`, diversion and loyalty-membership wording. Across locales,
  distinguish membership from airline subscriptions or flight crew.
- All released options: verify counts/plurals, US/UK spelling, destructive
  confirmations, screen-reader actions and storage permission states. None
  should imply guaranteed retention. Japanese/French/German/Korean Passport
  names should read as personal flight archives rather than official documents.

Release acceptance and the resolved cache/editor regressions are recorded in
[PR #58](https://github.com/keepraw/Keepraw-Fly/pull/58). Use [testing guidance](testing.md)
and current discovery for present coverage; past pass counts are not a maintained
inventory.

### Locale cache policy

Old resource content hashes have no retention/pruning policy. Warming does not
inspect connection speed or `saveData`. Cached language switching after an online
reload does not guarantee a fresh page navigation offline; HTML/JS/reference
assets have separate cache behavior and there is no service worker. New hashes
need an online fetch, while cache clearing, eviction or denial removes stored
translations. Successful resources also remain in memory for the page lifetime.
Any cleanup design must consider older open tabs before deleting valid resources.

### Reference-data anomalies

UI translation completeness does not certify reference-data geography. The
current `packages/core/data/airport-locales.json` still contains the following
city-label issues, independently of display suffix shortening:

| IATA | Recorded issue and next action                                                                                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OKS  | `冈山市` / `岡山市` refers to Okayama, Japan, while the airport directory identifies Garden County/King Rhiley Field in Oshkosh, Nebraska. Verify a correction against [FAA airport information](https://www.airnav.com/airport/koks). |
| NFO  | `宜野湾市` / `宜野灣市` refers to Ginowan, Japan, while the airport directory locates Mata'aho Airport in Angaha, Tonga. Verify a correction against [OurAirports](https://ourairports.com/airports/NFTO/changes.html).                |
| GDN  | `三联市` / `三聯市` describes the wider region; verify the intended passenger-facing city label against geographic sources.                                                                                                            |
| YMM  | `伍德布法罗地区自治市` / `伍德布法羅地區自治市` uses a municipality name; verify the intended passenger-facing city label against geographic sources.                                                                                  |

Correct these through a separate source-backed data change and dedicated tests.
Do not silently alter persisted airport identity or treat shortened display text
as a geographic repair.
