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

## Related evidence and open follow-ups

The [archived multilingual release audit](archive/audits/i18n-audit.md) records
PR #58 validation, fixed malformed-cache recovery and narrow German editor-label
overflow. Its counts and performance samples describe that release checkpoint.
Use [testing guidance](testing.md) and current discovery for present coverage.

Its [native-review checklist](archive/audits/i18n-audit.md#translation-semantics-and-native-review-checklist)
adds concrete review contexts to the terminology questions above, including
Korean diversion, Taiwan scheduled-time wording, loyalty membership and storage
protection. Those rows remain open until a named reviewer records acceptance or
revisions; archiving the report does not establish native-speaker approval.

The [cache-risk record](archive/audits/i18n-audit.md#warming-and-performance)
also remains relevant: old content hashes have no retention/pruning policy,
warming does not inspect connection speed or `saveData`, and cached language
switching does not guarantee a fresh page navigation offline. Any cache cleanup
design must consider older open tabs before deleting valid resources.

The [city-label audit](archive/reviews/task-5b-city-label-audit.md#known-source-data-errors-requiring-separate-correction)
records source-data anomalies separately from display shortening. Recheck those
records against current data and geographic sources before making corrections;
UI translation completeness does not certify reference-data geography.
