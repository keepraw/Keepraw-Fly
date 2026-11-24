# Views, skin contract and screen classes / 视图、皮肤约定与屏幕档位

[English](#english) | [简体中文](#简体中文)

## English

**Status: phase 4 of 6 implemented.** The views, the fragment routes, the
addressable Flight, the primary navigation with its persistent Add flight and
the Compact touch targets below are in the application, and so are the Log
filters and order, the denser Log row, every Stats region, the flight's place in
the archive and the exploration state in the fragment query. Stats and the Log
controls render one markup on every screen class. The skin mechanism, the
`minimal` skin and the `aviation` skin are implemented: the skin is chosen in
Settings, and it sets the tokens, the supported appearances, the landing view,
the navigation order, the map theme and the Flight Passport layout. `aviation`
is the default, and the v0.3.0 look is no longer offered. `flight.extension` is
the first extension slot in use. See
[what phase 3 implements](#what-phase-3-implements) and
[what phase 4 implements](#what-phase-4-implements) for what is not there yet.
`archive` is not implemented. Each later phase updates this document with its
implementation.

**Contract version: `skin-contract/0` (internal, unstable).** The contract exists
so that the three official skins are built against one structure. It is not a
public extension API: third-party skins, skin import and runtime-loaded code or
styles are not supported, and the [Content Security Policy](security.md) does not
change.

### Why

A UI review of v0.3.0 found structural problems that colour or spacing changes
cannot fix:

- On a 390 px phone the first screen shows no flights; Add flight and search sit
  on the second screen and there is no persistent navigation.
- Two top-level pages carry the map, statistics, flight list, search, entry and
  sharing.
- Flight Detail has no address of its own: reload returns to Passport and the
  browser Back button does not return to the list.
- Airline, aircraft, cabin and yearly data exist but are shown only as counts.
- Desktop and mobile show different statistics, not a rearrangement of the same
  set.

### Decisions

| Topic                         | Decision                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Structure                     | One view architecture shared by every skin                                                                                              |
| Official skins                | Three, selected in Settings: `minimal`, `aviation`, `archive`                                                                           |
| Default skin                  | `aviation`. The v0.3.0 look is not kept as a fourth skin                                                                                |
| Appearance                    | `minimal` light and dark; `aviation` dark only; `archive` light only. An unsupported Appearance control is disabled and says why        |
| Landing view                  | Chosen by the skin: `minimal` Log, `aviation` Map, `archive` Passport                                                                   |
| Map theme and passport layout | Fixed by the skin. The separate Map theme and Flight Passport layout settings are removed                                               |
| Chinese typography            | MiSans / MiSans TC in every skin. `archive` falls back to system Chinese serif faces only when MiSans fails to load. No new CJK webfont |
| Very wide screens             | `minimal` and `aviation` use the width; `archive` keeps a centred maximum width                                                         |
| Selected-flight inspector     | Not built. Its content belongs to the Flight view, so a row behaves the same in every skin                                              |
| Skin-specific content         | Only through extension slots fed by the read-only insights interface                                                                    |
| Information parity            | A skin or screen class may move or restyle an item, never remove it                                                                     |
| Third-party skins             | Not supported until a security model exists                                                                                             |

### Views and addresses

| View     | Address                           | Purpose                                                    |
| -------- | --------------------------------- | ---------------------------------------------------------- |
| Log      | `#/log`                           | Chronological flight list with search, filters and sorting |
| Map      | `#/map`                           | Route map with the flights of the current scope            |
| Stats    | `#/stats`                         | Totals, yearly history, rankings and records               |
| Passport | `#/passport`                      | Holder page, totals, route plate and the shareable image   |
| Flight   | `#/flight/<encoded flight id>`    | One flight record                                          |
| Settings | `#/settings`, `#/settings/<part>` | Preferences, data and backup                               |

Routing stays in the URL fragment because the application is served as static
files from arbitrary sub-paths (GitHub Pages projects, Docker, other hosts) with
no server rewrite.

- An empty fragment opens the landing view of the active skin.
- Legacy fragments keep working: `#passport` and the retired `#flights` and
  `#share` open the landing view; `#settings` opens Settings.
- Reload keeps the view and, for Flight, the flight. An unknown flight id opens
  Log with a notice; it never shows a blank page.
- Opening a flight adds a history entry, so browser Back returns to the view it
  was opened from with its scroll position. Previous/next inside Flight replace
  the entry instead of adding one, and walk the list the flight was opened from;
  the entry keeps that list's filters and order, so a reload does not change it.
- The exploration state — year scope, the selected airport or route, the airline
  and aircraft-type filters and the sort order — is shared by Log, Map and Stats
  and is mirrored into the fragment query with `replaceState`. Search text stays
  in memory: typing must not rewrite the address on every key, and search terms
  should not persist in browser history.
- The query keys are `year`, `airport` (with `at` for the physical airport),
  `route` as `ORIGIN-DESTINATION` (with `from` and `to`), `airline`, `aircraft`
  and `sort` (`oldest`, `longest`, `shortest`). Defaults are left out, so
  `#/log` is the unfiltered Log. Unknown or malformed values are ignored, and a
  year without flights falls back to All.
- Back, Forward and reload restore the state their entry names. A link or typed
  address without a query keeps the state in memory, so moving between views
  does not drop the filters.
- The welcome, recovery and conflict states keep precedence over routes, as today.
- The flight editor, share overlay and confirmation dialogs remain overlays, not
  routes.

### Navigation

- Primary destinations are Log, Map, Stats and Passport. Settings is a secondary
  destination. **Add flight** is available in every primary view.
- Below 760 px the primary destinations are a bottom tab bar that respects safe
  areas, and Add flight stays visible while scrolling. From 760 px the skin
  places the primary navigation as a rail or a top bar.
- A skin declares the order of the primary destinations with its landing view
  first. DOM order follows that order, so focus order and visual order agree.
- View names are one set of translations shared by all skins. Skins do not
  rename views.

### Regions and information inventory

Every view is composed of named regions. Shared components render the regions;
a skin decides placement, size and visual variant for each screen class. The
items below are the **information inventory**: each must be reachable in every
skin, supported appearance and screen class. Automated tests enumerate it.

| View     | Region              | Inventory                                                                                                                                               |
| -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| all      | `scope`             | All and each recorded year, with flight counts                                                                                                          |
| all      | `banner.demo`       | Demo-archive notice and Create my archive                                                                                                               |
| Log      | `log.search`        | Search field                                                                                                                                            |
| Log      | `log.filters`       | Active selection with a clear action; airline and aircraft-type filters; sort order                                                                     |
| Log      | `log.summary`       | Distance, flights, time in air, airports, airlines, countries/regions for the current scope                                                             |
| Log      | `log.list`          | Year groups; per row: date, airline mark, flight number, origin and destination codes, local times with day offset, arrival delay or cancelled/diverted |
| Log      | `log.list` (detail) | City names, duration, distance, aircraft type, seat — a second line or extra columns, never dropped                                                     |
| Map      | `map.canvas`        | Routes and airports of the current scope, with selection                                                                                                |
| Map      | `map.controls`      | Zoom in, zoom out, fit; route-frequency legend                                                                                                          |
| Map      | `map.selection`     | Route and airport pickers; visits or flights, first and last date of the selection                                                                      |
| Map      | `map.summary`       | The same six totals as `log.summary`                                                                                                                    |
| Map      | `map.list`          | The flights of the current scope and selection, using the Log row                                                                                       |
| Stats    | `stats.totals`      | Six totals; total arrival delay with its "early arrivals do not offset" note; unresolved historical airports                                            |
| Stats    | `stats.byYear`      | Flights, distance and arrival delay per year                                                                                                            |
| Stats    | `stats.months`      | Flights per month                                                                                                                                       |
| Stats    | `stats.airports`    | Ranked airports; each entry filters the exploration state                                                                                               |
| Stats    | `stats.airlines`    | Ranked airlines; each entry filters                                                                                                                     |
| Stats    | `stats.aircraft`    | Ranked aircraft types; each entry filters                                                                                                               |
| Stats    | `stats.cabins`      | Flights per cabin, including "not recorded"                                                                                                             |
| Stats    | `stats.records`     | Longest and shortest flight, longest arrival delay, most flown route                                                                                    |
| Passport | `passport.holder`   | Holder name, display number, first flight, record period                                                                                                |
| Passport | `passport.totals`   | The six totals                                                                                                                                          |
| Passport | `passport.plate`    | Route map plate                                                                                                                                         |
| Passport | `passport.mrz`      | Machine-readable zone spanning the full line width, under the [specimen policy](flight-passport-journal.md)                                             |
| Passport | `passport.share`    | Generate the image, with visible Save and Close actions                                                                                                 |
| Flight   | `flight.header`     | Back, previous, next, edit, duplicate, delete with confirmation                                                                                         |
| Flight   | `flight.identity`   | Origin to destination, flight number, airline, date, recorded status                                                                                    |
| Flight   | `flight.times`      | Actual and scheduled local times, delay, UTC offset, day offset, terminal, gate                                                                         |
| Flight   | `flight.metrics`    | Duration and distance                                                                                                                                   |
| Flight   | `flight.map`        | Route map                                                                                                                                               |
| Flight   | `flight.experience` | Aircraft type, registration, seat, cabin, booking class                                                                                                 |
| Flight   | `flight.ticketing`  | Booking reference, ticket number, frequent-flyer details, when recorded                                                                                 |
| Flight   | `flight.context`    | Which visit this is to each airport, and which flight on this route                                                                                     |
| Settings | `settings.skin`     | Skin selector; Appearance, disabled with an explanation when the skin has one appearance                                                                |

The cross-filter between map, statistics and list — the best interaction of
v0.3.0 — is kept: selecting an airport, airline or route anywhere updates the
shared exploration state, and the active selection is always shown with a clear
action.

How the regions behave:

- An airport or route is one selection; airline and aircraft type are separate
  filters, so all three can narrow the flights together. Changing the year keeps
  the airline, the aircraft type and the order, and clears the selection and
  the search.
- Each filter lists its choices from the flights the other filters leave, with
  their counts. An active airline never hides the other airlines.
- Log orders by date (newest or oldest first, grouped by year) or by distance
  (longest or shortest first, in one group, flights without a known distance
  last).
- A Log row shows a late arrival; an early or on-time arrival adds nothing.
  A cancelled flight shows no duration, distance or delay.
- A Stats ranking shows its first six entries and opens in place to all of them.
  Stats counts and the flight context leave out cancelled flights, count a
  diverted flight at the airport it arrived at, and skip airports that are not
  confirmed at the flight date.

### Extension slots

`map.extension`, `stats.extension`, `passport.extension` and `flight.extension`
are the only places where skins may differ in content.

- An extension is first-party code compiled into the application.
- It reads only the insights interface below. It does not read storage, perform
  network requests or write anything.
- It may not be the only place where an inventory item appears.
- It renders nothing when the archive lacks the data it needs.
- It follows the same localisation and accessibility rules as any other region.
- It shows only what the archive records. Stamps are typographic (code, city,
  count or date); no landmark illustrations. Nothing implies live flight data.

Planned first-party extensions:

| Skin       | Slot               | Content                                                                   |
| ---------- | ------------------ | ------------------------------------------------------------------------- |
| `aviation` | `flight.extension` | Scheduled versus actual bar; two-time-zone timeline with a date-line mark |
| `archive`  | `flight.extension` | Typographic arrival stamp                                                 |
| `archive`  | `stats.extension`  | Typographic airport stamps for the current scope                          |
| `minimal`  | —                  | None                                                                      |

### Read-only insights interface

Derived data is calculated in `packages/core` as pure functions over the flights
of the current scope and is unit-tested there. The web application exposes the
results to views and extensions through one memoised, read-only interface.

- Existing: passport statistics, year statistics, annual arrival delay and most
  visited airports.
- Added in phase 2: ranked airlines, ranked aircraft types, cabin distribution,
  flights per month, shortest flight, longest arrival delay, most flown route,
  and per-flight context (visit ordinals for both airports and the route
  ordinal).
- Existing semantics are unchanged: cancelled flights are excluded, early
  arrivals do not offset delay, undetermined historical airports are not merged,
  and a value is `null` when the data is insufficient rather than estimated.
- No derivation adds fields to the portable archive. The Keepraw Fly JSON format
  and the storage format do not change.

### Skins

A skin is a first-party definition with these parts:

| Part             | Meaning                                                                        |
| ---------------- | ------------------------------------------------------------------------------ |
| `id`, label key  | `minimal`, `aviation`, `archive`                                               |
| Appearances      | The appearances it supports                                                    |
| Landing view     | The view an empty address opens                                                |
| Navigation order | Order of the primary destinations, landing view first                          |
| Map theme        | One registered [2D map theme](map-2d-architecture.md) per supported appearance |
| Passport layout  | One registered Flight Passport template                                        |
| Tokens           | Values for the semantic colour, type, shape, depth and motion roles            |
| Font roles       | Families for `ui`, `display`, `data` and `code`, per writing system            |
| Layouts          | Region placement for every view and screen class                               |
| Variants         | Visual variant of shared components (row, statistic, heading)                  |
| Extensions       | Components for the extension slots                                             |

| Skin       | Appearances | Landing  | Map theme                                            | Passport layout                      |
| ---------- | ----------- | -------- | ---------------------------------------------------- | ------------------------------------ |
| `minimal`  | light, dark | Log      | Daylight Chart in light; a new restrained dark theme | Single page, following the map theme |
| `aviation` | dark        | Map      | Neon Aviation                                        | Neon single page                     |
| `archive`  | light       | Passport | A new engraved light theme                           | Classic passport book                |

- The skin is a viewer preference stored with the other viewer settings in
  IndexedDB. It is not part of the portable archive. A cosmetic hint is cached
  so the first paint uses the right skin, the same way Appearance is restored.
- An unknown or missing stored value resolves to `aviation`.
- The effective appearance is the requested one when the skin supports it,
  otherwise the skin's only appearance. "System" is resolved first, then
  constrained.
- Stored Map theme and Flight Passport layout values are no longer read. Records
  written by earlier versions still load.
- Switching skins is immediate, needs no reload and writes nothing to the archive.

#### What phase 3 implements

- The registry is [`skins/registry.ts`](../apps/web/src/skins/registry.ts). Phase
  3 added `minimal` next to a transitional `classic` skin, the v0.3.0 look, which
  phase 4 removed.
- `minimal` uses Daylight Chart in light and the new `graphite-chart` theme in
  dark, and the single-page Flight Passport.
- The root element carries `data-skin`. `theme-init.js` restores it before the
  first paint from a cosmetic cache, next to the appearance; a test keeps its
  table of skins in step with the registry.
- An empty or legacy address opens the skin's landing view, and the primary
  navigation lists that view first. Changing the skin never moves the reader
  away from an explicit address.
- A skin with one appearance disables the Appearance control and explains why.
- `minimal` tokens, font roles and layouts are in
  [`skin-minimal.css`](../apps/web/src/styles/skin-minimal.css). From Wide up the
  Log row is one table-like line; from Ultrawide the four primary views use the
  full width, Settings and Flight detail keep a centred reading width, and the
  v0.3.0 enlargement of the Passport workspace is switched off, so one
  unit stays one CSS pixel at every system scale.
- Not in this phase: the navigation rail, the extension slots, and Short-specific
  layouts beyond the shared ones.

#### What phase 4 implements

- `aviation` is registered and is the default. `classic` is gone: a stored
  `classic`, like any unknown or missing value, resolves to `aviation`, and the
  record keeps every other preference.
- `aviation` is drawn in dark only. Settings shows Appearance disabled, set to
  dark, with the reason; the stored appearance is kept for a skin that offers a
  choice. Before the first paint the page is dark, whatever the device prefers.
- An empty or legacy address opens Map. The map theme is Neon Aviation and the
  Flight Passport is the Neon single page.
- Settings no longer has Map theme or Flight Passport layout; the skin decides
  both. Values stored by earlier versions are dropped the next time the settings
  are saved. The passport book layout stays in the code and is not reachable
  until `archive` selects it.
- Tokens and font roles are in
  [`skin-aviation.css`](../apps/web/src/styles/skin-aviation.css): indigo
  surfaces, one cyan accent, and a monospaced data role. Sizes, spacing and the
  type scale are the shared ones.
- From Ultrawide the four primary views use the full width, so the map takes
  the space. On a Short screen the header and the page padding are reduced;
  nothing is hidden.
- `flight.extension` is in use. [`skins/extensions`](../apps/web/src/skins/extensions/index.tsx)
  maps each skin to its compiled-in components and gives them a frozen object
  derived from the one flight, nothing else. `aviation` shows:
  - the scheduled and the actual operation as two bars on one time axis, with
    the difference in time in the air. It needs all four times and is absent for
    a cancelled or diverted flight;
  - the flight on the local clocks of both airports, with a tick at each local
    midnight and the day offset of the arrival. It is absent when both airports
    keep the same clock or a time zone is unknown;
  - a date-line mark where the great-circle route between the two airports
    crosses the 180th meridian. The position is computed from the route, not
    recorded, and the extension says so.
- The derivations are pure functions in
  [`flight-timeline.ts`](../packages/core/src/flight-timeline.ts).
- Not in this phase: the navigation rail, a Compact bottom sheet for Map, a
  skin-specific Log row for `aviation`, and extensions in the Map, Stats and
  Passport slots, which no skin fills yet.

Styling rules:

- Component styles use semantic tokens only. Literal colours in page styles are
  replaced by tokens when the skin mechanism lands; the token check covers skins.
- A skin provides token values and region layout. It does not override another
  skin, and it does not hide an inventory item.
- New map looks are registered map themes on the shared 2D core. No 3D, WebGL or
  external map tiles.

### Typography and languages

All ten interface languages must hold in every skin.

- Hierarchy must not depend on uppercase, italics, small capitals or condensed
  widths. These do not exist in Chinese, Japanese or Korean. Where a Latin label
  uses them, the same level is expressed by size, weight, colour or spacing.
- Font families are role tokens per skin and writing system (Latin, Simplified
  Chinese, Traditional Chinese, Japanese, Korean). Page styles do not carry
  per-language overrides.
- Chinese uses MiSans or MiSans TC in every skin, loaded as today. In `archive`
  the fallback after MiSans is a system Chinese serif stack. Japanese and Korean
  keep system fonts.
- A Latin serif for `archive` must be a font already bundled or a newly bundled,
  same-origin font. Adding one is a new dependency and needs owner approval.
- Codes, flight numbers, times, figures and the machine-readable zone are
  language-neutral and use the `data` or `code` role.
- All copy goes through the locale resources; all ten locales stay complete.

### Screen classes

The browser sees CSS pixels after operating-system scaling, so physical
resolutions collapse into a few classes. A 4K display at 200 % and a 1080p
display are the same layout.

| Class     | Condition                        | Typical device                         |
| --------- | -------------------------------- | -------------------------------------- |
| Compact   | width below 760 px               | Phones                                 |
| Medium    | 760–1199 px                      | Tablets, small windows                 |
| Wide      | 1200–1919 px                     | 1366×768, 1080p at 125 %, 2K at 150 %  |
| Ultrawide | 1920 px and above                | 1080p, 2K, 4K at 100–200 %             |
| Short     | height below 720 px, not Compact | 1366×768 laptops (about 650 px usable) |

The 760 and 1200 px boundaries already exist. Ultrawide and Short are new.

- Every skin defines every view for every class.
- Short reduces chrome and summary height; it never clips content, and the view
  scrolls.
- Ultrawide: `minimal` shows more list columns and `aviation` extends the map;
  `archive` centres a bounded page.
- Compact: Map is the canvas with a bottom sheet for the summary and list. The
  sheet has buttons to expand and collapse; it does not depend on a gesture.
- When panels cover the map, "fit" frames the routes inside the unobstructed
  area.
- Hairlines are device-pixel borders, not scaled transforms. Textures and
  ornaments are vector. The existing cap on glowing routes stays.

### Invariants

1. Every inventory item is reachable in every skin, appearance and screen class.
2. Focus and reading order equal visual order in every layout.
3. Touch targets are at least 44 px in Compact.
4. The document never scrolls horizontally, down to 320 px.
5. Axe checks pass; reduced motion is respected.
6. The Content Security Policy is unchanged and no new external origin is used.
7. The portable archive and storage formats are unchanged.
8. Nothing is shown that the archive does not record.

### Verification

| Dimension   | Values                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------- |
| Viewports   | 390×844, 1366×650, 1536×864, 1920×1080, 2560×1440, 3840×2160; 320×640 as an overflow guard  |
| Pixel ratio | 1 by default; 1.25, 1.5 and 2 sampled for hairlines and map sharpness                       |
| Languages   | Simplified Chinese, US English, German (longest labels), Japanese; all ten locales complete |
| Skins       | Each skin in each supported appearance                                                      |

- Automated: inventory parity per skin and class; routing (reload, Back, legacy
  fragments, unknown flight); the existing CSP suite; the existing quality gates
  in the [engineering standards](engineering-standards.md).
- Acceptance uses the in-app demo archive or the files in `examples/`, not
  hard-coded data.
- Reports state which browsers and devices were actually run. Anything not run
  is reported as not verified.

### Phases

Each phase is one independently reviewable pull request. Nothing is merged,
released or deployed without the owner's approval.

| Phase | Content                                                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | This specification                                                                                                                                 |
| 1     | Views and routing; addressable Flight with reload and Back; legacy fragments; primary navigation and persistent Add flight; Compact touch targets  |
| 2     | Log (density, sorting, airline and aircraft filters) and Stats; new derivations in `packages/core`; `flight.context`; one inventory on all classes |
| 3     | Skin mechanism, tokenised page colours, font roles, type scale, Settings skin selector, and `minimal`                                              |
| 4     | `aviation` with its extensions; it becomes the default and the v0.3.0 look is removed                                                              |
| 5     | `archive` with its extensions                                                                                                                      |
| 6     | Remaining review items: layered flight entry, import as its own task flow, welcome page                                                            |

### Out of scope

Third-party skins and skin import; data-format changes; a backend, accounts or
synchronisation; live flight data; 3D maps.

## 简体中文

**状态：6 个阶段中的阶段 4 已实现。** 下文的视图、片段路由、可寻址的航班、带常驻
「添加航班」的主导航，以及紧凑档的触控目标已经在应用中；日志的筛选与排序、更密的日志行、
统计的全部区域、航班在档案中的位置，以及写入片段查询串的探索状态也已实现。统计和日志的
筛选控件在所有屏幕档位使用同一份标记。皮肤机制、`minimal` 皮肤和 `aviation` 皮肤已实现：
皮肤在设置中选择，并决定令牌、支持的外观、落地视图、导航顺序、地图主题和飞行护照版式。
`aviation` 是默认皮肤，v0.3.0 的外观不再提供。`flight.extension` 是第一个投入使用的
扩展位。尚未实现的部分见[阶段 3 的实现范围](#阶段-3-的实现范围)和
[阶段 4 的实现范围](#阶段-4-的实现范围)。`archive` 尚未实现。
后续每个阶段在实现的同时更新本文。

**约定版本：`skin-contract/0`（内部、不稳定）。** 约定的作用是让三套官方皮肤基于同一
结构实现。它不是对外的扩展接口：不支持第三方皮肤、皮肤导入，也不支持运行时加载的代码
或样式；[内容安全策略](security.md)保持不变。

### 原因

对 v0.3.0 的界面审查发现了靠改颜色和间距解决不了的结构问题：

- 在 390 px 手机上首屏看不到任何航班；「添加航班」和搜索在第二屏，没有持久导航。
- 两个顶层页面承担了地图、统计、航班列表、搜索、录入和分享。
- 航班详情没有自己的地址：刷新回到飞行护照，浏览器后退不返回列表。
- 航司、机型、舱等和年度数据都有，但只显示为数量。
- 桌面端和移动端显示的统计内容不同，而不是同一组内容的重排。

### 决定

| 主题               | 决定                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| 结构               | 所有皮肤共用一套视图架构                                                                                        |
| 官方皮肤           | 三套，在设置中选择：`minimal`、`aviation`、`archive`                                                            |
| 默认皮肤           | `aviation`。v0.3.0 的外观不作为第四套保留                                                                       |
| 外观               | `minimal` 浅色和深色；`aviation` 仅深色；`archive` 仅浅色。不支持时「外观」置灰并说明原因                       |
| 落地视图           | 由皮肤决定：`minimal` 日志，`aviation` 地图，`archive` 护照                                                     |
| 地图主题与护照版式 | 由皮肤固定。原有的「地图主题」「飞行护照版式」两个设置项移除                                                    |
| 中文字体           | 所有皮肤都用 MiSans / MiSans TC。`archive` 仅在 MiSans 加载失败时回退到系统中文衬线字体。不引入新的中日韩网字体 |
| 超宽屏             | `minimal` 和 `aviation` 铺开使用宽度；`archive` 限宽居中                                                        |
| 选中航班检查器     | 不做。其内容属于航班视图，因此点击一行在所有皮肤下行为一致                                                      |
| 皮肤专属内容       | 只能通过扩展位实现，数据来自只读的洞察接口                                                                      |
| 信息一致           | 皮肤或屏幕档位可以移动或改变某项信息的样式，但不能去掉它                                                        |
| 第三方皮肤         | 在安全方案明确之前不支持                                                                                        |

### 视图与地址

| 视图 | 地址                              | 用途                                     |
| ---- | --------------------------------- | ---------------------------------------- |
| 日志 | `#/log`                           | 按时间排列的航班列表，含搜索、筛选和排序 |
| 地图 | `#/map`                           | 当前范围内航班的航线图                   |
| 统计 | `#/stats`                         | 总计、年度历史、排行和纪录               |
| 护照 | `#/passport`                      | 持有人页、总计、航线图版和可分享的图片   |
| 航班 | `#/flight/<编码后的航班 id>`      | 单条航班记录                             |
| 设置 | `#/settings`、`#/settings/<分区>` | 偏好、数据与备份                         |

路由继续放在地址的 `#` 片段里，因为应用以静态文件形式部署在任意子路径下（GitHub Pages
项目站点、Docker、其他主机），没有服务器重写。

- 片段为空时打开当前皮肤的落地视图。
- 旧片段继续可用：`#passport` 以及已退役的 `#flights`、`#share` 打开落地视图；
  `#settings` 打开设置。
- 刷新后保留视图；在航班视图下保留该航班。航班 id 不存在时打开日志并给出提示，不出现
  空白页。
- 打开一条航班会新增一条历史记录，因此浏览器后退回到打开它的视图及其滚动位置。航班
  视图内的上一条/下一条替换当前记录，不新增，并沿打开该航班时的列表前后移动；这条
  记录保留该列表的筛选和排序，刷新后不变。
- 探索状态（年份范围、选中的机场或航线、航司与机型筛选、排序方式）由日志、地图、统计
  三个视图共享，并用 `replaceState` 同步到片段的查询部分。搜索文字只保存在内存里：输入
  时不应每按一个键就改写地址，搜索词也不应留在浏览器历史中。
- 查询键为 `year`、`airport`（实体机场用 `at`）、`route`（写作 `出发-到达`，配合 `from`
  和 `to`）、`airline`、`aircraft` 和 `sort`（`oldest`、`longest`、`shortest`）。默认值
  不写入，因此 `#/log` 就是未筛选的日志。未知或格式错误的值会被忽略；没有航班的年份回退
  到「全部」。
- 后退、前进和刷新会恢复该历史记录所写的状态。不带查询的链接或手动输入的地址保留内存中
  的状态，所以在视图之间切换不会丢失筛选。
- 欢迎、恢复和冲突状态仍然优先于路由，与现在一致。
- 航班编辑器、分享覆盖层和确认对话框仍是覆盖层，不是路由。

### 导航

- 主要目的地是日志、地图、统计、护照。设置是次要目的地。**添加航班**在每个主要视图中
  都可用。
- 760 px 以下，主要目的地是底部标签栏并避开安全区，添加航班在滚动时保持可见。760 px
  及以上，由皮肤把主导航放成侧栏或顶栏。
- 皮肤声明主要目的地的顺序，落地视图排第一。DOM 顺序与之相同，因此焦点顺序与视觉顺序
  一致。
- 视图名称是所有皮肤共用的一组译文，皮肤不改视图名称。

### 区域与信息清单

每个视图由若干命名区域组成。区域由共享组件渲染；皮肤决定每个屏幕档位下各区域的位置、
大小和视觉变体。下表是**信息清单**：其中每一项在每套皮肤、每种支持的外观和每个屏幕
档位下都必须能到达。自动化测试会逐项检查。

| 视图 | 区域                | 清单                                                                                          |
| ---- | ------------------- | --------------------------------------------------------------------------------------------- |
| 全部 | `scope`             | 「全部」和每个有记录的年份，带航班数                                                          |
| 全部 | `banner.demo`       | 示例档案提示与「创建我的档案」                                                                |
| 日志 | `log.search`        | 搜索框                                                                                        |
| 日志 | `log.filters`       | 当前筛选及清除操作；航司与机型筛选；排序方式                                                  |
| 日志 | `log.summary`       | 当前范围的距离、航班、飞行时长、机场、航司、国家与地区                                        |
| 日志 | `log.list`          | 年份分组；每行：日期、航司标识、航班号、起降机场代码、当地时间及跨日标记、到达晚点或取消/备降 |
| 日志 | `log.list`（明细）  | 城市名、时长、距离、机型、座位——放在第二行或额外的列里，不得省略                              |
| 地图 | `map.canvas`        | 当前范围的航线与机场，可选中                                                                  |
| 地图 | `map.controls`      | 放大、缩小、适配；航线飞行次数图例                                                            |
| 地图 | `map.selection`     | 航线与机场选择器；所选对象的到访或飞行次数、首次与最近日期                                    |
| 地图 | `map.summary`       | 与 `log.summary` 相同的六项总计                                                               |
| 地图 | `map.list`          | 当前范围和筛选下的航班，使用日志的行                                                          |
| 统计 | `stats.totals`      | 六项总计；到达晚点合计及「提前到达不抵消」说明；尚未确认的历史机场                            |
| 统计 | `stats.byYear`      | 每年的航班数、距离和到达晚点                                                                  |
| 统计 | `stats.months`      | 每月航班数                                                                                    |
| 统计 | `stats.airports`    | 机场排行；每一项可筛选探索状态                                                                |
| 统计 | `stats.airlines`    | 航司排行；每一项可筛选                                                                        |
| 统计 | `stats.aircraft`    | 机型排行；每一项可筛选                                                                        |
| 统计 | `stats.cabins`      | 各舱等的航班数，包括「未记录」                                                                |
| 统计 | `stats.records`     | 最长与最短航班、最长到达晚点、最常飞的航线                                                    |
| 护照 | `passport.holder`   | 持有人姓名、显示编号、首次飞行、档案跨度                                                      |
| 护照 | `passport.totals`   | 六项总计                                                                                      |
| 护照 | `passport.plate`    | 航线图版                                                                                      |
| 护照 | `passport.mrz`      | 机读码占满一整行，遵循[示例策略](flight-passport-journal.md)                                  |
| 护照 | `passport.share`    | 生成图片，带可见的「保存」和「关闭」操作                                                      |
| 航班 | `flight.header`     | 返回、上一条、下一条、编辑、复制、删除（需确认）                                              |
| 航班 | `flight.identity`   | 出发地至目的地、航班号、航司、日期、记录的状态                                                |
| 航班 | `flight.times`      | 实际与计划当地时间、晚点、UTC 偏移、跨日标记、航站楼、登机口                                  |
| 航班 | `flight.metrics`    | 时长与距离                                                                                    |
| 航班 | `flight.map`        | 航线图                                                                                        |
| 航班 | `flight.experience` | 机型、注册号、座位、舱等、舱位代码                                                            |
| 航班 | `flight.ticketing`  | 订座编号、客票号、常旅客信息（有记录时）                                                      |
| 航班 | `flight.context`    | 这是第几次到访各机场、第几次飞这条航线                                                        |
| 设置 | `settings.skin`     | 皮肤选择；「外观」在皮肤只有一种外观时置灰并说明                                              |

地图、统计和列表之间的联动筛选是 v0.3.0 最好的交互，予以保留：在任何地方选中机场、航司
或航线都会更新共享的探索状态，当前筛选始终可见并带清除操作。

各区域的行为：

- 机场或航线是一项「选中」；航司和机型是两个独立的筛选，三者可以同时收窄航班。切换年份
  会保留航司、机型和排序，并清除选中项和搜索。
- 每个筛选的可选项来自其他筛选留下的航班，并带数量。已选中的航司不会让其他航司消失。
- 日志可按日期排序（从新到旧或从旧到新，按年份分组），或按距离排序（从长到短或从短到长，
  合为一组，距离未知的航班排在最后）。
- 日志行显示到达晚点；提前或准点到达不额外显示。已取消的航班不显示时长、距离和晚点。
- 统计中的排行默认显示前六项，可就地展开全部。统计计数和航班上下文不计入已取消的航班；
  备降航班计入实际到达的机场；在航班日期无法确认的机场不计入。

### 扩展位

`map.extension`、`stats.extension`、`passport.extension` 和 `flight.extension` 是皮肤之间
唯一允许内容不同的地方。

- 扩展是随应用编译的官方代码。
- 它只读取下文的洞察接口，不读取存储、不发起网络请求、不写入任何内容。
- 它不能是某项清单信息出现的唯一位置。
- 档案缺少所需数据时，它不渲染任何内容。
- 它与其他区域遵守同样的本地化和无障碍规则。
- 它只显示档案里有记录的内容。印章为纯文字（代码、城市、次数或日期），不画地标。不暗示
  接入了实时航班数据。

计划中的官方扩展：

| 皮肤       | 扩展位             | 内容                                         |
| ---------- | ------------------ | -------------------------------------------- |
| `aviation` | `flight.extension` | 计划与实际对照条；带日界线标记的双时区时间轴 |
| `archive`  | `flight.extension` | 纯文字到达章                                 |
| `archive`  | `stats.extension`  | 当前范围内的纯文字机场章                     |
| `minimal`  | —                  | 无                                           |

### 只读洞察接口

派生数据在 `packages/core` 中以纯函数计算（输入为当前范围内的航班），并在那里做单元
测试。网页应用通过一个带缓存的只读接口把结果提供给视图和扩展。

- 已有：护照统计、年度统计、年度到达晚点、最常到访机场。
- 阶段 2 新增：航司排行、机型排行、舱等分布、每月航班数、最短航班、最长到达晚点、最常飞
  航线，以及单条航班的上下文（两个机场各是第几次到访、这条航线是第几次飞）。
- 现有语义不变：不计入已取消的航班；提前到达不抵消晚点；未确定的历史机场不合并；数据
  不足时返回 `null`，不做估算。
- 任何派生都不向可移植档案增加字段。Keepraw Fly JSON 格式和存储格式不变。

### 皮肤

一套皮肤是一份官方定义，包含以下部分：

| 部分         | 含义                                                                 |
| ------------ | -------------------------------------------------------------------- |
| `id`、名称键 | `minimal`、`aviation`、`archive`                                     |
| 外观         | 支持哪些外观                                                         |
| 落地视图     | 地址为空时打开的视图                                                 |
| 导航顺序     | 主要目的地的顺序，落地视图排第一                                     |
| 地图主题     | 每种支持的外观对应一个已注册的 [2D 地图主题](map-2d-architecture.md) |
| 护照版式     | 一个已注册的飞行护照模板                                             |
| 令牌         | 颜色、字体、形状、层次、动效等语义角色的取值                         |
| 字体角色     | `ui`、`display`、`data`、`code` 在各文字系统下的字体                 |
| 布局         | 每个视图、每个屏幕档位下的区域排布                                   |
| 变体         | 共享组件的视觉变体（行、统计数字、标题）                             |
| 扩展         | 扩展位里的组件                                                       |

| 皮肤       | 外观       | 落地视图 | 地图主题                                          | 护照版式           |
| ---------- | ---------- | -------- | ------------------------------------------------- | ------------------ |
| `minimal`  | 浅色、深色 | 日志     | 浅色用 Daylight Chart；深色新增一个克制的深色主题 | 单页，跟随地图主题 |
| `aviation` | 深色       | 地图     | Neon Aviation                                     | Neon 单页          |
| `archive`  | 浅色       | 护照     | 新增一个雕版风格的浅色主题                        | 经典护照本         |

- 皮肤是查看偏好，与其他查看设置一起保存在 IndexedDB，不属于可移植档案。另外缓存一个
  外观提示，使首次绘制就使用正确的皮肤，做法与恢复「外观」相同。
- 存储值未知或缺失时取 `aviation`。
- 实际外观：皮肤支持所请求的外观时用它，否则用皮肤唯一的外观。「跟随系统」先解析，再
  受皮肤约束。
- 已保存的「地图主题」「飞行护照版式」取值不再读取。旧版本写入的记录仍可加载。
- 切换皮肤立即生效，无需刷新，不向档案写入任何内容。

#### 阶段 3 的实现范围

- 注册表是 [`skins/registry.ts`](../apps/web/src/skins/registry.ts)。阶段 3 加入了
  `minimal`，以及过渡使用的 `classic` 皮肤（即 v0.3.0 的外观）；后者已在阶段 4 移除。
- `minimal` 浅色用 Daylight Chart，深色用新增的 `graphite-chart` 主题，飞行护照用单页
  版式。
- 根元素带有 `data-skin`。`theme-init.js` 在首次绘制前从外观缓存恢复它，做法与外观相同；
  有测试保证其中的皮肤表与注册表一致。
- 空地址或旧地址打开皮肤的落地视图，主导航把该视图排在第一位。切换皮肤不会把读者从明确
  的地址上移走。
- 只有一种外观的皮肤会禁用「外观」控件并说明原因。
- `minimal` 的令牌、字体角色和布局在
  [`skin-minimal.css`](../apps/web/src/styles/skin-minimal.css)。从宽屏档起，日志行是
  一行表格式的记录；从超宽档起，四个主视图铺满宽度，设置和航班详情保持居中的阅读宽度，并关闭 v0.3.0 对护照工作区的整体放大，
  因此在任何系统缩放下一个单位都是一个 CSS 像素。
- 本阶段不包含：导航栏（rail）、扩展位，以及共享布局之外的矮屏专用布局。

#### 阶段 4 的实现范围

- `aviation` 已注册，并且是默认皮肤。`classic` 已移除：存储值为 `classic` 时，与未知
  或缺失的值一样取 `aviation`，记录中的其他偏好全部保留。
- `aviation` 只有深色。设置中的「外观」置灰、显示为深色并说明原因；已保存的外观值保留，
  供有选择的皮肤使用。首次绘制前页面就是深色，与设备偏好无关。
- 空地址或旧地址打开地图。地图主题是 Neon Aviation，飞行护照是 Neon 单页版式。
- 设置中不再有「地图主题」和「飞行护照版式」，两者都由皮肤决定。旧版本保存的取值在下次
  保存设置时丢弃。护照本版式的代码保留，在 `archive` 选用它之前无法进入。
- 令牌和字体角色在
  [`skin-aviation.css`](../apps/web/src/styles/skin-aviation.css)：靛蓝色表面、一种
  青色强调色、等宽的数据字体角色。尺寸、间距和字号阶梯沿用共享值。
- 从超宽档起，四个主视图铺满宽度，多出的空间给地图。矮屏下缩减页头和页面内边距，不隐藏
  任何内容。
- `flight.extension` 已投入使用。[`skins/extensions`](../apps/web/src/skins/extensions/index.tsx)
  把每套皮肤对应到编译进应用的组件，只交给它们一个由这一条航班计算出的冻结对象。
  `aviation` 显示：
  - 计划与实际两条横条，画在同一条时间轴上，并给出空中时间的差值。需要四个时刻齐全；
    航班取消或备降时不显示；
  - 航班在两地当地时钟上的位置，当地午夜处有刻度，并标出到达的跨日。两地时钟相同或
    时区未知时不显示；
  - 日界线标记，画在两个机场之间的大圆航线与 180° 经线相交的位置。这个位置由航线算出，
    不是记录到的时刻，扩展中有相应说明。
- 这些推导是 [`flight-timeline.ts`](../packages/core/src/flight-timeline.ts) 中的纯函数。
- 本阶段不包含：导航栏（rail）、紧凑档地图的底部抽屉、`aviation` 专用的日志行，以及
  地图、统计、护照三个扩展位的内容（目前没有皮肤使用它们）。

样式规则：

- 组件样式只使用语义令牌。页面样式中写死的颜色在皮肤机制落地时改为令牌；令牌检查覆盖
  皮肤。
- 皮肤提供令牌取值和区域布局，不覆盖其他皮肤，也不隐藏清单中的信息。
- 新的地图外观作为共享 2D 核心上的已注册主题。不使用 3D、WebGL 或外部地图瓦片。

### 字体与语言

十种界面语言在每套皮肤下都必须成立。

- 层级不能依赖大写、斜体、小型大写或窄体。中文、日文、韩文没有这些。拉丁文字标签使用
  它们的地方，同一层级要用字号、字重、颜色或间距来表达。
- 字体族是按皮肤和文字系统（拉丁、简体中文、繁体中文、日文、韩文）定义的角色令牌。页面
  样式不写逐语言的覆盖规则。
- 中文在所有皮肤下都用 MiSans 或 MiSans TC，加载方式与现在相同。`archive` 在 MiSans
  之后的回退是系统中文衬线字体。日文和韩文继续使用系统字体。
- `archive` 的拉丁衬线字体必须是已随应用打包的字体，或新打包、同源提供的字体。新增字体
  属于新依赖，需要所有者批准。
- 代码、航班号、时间、数字和机读码与语言无关，使用 `data` 或 `code` 角色。
- 所有文案走语言资源；十种语言保持齐全。

### 屏幕档位

浏览器看到的是经过系统缩放后的 CSS 像素，所以物理分辨率会合并成几档。4K 开 200 % 和
1080p 是同一种布局。

| 档位 | 条件                     | 典型设备                              |
| ---- | ------------------------ | ------------------------------------- |
| 窄   | 宽度小于 760 px          | 手机                                  |
| 中   | 760–1199 px              | 平板、小窗口                          |
| 宽   | 1200–1919 px             | 1366×768、1080p 开 125 %、2K 开 150 % |
| 超宽 | 1920 px 及以上           | 1080p、2K、4K 开 100–200 %            |
| 矮   | 高度小于 720 px 且不是窄 | 1366×768 笔记本（可用高度约 650 px）  |

760 和 1200 px 两个边界已经存在。超宽和矮是新增的。

- 每套皮肤都要为每个视图的每一档给出布局。
- 矮：压缩界面框架和汇总区的高度；不裁切内容，视图可以滚动。
- 超宽：`minimal` 显示更多列，`aviation` 扩大地图；`archive` 把限宽的页面居中。
- 窄：地图视图是画布加底部抽屉（汇总和列表）。抽屉有展开和收起按钮，不依赖手势。
- 面板遮挡地图时，「适配」把航线放进未被遮挡的区域。
- 细线使用设备像素边框，不用缩放变换。纹理和装饰用矢量。保留现有的发光航线数量上限。

### 不变量

1. 清单中的每一项在每套皮肤、每种外观、每个屏幕档位下都能到达。
2. 每种布局下，焦点顺序和阅读顺序与视觉顺序一致。
3. 窄档位下触控目标不小于 44 px。
4. 文档不出现横向滚动，直到 320 px。
5. Axe 检查通过；尊重「减少动态效果」。
6. 内容安全策略不变，不使用新的外部来源。
7. 可移植档案格式和存储格式不变。
8. 不显示档案里没有记录的内容。

### 验证

| 维度   | 取值                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| 视口   | 390×844、1366×650、1536×864、1920×1080、2560×1440、3840×2160；320×640 用于溢出检查 |
| 像素比 | 默认 1；抽查 1.25、1.5 和 2 下的细线和地图清晰度                                   |
| 语言   | 简体中文、美式英语、德语（标签最长）、日语；十种语言齐全                           |
| 皮肤   | 每套皮肤的每种支持的外观                                                           |

- 自动化：按皮肤和档位检查信息清单；路由（刷新、后退、旧片段、未知航班）；现有的内容安全
  策略测试；[工程规范](engineering-standards.md)中的现有质量门禁。
- 验收使用应用内的示例档案或 `examples/` 中的文件，不使用写死的数据。
- 报告要写明实际运行过哪些浏览器和设备。没有运行的，报告为未验证。

### 阶段

每个阶段是一个可以独立审查的 PR。未经所有者批准，不合并、不发版、不部署。

| 阶段 | 内容                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------- |
| 0    | 本规格                                                                                                     |
| 1    | 视图与路由；可寻址的航班视图（可刷新、可后退）；旧片段兼容；主导航和常驻的添加航班；窄档位触控目标         |
| 2    | 日志（密度、排序、航司与机型筛选）和统计；`packages/core` 中的新派生；`flight.context`；所有档位同一份清单 |
| 3    | 皮肤机制、页面颜色令牌化、字体角色、字号体系、设置中的皮肤选择，以及 `minimal`                             |
| 4    | `aviation` 及其扩展；它成为默认皮肤，v0.3.0 的外观移除                                                     |
| 5    | `archive` 及其扩展                                                                                         |
| 6    | 审查中的其余事项：分层的航班录入、作为独立任务流的导入、欢迎页                                             |

### 不在范围内

第三方皮肤和皮肤导入；数据格式变更；后端、账号或同步；实时航班数据；3D 地图。
