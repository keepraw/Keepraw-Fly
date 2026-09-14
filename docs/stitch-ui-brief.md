# Keepraw Fly — Google Stitch UI brief / Google Stitch UI 设计简报

This document is a design handoff, not an instruction to replace the application.
Keepraw Fly's repository remains the source of truth for behavior, data and
accessibility. Stitch is used to explore composition and visual language; exported
code is reference material that must be reviewed and integrated screen by screen.

本文是视觉设计交接说明，不是让工具覆盖现有应用。Keepraw Fly 仓库仍然是功能、
数据和无障碍行为的唯一事实来源。Stitch 用于探索构图与视觉语言；导出的代码只能作为
参考，必须经过审查并逐页整合。

## 中文使用方法

1. 在 Stitch 新建一个项目。
2. 上传当前 Keepraw Fly 的桌面与移动端截图；可以上传 Flighty 截图作为氛围参考，
   但不要上传真实个人飞行档案。
3. 粘贴下方的 **Master prompt**。第一轮只要求视觉方向，不要立即生成整个产品。
4. 从三个方向中选择一个，再粘贴 **Screen generation prompt**。
5. 完成页面后粘贴 **Review and export prompt**，要求输出设计规则、响应式状态和代码。
6. 将导出的截图、代码、Figma 文件或链接、`DESIGN.md` 以及素材清单交回本仓库。
7. 整合时保留现有 React 逻辑、IndexedDB、JSON/CSV 导入、迁移、测试和无障碍行为；
   不直接用生成项目覆盖 `apps/web`。

## Files to attach / 建议附件

- Current desktop: Flights archive, Flight detail, Passport and Settings.
- Current mobile: Flights archive, Flight detail and add/edit dialog.
- Reference: one or two Flighty screenshots, labelled **mood reference only**.
- Optional: `docs/design-system.md` and a fictional Keepraw Fly JSON example.

Do not attach a real travel archive, passport data, booking confirmation, loyalty
number or any other personal information.

## Master prompt — paste into Stitch

```text
Act as the product design lead for Keepraw Fly, a private, local-first personal
flight archive. Create an original premium visual direction for a responsive web
application. Do not clone Flighty, Apple Maps, any airline app, or any supplied
reference screenshot. References communicate quality, hierarchy and mood only.
Do not reproduce their exact layouts, assets, icons, colors, map styling or trade
dress.

PRODUCT
Keepraw Fly helps people preserve flights they have taken and view their travel
history as a personal aviation memory. It is not a booking product, live flight
tracker, airline operations dashboard or social network. Version 0.1 is entirely
static and local-first: no account, backend, analytics, booking integration or
live flight-status API. Flight data stays in the browser unless the user exports
it.

CORE USER TASKS
1. Create an empty personal archive without preparing a JSON file.
2. Add, edit, duplicate and delete a flight.
3. Search the archive by flight number, airline, airport, city, year or aircraft.
4. Import a validated Keepraw Fly JSON archive after preview and confirmation.
5. Import CSV rows after column mapping, validation and preview.
6. Export a portable JSON archive.
7. View a flight record with scheduled/actual local times, delay, terminals,
   gates, aircraft, registration, seat and cabin when known.
8. View a lifetime or yearly Flight Passport with totals, highlights and routes
   on a world map.
9. Change language, appearance, distance unit, clock format and profile name.

TARGET EXPERIENCE
The product should feel like a beautifully kept aviation journal combined with
a precise instrument. It should feel calm, spatial, tactile and confident—not
like an admin dashboard, marketing landing page or generic card template.

The interface must establish one dominant visual idea per screen. Use geography,
route geometry, time and airport identity as meaningful visual material. Prefer
depth, hierarchy, controlled contrast and purposeful whitespace over repeated
boxes and borders. Dense information is welcome when it is clearly grouped.

VISUAL DIRECTION
- Premium aviation atlas with contemporary native-app clarity.
- Warm neutral daylight theme and a deep night-flight theme.
- A restrained emerald accent for positive/selected states.
- Amber for attention, red for disruption, blue for information and neutral for
  scheduled/unknown states. Operational colors must carry meaning.
- Strong local times, flight number and airport codes; supporting labels remain
  quiet but readable.
- Maps and route diagrams should create spatial context without using proprietary
  Apple Maps imagery or copying Flighty's map treatment.
- Use translucent material only where it explains elevation. Avoid decorative
  glass everywhere.
- Use a small, coherent icon family. Do not insert emoji or mixed icon styles.
- Motion should be short and informative: route reveal, state transition and
  focused sheet movement. Respect prefers-reduced-motion.

TYPOGRAPHY
- Create an explicit scale for Chinese and English rather than mechanically
  scaling one layout.
- Chinese headings must not use negative letter spacing.
- Prefer real 400, 500 and 600 weights. Avoid synthetic or arbitrary weights.
- Suggested desktop ranges: page title 40–52 px, section title 24–28 px, primary
  data 36–48 px, body 15–16 px and supporting text at least 13 px.
- Airport codes, local times and numeric statistics may use a dedicated data face
  with tabular numerals.
- Do not require a large bundled CJK font. Use a credible system-font strategy.

RESPONSIVE TARGETS
- Desktop artboard: 1440 × 1024.
- Tablet artboard: 1024 × 768.
- Mobile artboard: 390 × 844.
- Do not scale the desktop composition down. Recompose it for mobile.
- No content may cross a card or viewport boundary at 200% text zoom.
- English labels may be longer than Chinese labels; avoid fixed text widths.

ACCESSIBILITY
- WCAG AA text contrast in both themes.
- Visible keyboard focus and logical focus order.
- Minimum 44 × 44 px touch targets for primary mobile actions.
- Do not encode flight status by color alone.
- Dialogs need a clear title, close action, cancel action and destructive-action
  separation.
- Empty, loading, invalid import and destructive confirmation states are required.

ORIGINALITY AND ASSET RULES
- Keepraw Fly must have its own visual identity.
- Do not copy Flighty's logo, exact bottom sheet, route card, paywall, iconography,
  copywriting or Apple Maps presentation.
- Use only original assets or assets with licenses that permit redistribution.
- Identify every proposed third-party font, icon, map, illustration and package,
  including its source and license. Prefer no new dependency when CSS or existing
  assets can achieve the result.
- Do not use remote map tiles, remote fonts or analytics by default.

TECHNICAL CONTEXT
The existing application uses React, TypeScript, Vite and plain CSS with semantic
CSS custom properties. It does not use Tailwind or a UI component framework.
Persistent data is stored through an IndexedDB adapter. Navigation uses URL hashes
and the production build is deployed as a relative-base static site.

Generated code is a visual reference. If code export options are available,
prefer semantic React/TypeScript components plus plain CSS variables. Keep domain
logic mocked and isolated. Do not introduce a backend, authentication, live API,
Tailwind, a proprietary map SDK or a new state-management framework.

FIRST RESPONSE
Do not design all screens yet. Produce three clearly different original visual
directions for only these two screens:
A. Flight detail
B. Lifetime Flight Passport

For each direction provide:
- a name and a one-sentence concept;
- desktop and mobile compositions;
- typography, surface, map and icon rationale;
- light and dark behavior;
- strengths, risks and implementation complexity;
- the reusable design tokens it would establish.

Recommend one direction for Keepraw Fly, but keep all three genuinely distinct.
```

## Screen generation prompt — paste after choosing a direction

Replace `[SELECTED DIRECTION]` with the chosen direction name.

```text
Continue the Keepraw Fly project using [SELECTED DIRECTION] as the single design
language. Preserve every constraint in the original brief. Now design the full
responsive product, one coherent screen family rather than unrelated mockups.

Use fictional sample data only. For the primary flight-detail composition use:
- CX 954, Cathay Pacific
- Saturday, 2 May 2026
- HKG, Hong Kong International Airport → TAO, Qingdao Jiaodong International Airport
- scheduled 10:15 → 13:30 local time
- actual 10:10 → 13:24 local time
- arrived 6 minutes early
- duration 3 h 14 min, distance 1,038 mi
- departure Terminal 1, Gate 3; arrival Terminal 1, Gate 13

DESIGN THESE SCREENS AND STATES

1. First run
- Explain that archives remain local.
- Primary action: create a personal archive.
- Secondary action: try fictional demo.
- Tertiary import: open a Keepraw Fly JSON file.

2. Flights archive
- Search, add flight, yearly grouping and compact flight rows.
- Show flight number, airline, route, airport cities, local times and status.
- Include empty, search-no-results and demo-owner states.

3. Add/edit flight dialog
- Airline code and service number must be clearly separate.
- Search airports by IATA code, city or airport name.
- Handle a city with multiple airports without storing a city code as an airport.
- Progressive disclosure for actual times and optional operational facts.
- Include validation, duplicate-as-new and delete-confirmation states.

4. Flight detail
- Make route, local time and operational status the primary hierarchy.
- Combine map or geographic context with a readable record surface.
- Include scheduled versus actual times, delay, duration, distance and optional facts.
- Never let delay labels or values touch or cross their container boundaries.

5. Flight Passport
- Lifetime/year selector, flights, distance, time, airports, airlines, countries
  and routes.
- World map with great-circle routes and visited airport points.
- Highlights for most-flown airline, most-visited airport, longest and shortest flight.
- Make the map meaningful at desktop and mobile sizes rather than a decorative blob.

6. Settings
- JSON import preview, CSV mapping/preview, export and destructive local-data removal.
- Language, theme, distance, clock format and profile name.
- Settings should be compact and calm; it is a utility screen, not a landing page.

7. Shared states
- Light and dark themes.
- Loading and airport-directory retry.
- Keyboard focus.
- Reduced motion.
- 200% text zoom and 390 px mobile width.

For every screen, provide a desktop 1440 px and mobile 390 px design. Add tablet
layouts where composition changes materially. Reuse one navigation model, type
scale, icon system, surface hierarchy and operational color system throughout.
```

## Review and export prompt — paste before exporting

```text
Audit the selected Keepraw Fly design before export.

1. Remove any generic dashboard patterns, excessive cards, oversized empty areas,
   gratuitous gradients, mixed icon styles and low-contrast secondary text.
2. Verify Chinese and English typography separately.
3. Verify that no element crosses its card or viewport at 390 px or 200% text zoom.
4. Verify WCAG AA contrast, visible focus, 44 px mobile targets and non-color status cues.
5. Confirm that no Flighty, Apple Maps or airline proprietary asset or recognizable
   layout has been copied.
6. List every third-party asset, font, icon, map source and package with its license.
7. Replace any asset with unclear redistribution rights.
8. Export or document:
   - desktop and mobile screens;
   - component inventory and state variants;
   - color, typography, spacing, radius, shadow and motion tokens;
   - DESIGN.md;
   - frontend code, preferring React/TypeScript and plain CSS variables;
   - asset files and a license manifest;
   - interaction notes for all dialogs, navigation and responsive changes.

Do not add product features that were not requested. Mark any mocked behavior clearly.
```

## Integration acceptance criteria / 整合验收标准

Stitch output is acceptable for integration only when:

- it improves hierarchy and composition, not merely colors and rounded corners;
- desktop and mobile are intentionally composed;
- all existing product tasks still have a clear place;
- the design works in English and Simplified Chinese;
- no map, font, icon or image has uncertain redistribution rights;
- the visual system can be expressed as semantic tokens and reusable components;
- implementation can preserve IndexedDB, imports, migrations and URL behavior;
- keyboard, reduced-motion and contrast requirements remain testable;
- generated code is small enough to review rather than replacing the repository.

Recommended integration order:

1. Design tokens and navigation shell.
2. Flight detail.
3. Flight Passport and map treatment.
4. Flights archive.
5. Add/edit dialog.
6. Settings and data-management states.
7. Cross-screen responsive, dark-theme and accessibility audit.

Each integration unit should be a separate commit with type checking, automated
tests, a production build and visual review.
