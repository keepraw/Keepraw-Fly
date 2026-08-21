你正在开发一个名为 **Keepraw Fly** 的开源项目。

Keepraw Fly 的目标不是提供实时航班数据，也不是复制 Flighty 的后台服务。

Keepraw Fly 是：

> **An open flight-history data format and a local-first web viewer.**

核心理念：

> **The data outlives the app.**

以及：

> **Keepraw Fly stores facts. The viewer derives meaning.**

Keepraw Fly 的核心资产不是某个 Web 页面，而是开放、稳定、长期可读取的航班数据格式。

用户必须始终拥有自己的数据。

第三方开发者未来可以开发：

- iOS App
- Android App
- Web App
- Desktop App
- CLI
- statistics tools
- converters
- importers
- exporters

只要这些软件遵守 Keepraw Fly Schema，就可以与 Keepraw Fly 数据生态兼容。

---

# 1. Keepraw Fly 的产品边界

Keepraw Fly 第一阶段只负责：

- 定义 Keepraw Fly JSON Schema
- 验证 Keepraw Fly JSON
- 导入 Keepraw Fly JSON
- 本地保存航班记录
- 搜索航班
- 展示航班列表
- 展示单个航班详情
- 计算 Flight Passport
- 导出 Keepraw Fly JSON
- 提供 Light / Dark Mode
- 提供国际化架构

Keepraw Fly 第一阶段明确不负责：

- 实时航班 API
- delay prediction
- push notification
- airline account integration
- booking
- ticket purchase
- boarding pass storage
- email parsing
- screenshot OCR
- AI parsing
- OpenAI / Claude / Gemini API
- payment
- subscription
- analytics SDK
- advertising
- social features

不要自行增加这些功能。

---

# 2. 技术栈

使用：

- React
- TypeScript
- Vite
- CSS
- IndexedDB
- Dexie
- JSON Schema
- Ajv

国际化使用成熟、轻量的 i18n 方案，例如：

- i18next
- react-i18next

不要自行实现一套复杂的翻译框架。

---

# 3. 部署模型

## 默认模式：Static / Local-first

Keepraw Fly Web Viewer 必须能够构建成完全静态的网站。

必须支持部署到：

- Cloudflare Pages
- GitHub Pages
- Vercel
- Netlify
- Nginx
- Caddy
- 普通 VPS 静态目录

Production build 后应该输出类似：

dist/

服务器只负责提供：

- HTML
- CSS
- JavaScript
- static assets

默认模式下：

**用户的航班数据不得上传到 Keepraw Fly 服务器。**

用户数据保存在浏览器 IndexedDB。

结构：

Static Web Hosting
→ Keepraw Fly Viewer
→ Browser IndexedDB

---

# 4. 未来 Self-hosted 支持

虽然第一阶段只实现静态模式，但架构不得阻止未来增加 Self-hosted Storage。

未来可能支持：

Keepraw Fly Web
→ Storage Adapter
→ BrowserStorage

或者：

Keepraw Fly Web
→ Storage Adapter
→ ServerStorage
→ keepraw-fly.json / SQLite

因此存储层必须抽象。

建议：

StorageAdapter

实现：

BrowserStorageAdapter

未来预留：

ServerStorageAdapter

第一阶段不要实现 ServerStorageAdapter。

不要创建：

- backend server
- REST API
- database server
- authentication server

但架构不能把 UI 直接写死到 IndexedDB。

---

# 5. Keepraw Fly 数据原则

Keepraw Fly JSON 是：

> **Portable canonical format**

浏览器 IndexedDB 是：

> **Working storage**

基本流程：

Keepraw Fly JSON
→ Validate
→ Import
→ IndexedDB
→ View / Edit
→ Export
→ Keepraw Fly JSON

用户必须随时可以导出完整数据。

即使 Keepraw Fly 项目停止维护，Keepraw Fly JSON 仍应该可以被其他兼容程序读取。

---

# 6. Locale-neutral 原则

Keepraw Fly 数据必须：

> **locale-neutral**

不要把显示语言写入航班事实。

例如不要在航班数据中保存：

airportName: "Los Angeles International Airport"

航班只需要保存稳定标识，例如：

iata: "LAX"

显示名称应该来自 Viewer 的 reference data。

同一个 Keepraw Fly JSON：

在中文 Viewer 中：

洛杉矶国际机场

在英文 Viewer 中：

Los Angeles International Airport

在日文 Viewer 中：

ロサンゼルス国際空港

Keepraw Fly JSON 本身不需要改变。

---

# 7. 多语言架构

即使第一版只完整支持：

- English
- 简体中文

也必须从第一天建立完整 i18n 架构。

不要在 React component 中写死：

"Flights"
"Passport"
"Import"
"Delayed"

必须使用 translation keys。

例如：

t("nav.flights")
t("nav.passport")
t("actions.import")
t("status.delayed")

建议目录：

locales/
  en.json
  zh-CN.json

以后必须能够轻松加入：

- zh-TW
- ja
- ko
- fr
- de
- es

不要因为增加一种语言而修改 Keepraw Fly Schema。

---

# 8. Reference Data

机场、航空公司、城市、国家等显示名称属于：

> Reference Data

不属于用户航班记录本身。

例如 Keepraw Fly Flight 保存：

origin.iata = "PVG"

Viewer 可以显示：

中文：

上海浦东国际机场

英文：

Shanghai Pudong International Airport

Reference Data 应该允许未来支持：

- localized airport names
- localized city names
- localized airline names
- country names
- coordinates
- timezone
- airport metadata

第一阶段可以只使用必要的 Demo Reference Data。

但结构要允许未来替换成完整机场数据库。

---

# 9. 用户姓名

Flight Passport 支持用户个人名称。

姓名必须考虑不同语言和文字系统。

不要使用：

chineseName
englishName

应使用更通用的字段。

建议：

profile.name.native

以及：

profile.name.romanized

例如：

native:
张鸿川

romanized:
Hongchuan Zhang

另一个用户可以是：

native:
山田太郎

romanized:
Taro Yamada

或者：

native:
김민수

romanized:
Min-su Kim

Viewer 可以根据语言和用户设置决定哪个名字优先显示。

例如中文环境：

张鸿川
Hongchuan Zhang

英文环境：

Hongchuan Zhang
张鸿川

用户应该可以设置：

Primary Name

- Native
- Romanized

不要让姓名显示规则影响航班数据本身。

---

# 10. 单位与语言必须分离

不要假设：

中文 = 公里
英文 = 英里

语言、距离单位、时间格式必须是独立设置。

例如：

Language:
简体中文

Distance:
Miles

Time format:
24-hour

必须支持：

Distance:

- Kilometers
- Miles
- Nautical miles，未来可选

Time:

- 12-hour
- 24-hour

Date display 应根据 locale 格式化。

底层日期数据保持标准格式。

例如：

2026-08-19

中文可以显示：

2026年8月19日

英文可以显示：

Aug 19, 2026

不要修改底层日期。

---

# 11. 时区原则

航班时间必须保存明确时区信息。

例如：

2026-08-19T10:20:00-07:00

不要保存模糊值：

2026-08-19 10:20

scheduledDeparture
scheduledArrival
actualDeparture
actualArrival

应该保留当地机场时间对应的 UTC offset。

Viewer 默认显示：

Local airport time

未来 Power User 可以选择查看 UTC。

切换 UI 语言绝对不能改变航班实际时间。

---

# 12. Keepraw Fly Schema

创建：

Keepraw Fly 0.1 Draft Schema

Schema 第一版保持简单。

不要过度设计。

顶层建议：

{
  "format": "keepraw-fly",
  "formatVersion": "0.1.0",
  "profile": {},
  "flights": []
}

Core Flight 至少支持：

- id
- flightNumber
- serviceDate
- airline
- origin
- destination
- scheduledDeparture
- scheduledArrival
- actualDeparture
- actualArrival

origin / destination：

至少支持：

iata

例如：

{
  "origin": {
    "iata": "SFO"
  }
}

actualDeparture 与 actualArrival 是 optional。

---

# 13. 不保存衍生数据

Keepraw Fly JSON 保存：

> Facts

不要保存：

> Derived statistics

例如：

如果存在：

scheduledDeparture

actualDeparture

就不要把：

departureDelayMinutes

作为 source of truth 保存。

Viewer 自己计算：

actualDeparture - scheduledDeparture

同样不要在 JSON 保存：

- totalFlights
- totalMiles
- totalHours
- mostVisitedAirport
- longestFlight
- yearlyFlightCount

这些必须运行时计算。

---

# 14. Extensions

第一阶段 Core Schema 保持精简。

高级信息通过：

extensions

预留。

例如未来可以支持：

- booking
- seat
- cabin
- aircraft
- aircraft registration
- ticket number
- loyalty
- fare
- notes
- codeshare
- operating carrier

示意：

{
  "extensions": {
    "keepraw-fly.aircraft": {
      "type": "B789",
      "registration": "N12345"
    }
  }
}

普通用户默认不直接操作 extensions。

---

# 15. Unknown Extensions Preservation

这是 Keepraw Fly 兼容性的重要原则。

如果 Keepraw Fly-compatible 软件不认识某个 extension：

它可以不展示。

但是在：

Import
→ Edit
→ Export

过程中，应尽可能保留未知 extension。

例如：

AFlight 不认识：

example.thirdparty

仍然不应该擅自删除。

这个行为未来必须进入 Keepraw Fly conformance tests。

---

# 16. Flights 首页

默认首页是：

Flights

首页重点是：

> 高信息密度 + 快速查找

不是大型卡片 Dashboard。

顶部：

Keepraw Fly

导航：

Flights
Passport
Settings

下面：

Search flights, airports, airlines...

航班按照日期倒序排列。

按年份分组。

桌面端尽量保持：

一班航班一行。

例如：

2026

Aug 19    UA123    SFO → LAX    10:20 → 11:52    +37m
Aug 03    AA178    NRT → DFW    16:30 → 14:45
Jul 21    MU583    PVG → LAX    13:20 → 10:05

2025

Dec 22    UA857    SFO → PVG    13:55 → 19:10

不要把每班航班做成巨大 card。

---

# 17. 移动端 Flights

移动端允许变成紧凑两行布局：

AUG 19

UA123                     +37m
SFO ─────────────── LAX
10:20                  11:52

但依然应该保持：

一个航班一个紧凑列表项目。

不要让用户查看数百条航班时需要大量无意义滚动。

---

# 18. Search

首页 Search 必须能够匹配：

- flight number
- airline code
- airline localized name
- origin IATA
- destination IATA
- airport localized name
- city
- year
- aircraft type，如果存在
- aircraft registration，如果存在

例如搜索：

SFO

应该显示所有经过 SFO 的航班。

搜索：

UA

可以找到 United 航班。

搜索：

Tokyo

可以找到：

NRT
HND

搜索：

东京

在中文 UI 下也应该能够找到对应机场。

搜索逻辑应位于 core 层。

不要写进 React component。

---

# 19. Flight Detail

点击航班进入 Flight Detail。

这里是 Keepraw Fly 最强调视觉体验的页面。

设计目标：

- premium
- minimal
- calm
- information-first
- lots of whitespace
- strong typography
- subtle animation

可以借鉴 Flighty 的信息层级与航班时间线体验。

但禁止直接复制：

- Flighty logo
- Flighty trademark
- Flighty icons
- Flighty exact layout
- Flighty proprietary visual assets

Keepraw Fly 必须形成自己的设计语言。

---

# 20. Flight Detail 信息

重点展示：

- airline
- flight number
- origin
- destination
- airport codes
- departure time
- arrival time
- status
- delay

例如：

UA 123

SFO → LAX

San Francisco
Los Angeles

10:57
12:21

Departure delay
+37 min

Arrival delay
+29 min

Flight Detail 应包含漂亮的 Flight Timeline。

次要信息：

- airport full name
- terminal
- gate
- aircraft
- registration
- seat
- cabin

只有字段存在时才显示。

绝对不要为了填满 UI 而虚构信息。

---

# 21. Flight Passport

导航提供：

Passport

Passport 是用户整体飞行历史视图。

主要统计：

Flights
Distance
Time in the air

然后：

Countries
Airports
Airlines
Aircraft Types

然后：

Most flown airline
Most visited airport
Longest flight
Shortest flight

所有统计都必须由 Keepraw Fly flight records 实时计算。

---

# 22. Passport 年度统计

Passport 提供 Lifetime 和 Year views。

例如：

2026
24 flights
48,201 mi

2025
31 flights
61,822 mi

2024
27 flights
53,910 mi

点击年份未来可以进入：

2026 Passport

显示：

- flights
- distance
- time
- airlines
- airports
- routes

第一阶段可以先实现基础版。

---

# 23. Passport Map

地图未来属于 Passport。

第一阶段不需要实现复杂地图。

只需：

- 预留 Map component
- 预留 route data interfaces
- 不接 Google Maps
- 不接 Mapbox API
- 不增加 API dependency

未来地图可以使用：

- SVG
- MapLibre
- local reference data

机场坐标属于 Viewer reference data。

不要写入每一条航班记录。

Keepraw Fly JSON 可以只保存：

SFO

Viewer 自己查：

SFO → coordinates

---

# 24. Settings

Settings 第一阶段：

## Data

- Import Keepraw Fly JSON
- Export Keepraw Fly JSON
- Clear Local Data

## Language

- English
- 简体中文

## Appearance

- System
- Light
- Dark

## Units

Distance:

- Miles
- Kilometers

Time format:

- 12-hour
- 24-hour

## Profile

- Native Name
- Romanized Name
- Primary Name

## Advanced

Power User Mode

默认：

Off

说明：

> Power users only.
> Enable this only if you understand the Keepraw Fly data model.

第一阶段可以只预留高级编辑 UI。

不要立即实现复杂 raw JSON editor。

---

# 25. Import

用户可以：

Open Keepraw Fly File

或：

Drop .json here

导入前：

必须 Validate。

如果成功：

Import。

如果失败：

显示清晰错误。

例如：

Flight #17

scheduledDeparture

Expected ISO 8601 datetime with timezone.

Received:

"Aug 19 10:30"

不要只显示：

Invalid JSON.

---

# 26. Export

用户必须能够随时：

Export Keepraw Fly JSON

导出的 JSON：

- 必须通过 Keepraw Fly validator
- 必须包含完整航班数据
- 必须尽可能保留 unknown extensions
- 不包含 derived statistics
- 不包含 UI cache
- 不包含 search index
- 不包含临时状态

导出的文件应该是：

portable
readable
stable

---

# 27. Demo Dataset

第一阶段创建一个 Demo Dataset。

建议 20–30 条航班。

必须覆盖：

- US domestic
- China domestic
- transpacific
- international
- on-time
- delayed
- early arrival
- missing optional fields
- multiple timezones
- Chinese airport names
- English airport names
- multiple airlines

Demo 数据必须明确标记为示例。

首次访问且无数据时显示：

Open Keepraw Fly File

以及：

Try Demo

点击 Try Demo 后直接进入完整 UI。

---

# 28. Validator

Validator 是 Keepraw Fly 一等公民。

不要让 Validator 只属于 Web UI。

代码结构必须允许未来发布：

keepraw-fly-validator

例如未来：

npx keepraw-fly-validator flights.json

第一阶段至少实现：

- schema validation
- useful error messages
- test suite

---

# 29. Core Package

核心逻辑必须独立于 React。

packages/core 应负责：

- normalization
- sorting
- search
- filtering
- delay calculations
- duration calculations
- distance calculations
- passport statistics
- yearly statistics
- formatting helpers that are locale-aware where appropriate

React components 不应该承担业务算法。

---

# 30. 项目结构

建议：

keepraw-fly/
  apps/
    web/

  packages/
    schema/
    validator/
    core/

  examples/

  docs/

  LICENSE
  TRADEMARK.md
  README.md

其中：

packages/schema

保存：

- keepraw-fly.schema.json
- schema documentation

packages/validator

保存：

- validation logic
- tests

packages/core

保存：

- business logic
- derived calculations

apps/web

只负责：

- UI
- navigation
- IndexedDB integration
- user interaction

---

# 31. 视觉设计

避免：

- Bootstrap aesthetic
- enterprise admin dashboard
- giant cards everywhere
- excessive shadows
- gradients everywhere
- unnecessary borders
- glassmorphism
- overly colorful UI

Keepraw Fly 应该像：

高品质 consumer application。

重点：

- typography
- spacing
- hierarchy
- alignment
- restrained motion
- clear information density

Flights：

效率优先。

Flight Detail：

视觉体验优先。

Passport：

个人历史感优先。

---

# 32. Accessibility

基础支持：

- keyboard navigation
- semantic HTML
- accessible buttons
- accessible inputs
- clear focus states
- sufficient contrast
- screen-reader friendly labels

不要为了视觉效果破坏基本可访问性。

---

# 33. Mobile First

必须重点测试：

iPhone Safari

布局最低支持：

320px width

桌面和移动端使用同一代码库。

不要创建独立 mobile app。

第一阶段目标是：

Web + PWA-friendly architecture

但不要为了 PWA 添加复杂后台功能。

---

# 34. 第一阶段禁止开发

第一阶段不要实现：

- backend
- user accounts
- cloud sync
- VPS server persistence
- API
- flight status API
- AI parser
- OCR
- email parsing
- CSV importer
- interactive world map
- advanced raw editor
- payment
- subscription
- push notification

即使觉得“很容易”，也不要自行添加。

---

# 35. 第一阶段开发顺序

严格按以下顺序：

## Milestone 0

Project skeleton

- React
- TypeScript
- Vite
- workspace structure
- build system
- i18n architecture

## Milestone 1

Keepraw Fly 0.1 Draft Schema

以及：

- basic examples
- schema tests
- validator

先确保 Schema 清晰。

## Milestone 2

Demo Dataset

准备稳定测试数据。

## Milestone 3

Flights Homepage

实现：

- grouped flight list
- search
- responsive layout

## Milestone 4

Flight Detail

实现基础视觉设计。

## Milestone 5

Flight Passport

实现：

- lifetime stats
- yearly stats
- profile display

## Milestone 6

Import / Export

实现：

- validate
- import
- IndexedDB persistence
- export

## Milestone 7

Settings

实现：

- language
- appearance
- units
- time format
- profile names

## Milestone 8

Polish

- responsive
- mobile Safari
- accessibility
- empty states
- error states
- subtle animation

---

# 36. 第一阶段完成标准

Keepraw Fly 0.1 第一阶段完成时：

用户第一次打开：

Keepraw Fly

→ Try Demo

→ Flights list

→ Search

→ 点击航班

→ Flight Detail

→ Passport

→ 查看统计

然后用户可以：

Import Keepraw Fly JSON

→ Validate

→ Save locally

→ Close browser

→ Reopen

→ Data remains

→ Export Keepraw Fly JSON

并且：

切换：

English / 简体中文

不修改航班数据。

切换：

Miles / Kilometers

不修改航班数据。

切换：

12h / 24h

不修改航班数据。

切换：

Native / Romanized primary name

不修改航班历史。

---

# 37. 开发原则

代码必须：

- simple
- readable
- typed
- modular
- maintainable
- testable

不要为了未来可能存在的需求建立复杂抽象。

但是以下边界必须明确：

- Schema 与 Viewer 分离
- Core 与 React 分离
- Storage 与 UI 分离
- Reference Data 与 Flight Data 分离
- Localization 与 Flight Data 分离
- Derived Data 与 Stored Facts 分离

不要自行扩大 scope。

---

# 38. 完成后输出

完成第一阶段实现后：

1. 列出完整目录结构。
2. 解释 Schema 设计。
3. 解释 Storage abstraction。
4. 解释 localization architecture。
5. 解释 Flights search architecture。
6. 解释 Passport statistics 如何计算。
7. 列出所有尚未实现功能。
8. 运行 tests。
9. 运行 production build。
10. 修复所有 TypeScript / build errors。
11. 确认可以作为纯静态网站部署。
12. 不要自行开始下一阶段。

如果某个需求存在多个合理实现：

优先选择最简单、最开放、最不依赖第三方服务的实现。

Keepraw Fly 的最终原则：

> **The data outlives the app.**

> **Keepraw Fly stores facts. The viewer derives meaning.**

> **Keepraw Fly data is locale-neutral.**

> **Static by default. Self-hostable by design.**