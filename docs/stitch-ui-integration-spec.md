# Keepraw Fly Stitch UI integration specification / Stitch UI 整合规格

[English](#english) | [简体中文](#简体中文)

This specification records the review of the first Stitch export named
`keepraw-fly---avionics-flight-log-&-passport.zip`. The export is untrusted reference
material: it was inspected statically and was not installed, executed or copied over
the application. Keepraw Fly's repository remains the source of truth.

本文记录对第一版 Stitch 导出包 `keepraw-fly---avionics-flight-log-&-passport.zip`
的评审。该导出包属于不受信任的参考材料：评审仅进行静态阅读，没有安装、运行，也没有
覆盖现有应用。Keepraw Fly 仓库始终是产品行为和数据的唯一事实来源。

## English

### Decision

Use the export as a visual reference, not as a replacement application. Keep the
existing domain model, schema validation, IndexedDB adapter, hash navigation,
internationalization, airport directory, import safeguards and Natural Earth map.
Translate selected visual ideas into the existing semantic-token and plain-CSS
system one screen at a time.

The target is a calm premium aviation journal with precise instrumentation. The
export's stronger hierarchy is useful, but its tactical operations-console tone,
telemetry language and visual density should be reduced. Keepraw Fly is a personal
archive, not an airline operations, ACARS or live-tracking product.

### Decision legend

- **Adopt:** the concept fits the product and can be expressed using existing data.
- **Adapt:** preserve the intent, but rebuild the component on Keepraw Fly's system.
- **Reject:** the concept conflicts with product truth, architecture, accessibility,
  licensing or maintainability.

### Screen and component mapping

| Stitch artifact | Existing Keepraw Fly target | Decision | Integration rule |
| --- | --- | --- | --- |
| `Header.tsx` | `AppHeader.tsx` | Adapt | Keep hash navigation and semantic buttons. Explore the compact hierarchy and mobile navigation without copying the component or adding icon-font dependencies. |
| `MobileBottomNav.tsx` | `AppHeader.tsx` responsive state | Adapt | Evaluate a mobile-only bottom navigation after content and safe-area testing. Do not maintain two unrelated navigation models. |
| `FlightsListView.tsx` | `FlightsPage.tsx`, `FlightRow.tsx` | Adapt | Borrow route density, status grouping and stronger open affordance. Preserve current search, localized labels, yearly grouping and keyboard semantics. |
| `FlightDetailView.tsx` | `FlightDetailPage.tsx` | Adapt | Recompose the record header, schedule/actual-time comparison and route surface. Render only facts present in the Keepraw Fly schema. |
| `NewFlightModal.tsx` | `FlightEditor.tsx`, `AirportCombobox.tsx` | Reject implementation; adapt composition | Preserve airline/service-number separation, global airport search, timezone calculation, duplicate flow, delete guard, focus trap and validation. Do not restore free-text airport endpoints or fabricated facts. |
| `PassportView.tsx` | `PassportPage.tsx`, `PassportRouteMap.tsx` | Reject implementation; adapt atmosphere | Keep real derived statistics, lifetime/year filtering, Natural Earth geometry and great-circle routes. The dark atlas/radar surface may inspire styling only. |
| `AirportsRoutesView.tsx` | No 0.1 route | Defer | A separate airport explorer is outside the current milestone. Useful information can first improve archive search and Passport details. |
| `SettingsModal.tsx` | `SettingsPage.tsx` | Adapt selectively | Keep settings as a calm utility page with existing data controls. Do not replace it with a modal or duplicate import/export behavior. |
| `ImportExportView.tsx` | `SettingsPage.tsx`, `ImportControl.tsx`, `CsvImportControl.tsx` | Reject implementation | Preserve schema validation, preview, explicit replacement confirmation, backup and CSV mapping. Visual grouping may be restyled. |
| `QuickSearchModal.tsx` | Existing archive search | Defer | Do not add a second search interaction until a demonstrated cross-screen need exists. |
| `initialFlights.ts` and `types.ts` | `packages/schema`, core demo data | Reject | Do not introduce a parallel schema, static Passport totals or incompatible sample archive. |
| `index.css` | `design-system.css`, `styles.css` | Adapt | Extract ideas into semantic roles; do not paste Tailwind utilities, literal color repetition or remote font imports. |

### Visual ideas to retain

1. Give each screen one dominant piece of aviation information: route and local
   time on detail, geographic history on Passport, and scannable journeys in the
   archive.
2. Use a dark aviation surface for route and map context, balanced by warm neutral
   reading surfaces. Depth must communicate hierarchy, not decorate every block.
3. Use tabular data typography for airport codes, local times, flight numbers and
   statistics; keep prose quieter and comfortably readable.
4. Prefer compact status badges, aligned schedule/actual pairs and clear route
   direction over repeated generic cards.
5. Preserve deliberate mobile recomposition and evaluate bottom navigation as an
   option, with 44 px targets and safe-area support.
6. Keep motion short and informative. Reuse the existing reduced-motion-safe CSS
   layer rather than adding a runtime animation library.

### Product truth and architecture that must remain

- A new user sees the explicit first-run choice; the application must not silently
  install demo data or open a demo record.
- User archives remain behind `StorageAdapter` and `BrowserStorageAdapter` in
  IndexedDB. Viewer preferences remain separate from the portable archive.
- JSON import requires schema validation, preview and explicit replacement
  confirmation. CSV import retains mapping, validation, preview and append semantics.
- URL hashes remain directly addressable and stale record selections must recover
  safely.
- Passport values and routes are derived from the selected archive and period.
- Airports are stored as real IATA airport endpoints, including multi-airport cities;
  city codes are never silently stored as airports.
- The current React, TypeScript, Vite and plain-CSS stack remains. No Tailwind or new
  state-management framework is introduced for visual work.

### Claims and behaviors explicitly rejected

The following export concepts must not appear in UI copy or stored data unless a
future implementation makes them true and independently testable:

- random strings presented as SHA-256 hashes;
- timer animations presented as integrity verification;
- “KEEPRAW ACARS”, telemetry verification or encrypted-archive claims;
- IndexedDB claims while storing the archive in `localStorage`;
- WGS84/geodesic claims for hand-authored SVG curves;
- fixed totals such as 148 flights that do not reflect the active archive;
- PDF promises when the action exports JSON;
- invented operational fields, calculated values or “verified” states without a
  declared source.

### Typography and responsive constraints

- Use the existing language-aware system stacks; do not depend on Google-hosted
  Work Sans, Space Grotesk, JetBrains Mono or Material Symbols at runtime.
- Validate Chinese and English independently. Chinese headings use natural spacing
  and real available weights; Latin data may use the data face and tabular numerals.
- Body copy should normally remain 15–16 px, supporting copy at least 13 px, and
  dense labels must not default to 10–11 px.
- Test 1440 px desktop, 1024 px tablet, 390 px mobile and 200% text zoom. Cards,
  delay values, buttons and labels must remain inside the viewport and their surface.
- All dialogs preserve Escape close, focus containment and focus restoration. Click
  targets must remain semantic buttons or links rather than clickable `div` elements.

### Dependency, asset and license policy

- Prefer existing inline aviation icons, CSS and Natural Earth assets.
- Any proposed font, icon, map, package or image requires source, exact version,
  redistribution license and a notice update before integration.
- Do not inherit unused template dependencies such as Gemini, Express, Motion or
  icon/font packages.
- Do not add remote fonts, remote tiles, analytics, a backend or an API key.
- A missing lockfile, license manifest or ambiguous generated asset blocks direct
  code adoption but does not block using a general layout idea.

### Planned integration units

Each numbered unit is one independently reviewable commit. Later units require
separate user approval.

44. Consolidate semantic color, surface, spacing, radius and elevation tokens.
45. Calibrate Chinese, English and data typography roles and page-level type usage.
46. Recompose the shared shell, navigation, width constraints and responsive states.
47. Redesign the flights archive using the existing search and domain behavior.
48. Redesign the primary flight-detail header and route/time hierarchy.
49. Redesign the remaining flight facts with progressive disclosure.
50. Refine the add/edit dialog without changing airport or validation behavior.
51. Redesign the Passport summary from real derived statistics.
52. Apply the premium atlas treatment to the existing Natural Earth route map.
53. Complete period filtering and accessible map interactions.
54. Refine settings, JSON import/export and CSV workflows.
55. Audit responsive boundaries, keyboard behavior, contrast and reduced motion.
56. Remove any temporary prototype residue and verify dependency size.
57. Update third-party notices for every asset or dependency actually adopted.
58. Update both READMEs and the implementation record.
59. Run the full type, unit, browser, accessibility and production-build release gate.

### Acceptance gate for every implementation commit

- The change uses existing data and does not invent product capability.
- English and Simplified Chinese remain usable.
- Keyboard and reduced-motion behavior do not regress.
- Type checking, relevant tests and the production build pass.
- A focused desktop and 390 px mobile visual check passes; typography changes also
  pass at 200% text zoom.
- New dependencies or assets include measured size impact and license attribution.
- The repository is left in a complete, reversible state before starting the next
  numbered unit.

## 简体中文

### 整合结论

Stitch 导出代码只作为视觉参考，不作为替换应用。现有领域模型、数据格式校验、
IndexedDB 适配器、hash 导航、多语言、机场目录、导入保护以及 Natural Earth 地图全部
保留。选中的视觉思路应逐页翻译到现有语义 token 和纯 CSS 体系中。

目标是“安静、精致的航空旅行档案 + 准确的仪表信息”。Stitch 版本更强的信息层级值得
吸收，但其战术运行控制台风格、遥测术语和过高信息密度需要收敛。Keepraw Fly 是个人
飞行记忆档案，不是航司运行、ACARS 或实时航班追踪产品。

### 决策标记

- **采用：** 概念符合产品定位，而且现有真实数据能够支持。
- **改写：** 保留设计意图，但必须基于 Keepraw Fly 现有组件重新实现。
- **拒绝：** 与产品事实、架构、无障碍、许可证或可维护性冲突。

### 页面与组件映射

| Stitch 文件 | Keepraw Fly 对应位置 | 决策 | 整合规则 |
| --- | --- | --- | --- |
| `Header.tsx` | `AppHeader.tsx` | 改写 | 保留 hash 导航与语义按钮；参考紧凑层级和移动导航，不复制组件、不引入图标字体。 |
| `MobileBottomNav.tsx` | `AppHeader.tsx` 响应式状态 | 改写 | 完成内容区、触控尺寸和安全区域验证后再评估底部导航，不能维护两套互不一致的导航。 |
| `FlightsListView.tsx` | `FlightsPage.tsx`、`FlightRow.tsx` | 改写 | 吸收航线密度、状态分组和打开提示；保留现有搜索、本地化、年份分组与键盘语义。 |
| `FlightDetailView.tsx` | `FlightDetailPage.tsx` | 改写 | 重组记录标题、计划/实际时间和航线表面；只展示 Keepraw Fly 数据格式中真实存在的事实。 |
| `NewFlightModal.tsx` | `FlightEditor.tsx`、`AirportCombobox.tsx` | 拒绝实现、改写构图 | 保留航司/班次分离、全球机场搜索、时区计算、复制流程、删除保护、焦点约束和校验；不恢复自由文本机场或伪造事实。 |
| `PassportView.tsx` | `PassportPage.tsx`、`PassportRouteMap.tsx` | 拒绝实现、改写氛围 | 保留真实派生统计、终身/年度筛选、Natural Earth 地理数据和大圆航线；深色航空地图仅作为风格参考。 |
| `AirportsRoutesView.tsx` | 0.1 暂无对应页面 | 推迟 | 独立机场浏览器不属于当前里程碑；相关信息可先改善档案搜索和护照详情。 |
| `SettingsModal.tsx` | `SettingsPage.tsx` | 局部改写 | 设置继续作为安静紧凑的工具页，不改成弹窗，也不重复数据导入导出逻辑。 |
| `ImportExportView.tsx` | `SettingsPage.tsx`、`ImportControl.tsx`、`CsvImportControl.tsx` | 拒绝实现 | 保留格式校验、预览、明确替换确认、备份和 CSV 映射；只调整视觉分组。 |
| `QuickSearchModal.tsx` | 现有档案搜索 | 推迟 | 在证明存在跨页面搜索需求前，不增加第二套搜索交互。 |
| `initialFlights.ts`、`types.ts` | `packages/schema`、core 演示数据 | 拒绝 | 不引入平行数据格式、写死的护照统计或不兼容演示档案。 |
| `index.css` | `design-system.css`、`styles.css` | 改写 | 将思路提炼为语义角色，不粘贴 Tailwind 工具类、重复色值或远程字体。 |

### 可以保留的视觉思路

1. 每个页面只突出一个航空核心：详情突出航线和当地时间，护照突出地理历史，档案突出
   可快速浏览的行程。
2. 用深色航空表面承载航线和地图，用暖色中性表面承载阅读内容；纵深只表达层级，
   不把所有内容都装进卡片。
3. 机场代码、当地时间、航班号和统计使用等宽数字特征；普通说明文字保持安静且易读。
4. 优先使用紧凑状态标记、对齐的计划/实际时间和明确航线方向，减少通用仪表盘卡片。
5. 移动端需要重新构图；底部导航可以评估，但必须满足 44 px 触控目标和安全区域。
6. 动效应短促且传达状态，继续使用现有兼容“减少动态效果”的 CSS，不引入动画运行库。

### 必须保留的产品事实与架构

- 新用户必须看到明确的首次使用选择，不能静默安装 Demo 或直接打开演示航班。
- 用户档案通过 `StorageAdapter` 和 `BrowserStorageAdapter` 保存到 IndexedDB；查看器偏好
  与可迁移档案继续分离。
- JSON 导入必须经过格式校验、预览和明确的档案替换确认；CSV 继续保留列映射、校验、
  预览与追加语义。
- hash 地址必须可以直接访问；失效的航班选择必须安全恢复。
- 护照统计与航线必须由当前档案和所选期间实时派生。
- 航班端点必须保存真实 IATA 机场，包括多机场城市；不能把城市代码静默存成机场。
- 保留 React、TypeScript、Vite 和纯 CSS，不因视觉改造引入 Tailwind 或新的状态框架。

### 明确拒绝的声明与行为

除非未来真正实现且可以独立测试，否则下列内容不得出现在界面文案或保存的数据中：

- 用随机字符串冒充 SHA-256；
- 用定时动画冒充完整性验证；
- “KEEPRAW ACARS”、遥测验证或加密档案声明；
- 实际使用 `localStorage` 却宣称 IndexedDB；
- 手写 SVG 曲线却宣称 WGS84 或真实测地线；
- 与当前档案无关、写死的“148 次航班”等统计；
- 实际导出 JSON 却承诺 PDF；
- 没有明确来源的运行字段、推算值或“已验证”状态。

### 字体与响应式约束

- 继续使用现有语言感知系统字体，不运行时依赖 Google 托管的 Work Sans、Space Grotesk、
  JetBrains Mono 或 Material Symbols。
- 中文和英文必须分别检查。中文标题使用自然字距与真实可用字重；拉丁数据可以使用数据
  字体和等宽数字。
- 正文通常保持 15–16 px，辅助文字不得低于 13 px，密集标签不能默认使用 10–11 px。
- 检查 1440 px 桌面、1024 px 平板、390 px 手机及 200% 文字缩放；卡片、延误数值、
  按钮和标签不得越出视口或所属表面。
- 弹窗必须保留 Escape 关闭、焦点约束与焦点恢复；可点击项目使用语义按钮或链接，
  不使用可点击 `div`。

### 依赖、素材与许可证政策

- 优先复用现有内联航空图标、CSS 和 Natural Earth 素材。
- 任何新字体、图标、地图、包或图片在整合前都要记录来源、准确版本、再分发许可证，
  并更新第三方声明。
- 不继承 Gemini、Express、Motion 及图标/字体包等未使用的模板依赖。
- 不新增远程字体、远程地图瓦片、分析服务、后端或 API 密钥。
- 缺少锁文件、许可证清单或权利不明确的生成素材不得直接采用代码，但可以借鉴一般构图。

### 后续整合单元

每个编号单元只能对应一个可独立审查的 commit，后续步骤需要用户逐批批准。

44. 收拢颜色、表面、间距、圆角和纵深语义 token。
45. 校准中文、英文和数据字体角色及页面字号使用。
46. 重组公共页面骨架、导航、宽度约束和响应式状态。
47. 在保留现有搜索和领域行为的前提下重设计航班档案。
48. 重设计航班详情主标题以及航线/时间层级。
49. 用渐进披露方式重设计其余航班事实。
50. 精修新增/编辑弹窗，不改变机场与校验逻辑。
51. 使用真实派生统计重设计 Flight Passport 概览。
52. 为现有 Natural Earth 航线地图加入高级航空图册风格。
53. 完成期间筛选和无障碍地图交互。
54. 精修设置、JSON 导入导出和 CSV 工作流。
55. 审计响应式边界、键盘、对比度和减少动效。
56. 清理临时原型残留并验证依赖体积。
57. 为所有实际采用的素材或依赖更新第三方声明。
58. 更新中英文 README 和实施记录。
59. 执行完整类型、单元、浏览器、无障碍和生产构建发布门禁。

### 每次实现提交的验收门槛

- 使用现有真实数据，不虚构产品能力。
- 英文和简体中文继续可用。
- 键盘操作和减少动效不退化。
- 类型检查、相关测试和生产构建通过。
- 通过聚焦的桌面与 390 px 手机视觉检查；字体变更还需检查 200% 文字缩放。
- 新依赖或素材必须同时提供体积影响和许可证说明。
- 开始下一个编号单元前，仓库必须保持完整、可运行、可回退。
