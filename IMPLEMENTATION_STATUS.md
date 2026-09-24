# Implementation Status / 实施状态

[English](#english) | [简体中文](#简体中文)

- Product: Keepraw Fly
- Version: 0.1.0
- Last updated: 2026-09-24
- Current milestone: Keepraw Fly 0.1.0 release documentation and import pipeline complete

## English

### Recent development progress — 2026-09-24

- Added native Flighty CSV import, including Flighty header mapping, ICAO airline to IATA flight-number normalization, cabin-class normalization and append-only preflight validation.
- Completed the canonical CSV field set for terminal, gate, cancellation and diversion data, with airport-local timestamp parsing and continued RFC 3339 offset compatibility.
- Preserved existing canonical document fields during CSV and Flighty append imports, including frequent-flyer memberships and their flight references.
- Removed the settings-page Hero so the data controls begin directly below the shared navigation.

- Reworked Flight Detail against the Stitch export as a visual source of truth while preserving the real map, existing data binding, editor, copy action, routing and business fields.
- Completed the English, Simplified Chinese and Traditional Chinese i18n audit for Flight Detail, including locale-aware dates, dynamic early/late status text and localized airline, city and airport names from the data layer.
- Added explicit Simplified and Traditional Chinese UI font stacks. Latin airport codes, flight numbers, times and numeric data continue to use Inter.
- Separated `ticketNumber` from `bookingReference`, retained nullable string `baggageCarousel`, and removed the obsolete checked-baggage field and UI.
- Moved frequent-flyer accounts to user-level memberships. Flights now reference `membershipId` and retain `tierAtFlight` as an immutable historical snapshot.
- Replaced free-text airline associations with a searchable, duplicate-safe multi-select backed by the airline database, removable chips and a constrained `defaultAirline` selector.
- Added backward-compatible migration for older ticket, baggage and frequent-flyer extensions, comma-delimited airline associations and legacy default-airline representations. New exports emit the canonical typed structure.

### Completed work

1. **Project foundation and branding**
   - Established the pnpm workspace, TypeScript configuration and Vite web app.
   - Standardized the product name as Keepraw Fly and the machine format identifier as `keepraw-fly`.
   - Added the MIT license, trademark notice, PWA-friendly manifest and application icon.

2. **Portable data format**
   - Defined the Keepraw Fly 0.1 types and JSON Schema.
   - Added Ajv validation with readable issue paths.
   - Preserved unknown extension fields during validated import and export.
   - Added explicit, non-destructive migrations for the former `rawfly` identifier and `0.1` version shorthand at both file-import and browser-storage boundaries.

3. **Demo data and domain logic**
   - Added a fictional 24-flight archive covering multiple countries and timezones.
   - Added airport, airline and aircraft reference data.
   - Replaced the small airport sample with a pinned, MIT-licensed offline directory of 7,800+ IATA airports, including coordinates and IANA timezones.
   - Implemented search, distance, duration, delay and passport-statistics calculations.

4. **Flights archive**
   - Built a dense, responsive flight list with multilingual labels.
   - Reworked the archive into an open, route-first ledger where airport codes and local times lead, while identity, date and status deliberately recede.
   - Reordered the same flight content for narrow screens without duplicate mobile markup, preserving atomic codes, times and flight numbers.
   - Removed the decorative route aircraft, open chevron and empty-state symbol; a single directional rule now keeps each row reading as one flight.
   - Added search across flight numbers, airports, cities and airlines.
   - Kept search in the core layer and covered localized airline/airport names, years, aircraft facts and normalized full-width input.
   - Added a first-run flow that creates an empty archive without requiring JSON.
   - Added guided add, edit and delete forms with automatic airport timezone offsets.
   - Replaced fixed airport dropdowns with searchable, keyboard-accessible airport inputs that accept code, city or airport name.
   - Added multi-airport city aliases and explicit airport-name context while preventing city codes from being stored as endpoints.
   - Added actual local times plus optional terminal, gate, aircraft, registration, seat and cabin facts.
   - Separated airline codes from service numbers, with known-airline suggestions, unlisted-code entry and full-number paste handling.
   - Distinguished the persistent fictional demo from a user-owned personal archive.
   - Added empty states and navigation to individual flight records.
   - Guarded stale detail/editor selections so deleting the active flight returns safely to the archive.
   - Added recent-airport suggestions and a duplicate-as-new flow that prefills facts while generating a fresh record ID.

5. **Flight detail**
   - Built a responsive origin-to-destination timeline.
   - Recast the route hero as an open, type-led composition with aligned airport codes, cities and local times plus one semantic direction line.
   - Removed the decorative gradient, concentric geometry, aircraft mark, elevation and rounded panel treatment while preserving route hierarchy and truthful status.
   - Grouped the timeline, delay summary and optional facts with whitespace, alignment and minimal rules instead of layered cards.
   - Kept delay labels and values inside their section at desktop, zoomed and narrow-mobile widths with regression coverage.
   - Added scheduled/actual times, duration, distance, delay and conditional operational facts.
   - Added latest-event operational status and removed empty optional-facts sections when no facts were recorded.
   - Added accessible semantic structure for desktop and narrow mobile layouts.

6. **Flight Passport**
   - Added lifetime and yearly summaries.
   - Made yearly Passport views explicit, selected-state-aware and complete across flights, distance, time, airlines, airports and routes.
   - Added meaningful empty-archive guidance and frequency context for favorite airlines and airports.
   - Added totals for flights, distance, time, airports, airlines, countries and routes.
   - Added profile-name presentation using native and romanized forms.
   - Replaced the hand-drawn world outline with on-demand generated Natural Earth geometry, a Natural Earth 1 projection, adaptive great-circle routes, date-line clipping and frequency encoding.
   - Flattened the atlas to semantic map colors without gradients or route glow, changed period selection from pills to tabs and replaced editorial two-column sections with a compact archive sequence.

7. **Local data and preferences**
   - Added IndexedDB persistence behind `StorageAdapter` and `BrowserStorageAdapter`.
   - Added validated JSON file import, drag-and-drop import and export.
   - Added Keepraw Fly CSV and native Flighty CSV import with automatic/manual mapping, preview, canonical conversion, airport-local timezone checks and append-only confirmation.
   - Added an import summary, explicit archive-replacement confirmation and an in-flow backup action.
   - Added language, theme, distance-unit, clock-format and primary-name settings.
   - Kept viewer preferences separate from the portable archive document.
   - Rebuilt settings as a compact, layered control surface with lightweight inline icons and responsive cards.

8. **Release readiness and documentation**
   - Added English and Simplified Chinese interfaces.
   - Added relative-base static builds suitable for static hosting.
   - Added a root-level production preview command and documented the local HTTP workflow.
   - Documented architecture, schema behavior, deployment and intentionally deferred scope.
   - Added bilingual repository entry points and this delivery record.
   - Added a least-privilege GitHub Actions workflow for frozen installs, type checking, tests and production builds.
   - Added a separate, least-privilege GitHub Pages workflow that verifies and publishes the static artifact on `main` or manual dispatch.
   - Split the 7,800+ airport directory from application JavaScript into a separately cached static asset with an explicit, retryable loading state.
   - Added Playwright coverage for first-run creation, add/edit/delete, validated JSON import and Passport map rendering in Chromium.
   - Established semantic visual tokens for themes, type, spacing, shape, controls, focus and motion.
   - Rebuilt bilingual typography around explicit UI, display and data families plus semantic size, leading, weight and tracking tokens.
   - Optically calibrated Simplified Chinese display sizes and line heights while keeping flight numbers, airport codes, local times and statistics stable with tabular numerals; no font file or dependency is bundled.
   - Unified every public screen behind one semantic page shell with shared content width, responsive gutters, vertical rhythm, sticky navigation bounds and device safe-area handling.
   - Kept desktop and mobile navigation on one responsive structure, with a single 760 px transition and contained overflow for unusually narrow viewports.
   - Defined an executable visual-composition contract with one dominant idea per page, four explicit hierarchy levels, restrained surface/elevation rules and anti-SaaS review criteria for later page work.
   - Established static responsive acceptance rules for 1440 px, 1024 px and 390 px baselines, including content-compression priority, atomic flight data, modal/sticky bounds, themes and reduced motion.
   - Extended the foundation with layered surfaces, operational status colors, data typography, elevation roles and reusable airport-code, status-badge and aviation-icon primitives.
   - Added a CSS-only motion language for page hierarchy, staggered archive rows, control feedback, route drawing and airport-point reveals.
   - Gated all new motion behind the operating-system preference and strengthened the global reduced-motion fallback.
   - Audited light and dark UI with Axe, added CI-enforced WCAG checks, and completed modal Escape, focus containment and focus restoration behavior.

### Verification completed

- TypeScript type checking passes across the workspace.
- All 166 unit/integration tests pass: 58 core, 13 validator and 95 web tests.
- Playwright coverage includes Flight Detail localization and responsive layout, import workflows, frequent-flyer behavior, route-first archive constraints and WCAG audits; the release-preparation run uses the locally available system Chrome when the bundled browser is unavailable.
- The Vite production build completes successfully.
- Browser checks cover first-run archive creation, import migration, guided flight editing, global airport/airline search, the world route map, localized Flight Detail layouts at desktop and 390 px mobile widths, frequent-flyer membership editing, responsive archive and Passport views, themes, modal behavior and hash deep links.
- Airline and airport reference data remains offline; the Chinese typography update adds no remote font, bundled CJK font, UI library or runtime lookup.
- The browser console was clean in the final verification run.

### Milestone commits

1. `5102f20` — Initialize Keepraw Fly workspace
2. `24bd80c` — Define Keepraw Fly schema and validator
3. `6a81bcc` — Add demo data and flight history core
4. `b864933` — Build searchable responsive flights archive
5. `485712c` — Create premium flight detail timeline
6. `4ea691b` — Add lifetime and yearly flight passport
7. `46b86dc` — Persist archives and add data settings
8. `ffe9d2a` — Polish static release and document architecture
9. `c96d418` — Add bilingual README and implementation status
10. `2082177` — Add guided archive and flight creation
11. `4a3dd14` — Replace route preview with world flight map
12. `81d4d25` — Document guided editing and route maps
13. `ba2dd4f` — Clarify demo mode and archive ownership
14. `ad371b2` — Add actual times and optional flight facts
15. `ed437f0` — Preview imports and protect archive replacement
16. `b2669ca` — Document and add production preview
17. `8685d3e` — Rebalance typography across the viewer
18. `1ea87e3` — Clarify airline and flight number entry
19. `0d084ef` — Prevent white screens after flight deletion
20. `f21f3a9` — Refine compact mobile flight rows
21. `d6925f7` — Strengthen core flight search
22. `3cf9d5d` — Refine the flight detail route hero
23. `95b2316` — Complete flight detail status information
24. `2dfdb99` — Complete the lifetime flight passport
25. `8980322` — Add offline global airport search
26. `622a7a2` — Handle multi-airport cities explicitly
27. `c25bda6` — Elevate the settings experience
28. `e7c9211` — Rebuild Passport map with Natural Earth
29. `5c143e4` — Establish premium aviation design primitives
30. `06bce1d` — Elevate flight archive and detail experience
31. `db636d4` — Add reduced-motion-safe interaction polish
32. `31df07a` — Add continuous integration workflow
33. `0049a78` — Split airport directory from initial bundle
34. `79f448f` — Add critical browser journey tests
35. `6ab3517` — Migrate legacy flight archives safely
36. `eeeade7` — Speed up repeat flight entry
37. `15baf7b` — Add mapped CSV flight import
38. `32d2e1f` — Complete accessibility and theme audit
39. `321759c` — Automate static GitHub Pages releases
40. `30b47b5` — Rebuild language-aware typography scale
41. `cd05915` — Keep delay facts within responsive cards
42. `3fd5431` — Add Google Stitch UI design handoff
43. `cf30d1e` — Rebuild bilingual typography system
44. `6f20610` — Unify shared page layout
45. `14547bd` — Redesign the flight archive list
46. `3c06f69` — Add import preflight and preview
47. `4375e20` — Add duplicate flight detection
48. `c0ae049` — Make Passport statistics explorable
49. `2d24ff2` — Add smart camera behavior to flight maps
50. `2c58ef8` — Enrich flight records and refine details
51. `f4fc6fe` — Restyle Flight Detail from the Stitch reference
52. `f45582d` — Complete the Flight Detail localization audit
53. `f9b1fc2` — Refine Chinese Flight Detail typography
54. `2805ee2` — Correct flight metadata relationships
55. `eb7aeab` — Fix frequent-flyer airline associations

### Deliberately deferred

Backend accounts and sync, live flight services, third-party booking integrations, advanced importers, third-party interactive basemaps, payments and native apps are outside the 0.1 milestone. See [docs/not-implemented.md](docs/not-implemented.md) for the complete list.

## 简体中文

### 近期开发进度 — 2026-09-24

- 增加 Flighty 原生 CSV 导入，包括 Flighty 表头映射、ICAO 航司代码到 IATA 航班号规范化、舱位规范化以及追加前预检。
- 完成 canonical CSV 字段中的航站楼、登机口、取消和备降支持；机场当地时间解析继续兼容带 offset 的 RFC 3339 时间。
- 修复 CSV 与 Flighty 追加导入时的 canonical 顶层字段保留，包含常旅客会员及航班引用。
- 删除设置页 Hero，使数据设置直接从共享导航下方开始。

- 以 Stitch 导出稿作为视觉 source of truth 重构 Flight Detail，同时保留真实地图、现有数据绑定、编辑、复制、路由和业务字段。
- 完成 Flight Detail 的英文、简体中文和繁体中文 i18n 审计，包括按 locale 格式化日期、动态生成提前/延误状态，以及从数据层取得本地化航司、城市和机场名称。
- 为简体中文和繁体中文建立明确的 UI 字体栈；机场代码、航班号、时间和数字数据中的拉丁字符继续使用 Inter。
- 将 `ticketNumber` 与 `bookingReference` 分开保存，保留可空字符串类型的 `baggageCarousel`，并删除语义错误的“是否托运行李”字段与界面。
- 将常旅客账户调整为用户级 membership；航班通过 `membershipId` 引用账户，并使用 `tierAtFlight` 保存不可变的历史等级快照。
- 将自由文本的关联航司改为基于航司数据库的可搜索多选，支持去重、删除标签，并让 `defaultAirline` 只能从已关联航司中选择。
- 为旧版客票、行李和常旅客扩展、逗号分隔的关联航司以及旧默认航司表示增加向后兼容迁移；新导出统一使用规范的类型化结构。

### 已完成工作

1. **项目基础与品牌名称**
   - 建立 pnpm workspace、TypeScript 配置和 Vite Web 应用。
   - 将产品名统一为 Keepraw Fly，机器格式标识统一为 `keepraw-fly`。
   - 添加 MIT 许可证、商标说明、适合 PWA 的 manifest 和应用图标。

2. **可迁移数据格式**
   - 定义 Keepraw Fly 0.1 类型和 JSON Schema。
   - 使用 Ajv 完成校验，并提供易读的问题路径。
   - 经过校验的导入与导出可以保留未知扩展字段。
   - 在文件导入与浏览器存储边界添加明确、非破坏性的迁移，兼容旧 `rawfly` 标识和 `0.1` 版本简写。

3. **演示数据与领域逻辑**
   - 添加一份覆盖多个国家和时区的 24 段虚构航班档案。
   - 添加机场、航空公司和机型参考数据。
   - 将小型机场样本替换为固定版本、MIT 许可的离线目录，覆盖 7,800 多个 IATA 机场及坐标和 IANA 时区。
   - 实现搜索、距离、时长、延误和飞行护照统计计算。

4. **航班档案页**
   - 构建紧凑、响应式并支持多语言标签的航班列表。
   - 将档案重构为开放式、航线优先的连续记录，让机场代码与当地时间成为主角，航班身份、日期和状态主动退后。
   - 窄屏使用同一份航班内容重新编排，不再维护重复的 Mobile 摘要，同时保持机场代码、时间和航班号不可拆分。
   - 移除装饰性航线飞机、打开箭头和空状态符号，仅保留一条有方向语义的线，让每行更像完整的一趟航班。
   - 支持按航班号、机场、城市和航空公司搜索。
   - 搜索逻辑保持在 core 层，并覆盖航司/机场本地化名称、年份、机型信息与全角输入规范化。
   - 添加无需 JSON 文件即可创建空白档案的首次使用流程。
   - 添加引导式航班新增、编辑和删除表单，并自动计算机场时区偏移。
   - 将固定机场下拉框替换为支持键盘操作的搜索输入，可按代码、城市或机场名称查找。
   - 添加多机场城市别名与明确的机场全名，并防止将城市代码误存为航班端点。
   - 添加实际当地时间以及可选的航站楼、登机口、机型、注册号、座位和舱位事实。
   - 将航司代码与航班序号分开录入，支持已知航司建议、未收录代码和完整航班号粘贴。
   - 明确区分会持续保存的虚构演示档案与用户自己的个人档案。
   - 添加空状态以及前往单条航班记录的导航。
   - 对失效的详情与编辑选择增加保护，删除当前航班后会安全返回档案列表。
   - 添加最近机场建议和“复制为新航班”流程，在预填事实的同时生成全新的记录 ID。

5. **航班详情页**
   - 构建从出发地到目的地的响应式时间线。
   - 将航线主视觉改为开放式字体构图，对齐机场代码、城市和当地时间，并只保留一条具有方向语义的路线。
   - 移除装饰性渐变、同心几何、飞机标记、阴影和大圆角面板，同时保留明确的航线层级与真实状态。
   - 使用留白、对齐和最少量分隔线组织时间线、延误摘要与可选事实，不再依赖分层卡片。
   - 确保延误标签和数值在桌面、缩放及窄屏移动端均保持在区块边界内，并加入回归覆盖。
   - 展示计划/实际时间、时长、距离、延误和按条件出现的运行信息。
   - 添加基于最新运行事件的航班状态，并在没有可选事实时隐藏空白详情区块。
   - 为桌面端和窄屏移动端添加可访问的语义结构。

6. **Flight Passport（飞行护照）**
   - 添加终身汇总和按年份汇总。
   - 将年度护照完善为带明确选中状态的独立视图，覆盖航班、距离、时间、航司、机场与航线。
   - 添加空档案引导，并为最常乘坐航司和最常到访机场补充次数信息。
   - 统计航班、距离、时间、机场、航空公司、国家和航线总数。
   - 支持使用原文姓名和罗马字姓名展示个人资料。
   - 将手绘世界轮廓替换为按需加载的 Natural Earth 生成地理数据，使用 Natural Earth 1 投影、自适应大圆航线、日期变更线裁剪和飞行频次表达。
   - 将地图收敛为无渐变、无航线 glow 的语义色图层，把周期选择从 pill 改为 tab，并将 editorial 式左右分栏改为紧凑的档案序列。

7. **本地数据与偏好设置**
   - 在 `StorageAdapter` 和 `BrowserStorageAdapter` 抽象后实现 IndexedDB 持久化。
   - 添加经过校验的 JSON 文件导入、拖放导入和导出。
   - 添加 Keepraw Fly CSV 与 Flighty 原生 CSV 导入，支持自动/手动列映射、预览、规范格式转换、机场当地时区检查和确认后追加。
   - 添加导入摘要、明确的档案替换确认和流程内备份入口。
   - 添加语言、主题、距离单位、时间格式和主要姓名设置。
   - 将查看器偏好与可迁移的飞行档案分开保存。
   - 将设置页重构为紧凑且有层次的控制界面，使用轻量内联图标和响应式卡片。

8. **发布准备与文档**
   - 添加英文和简体中文界面。
   - 添加适用于静态托管的相对路径生产构建。
   - 添加根目录生产预览命令，并记录本地 HTTP 查看流程。
   - 记录架构、数据格式行为、部署方式和明确推迟的范围。
   - 添加双语仓库入口和本交付记录。
   - 添加最小权限 GitHub Actions 工作流，执行冻结依赖安装、类型检查、测试和生产构建。
   - 添加独立、最小权限的 GitHub Pages 工作流，在推送 `main` 或手动触发时先验证再发布静态产物。
   - 将 7,800 多个机场的目录从应用 JavaScript 中拆为可独立缓存的静态资源，并提供明确且可重试的加载状态。
   - 添加 Playwright Chromium 覆盖，验证首次建档、增改删航班、JSON 导入预览和护照地图渲染。
   - 建立覆盖主题、字体、间距、形状、控件、焦点和动效的语义化视觉 token。
   - 围绕明确的界面、展示和数据字体角色重建双语字体体系，并以语义 token 统一字号、行高、字重和字距。
   - 对简体中文展示字号与行高进行视觉校准，同时通过等宽数字保持航班号、机场代码、当地时间和统计数字稳定；不打包字体文件或增加依赖。
   - 将所有公共页面统一到同一个语义化页面骨架，共享内容宽度、响应式左右留白、纵向节奏、粘滞导航边界与设备 safe area 处理。
   - Desktop 与 Mobile 导航沿用同一套响应式结构，以 760 px 作为统一切换点，并在异常窄的 viewport 内约束导航溢出。
   - 为后续页面任务定义可执行的视觉构图契约：每页一个主导构图、四级信息层级、克制的表面/纵深规则以及 anti-SaaS 验收标准。
   - 为 1440 px、1024 px 与 390 px 基准建立静态响应式验收规则，覆盖内容压缩优先级、不可拆分航班数据、modal/sticky 边界、主题和 reduced motion。
   - 扩展分层表面、运行状态颜色、数据字体和纵深角色，并建立可复用的机场代码、状态徽章和航空图标组件。
   - 添加纯 CSS 动效语言，覆盖页面层级、档案行错峰出现、控件反馈、航线绘制和机场点出现。
   - 所有新动效均受操作系统偏好约束，并加强全局“减少动态效果”降级。
   - 使用 Axe 审计浅色与深色界面，将 WCAG 检查纳入 CI，并补齐弹窗的 Escape、焦点约束与焦点恢复行为。

### 已完成验证

- 整个 workspace 的 TypeScript 类型检查通过。
- 166 项单元/集成测试全部通过：核心逻辑 58 项、校验器 13 项、Web 端 95 项。
- Playwright 覆盖 Flight Detail 本地化与响应式布局、导入流程、常旅客行为、航线优先档案约束和 WCAG 审计；发布准备时在 bundled browser 不可用的环境中使用本机 Chrome 验证。
- Vite 生产构建成功完成。
- 浏览器检查覆盖首次建档、导入迁移、引导式航班编辑、全球机场/航司搜索、世界航线地图、桌面及 390 px 移动端的本地化 Flight Detail、常旅客账户编辑、响应式档案与护照页面、主题、弹窗行为和 hash 深链接。
- 航司与机场参考数据继续离线提供；中文字体更新没有引入远程字体、打包 CJK 字体、UI 库或运行时查询。
- 最终验证时浏览器控制台无错误。

### 阶段 commit

1. `5102f20` — 初始化 Keepraw Fly workspace
2. `24bd80c` — 定义 Keepraw Fly 数据格式与校验器
3. `6a81bcc` — 添加演示数据与飞行历史核心逻辑
4. `b864933` — 构建可搜索的响应式航班档案页
5. `485712c` — 创建高质量航班详情时间线
6. `4ea691b` — 添加终身及年度飞行护照
7. `46b86dc` — 持久化档案并添加数据设置
8. `ffe9d2a` — 完善静态发布与架构文档
9. `c96d418` — 添加双语 README 与实施状态文档
10. `2082177` — 添加引导式建档与航班录入
11. `4a3dd14` — 将航线预览替换为世界飞行地图
12. `81d4d25` — 记录引导式编辑与航线地图
13. `ba2dd4f` — 明确演示模式与档案归属
14. `ad371b2` — 添加实际时间与可选航班事实
15. `ed437f0` — 预览导入并保护档案替换
16. `b2669ca` — 记录并添加生产预览流程
17. `8685d3e` — 重新平衡查看器字体比例
18. `1ea87e3` — 明确航司与航班号录入
19. `0d084ef` — 防止删除航班后出现白屏
20. `f21f3a9` — 优化移动端紧凑航班列表
21. `d6925f7` — 加强 core 层航班搜索
22. `3cf9d5d` — 优化航班详情航线主视觉
23. `95b2316` — 补齐航班详情状态信息
24. `2dfdb99` — 完善终身飞行护照
25. `8980322` — 添加离线全球机场搜索
26. `622a7a2` — 明确处理多机场城市
27. `c25bda6` — 提升设置页体验
28. `e7c9211` — 使用 Natural Earth 重建飞行护照地图
29. `5c143e4` — 建立高级航空视觉基础组件
30. `06bce1d` — 提升航班档案与详情体验
31. `db636d4` — 添加兼容减少动效的交互精修
32. `31df07a` — 添加持续集成工作流
33. `0049a78` — 从初始包拆分机场目录
34. `79f448f` — 添加关键浏览器用户流程测试
35. `6ab3517` — 安全迁移旧版飞行档案
36. `eeeade7` — 加快重复航班录入
37. `15baf7b` — 添加带列映射的 CSV 航班导入
38. `32d2e1f` — 完成可访问性与主题审计
39. `321759c` — 自动化 GitHub Pages 静态发布
40. `30b47b5` — 重建语言感知的字号体系
41. `cd05915` — 确保延误信息保持在响应式卡片内
42. `3fd5431` — 添加 Google Stitch UI 设计交接资料
43. `cf30d1e` — 重建双语字体系统
44. `6f20610` — 统一共享页面布局
45. `14547bd` — 重构航班档案列表
46. `3c06f69` — 添加导入预检与预览
47. `4375e20` — 添加重复航班检测
48. `c0ae049` — 让飞行护照统计可探索
49. `2d24ff2` — 为航班地图添加智能镜头
50. `2c58ef8` — 丰富航班记录并优化详情
51. `f4fc6fe` — 按 Stitch 参考重构航班详情
52. `f45582d` — 完成航班详情国际化审计
53. `f9b1fc2` — 优化中文航班详情字体
54. `2805ee2` — 修正航班 metadata 关系
55. `eb7aeab` — 修正常旅客关联航司

### 明确推迟的范围

后端账户与同步、实时航班服务、第三方预订集成、高级导入器、第三方交互式底图、支付和原生应用不属于 0.1 里程碑。完整清单见 [docs/not-implemented.md](docs/not-implemented.md)。
