# Implementation Status / 实施状态

[English](#english) | [简体中文](#简体中文)

- Product: Keepraw Fly
- Version: 0.1.0
- Last updated: 2026-09-02
- Current milestone: local ownership, safe import and visual-system foundation complete

## English

### Completed work

1. **Project foundation and branding**
   - Established the pnpm workspace, TypeScript configuration and Vite web app.
   - Standardized the product name as Keepraw Fly and the machine format identifier as `keepraw-fly`.
   - Added the MIT license, trademark notice, PWA-friendly manifest and application icon.

2. **Portable data format**
   - Defined the Keepraw Fly 0.1 types and JSON Schema.
   - Added Ajv validation with readable issue paths.
   - Preserved unknown extension fields during validated import and export.

3. **Demo data and domain logic**
   - Added a fictional 24-flight archive covering multiple countries and timezones.
   - Added airport, airline and aircraft reference data.
   - Implemented search, distance, duration, delay and passport-statistics calculations.

4. **Flights archive**
   - Built a dense, responsive flight list with multilingual labels.
   - Reworked the mobile archive into compact rows with aligned airport codes and local times.
   - Added search across flight numbers, airports, cities and airlines.
   - Kept search in the core layer and covered localized airline/airport names, years, aircraft facts and normalized full-width input.
   - Added a first-run flow that creates an empty archive without requiring JSON.
   - Added guided add, edit and delete forms with automatic airport timezone offsets.
   - Added actual local times plus optional terminal, gate, aircraft, registration, seat and cabin facts.
   - Separated airline codes from service numbers, with known-airline suggestions, unlisted-code entry and full-number paste handling.
   - Distinguished the persistent fictional demo from a user-owned personal archive.
   - Added empty states and navigation to individual flight records.
   - Guarded stale detail/editor selections so deleting the active flight returns safely to the archive.

5. **Flight detail**
   - Built a responsive origin-to-destination timeline.
   - Added scheduled/actual times, duration, distance, delay and conditional operational facts.
   - Added accessible semantic structure for desktop and narrow mobile layouts.

6. **Flight Passport**
   - Added lifetime and yearly summaries.
   - Added totals for flights, distance, time, airports, airlines, countries and routes.
   - Added profile-name presentation using native and romanized forms.
   - Added a recognizable bundled world map with real airport projection, great-circle routes, date-line handling and frequency encoding.

7. **Local data and preferences**
   - Added IndexedDB persistence behind `StorageAdapter` and `BrowserStorageAdapter`.
   - Added validated JSON file import, drag-and-drop import and export.
   - Added an import summary, explicit archive-replacement confirmation and an in-flow backup action.
   - Added language, theme, distance-unit, clock-format and primary-name settings.
   - Kept viewer preferences separate from the portable archive document.

8. **Release readiness and documentation**
   - Added English and Simplified Chinese interfaces.
   - Added relative-base static builds suitable for static hosting.
   - Added a root-level production preview command and documented the local HTTP workflow.
   - Documented architecture, schema behavior, deployment and intentionally deferred scope.
   - Added bilingual repository entry points and this delivery record.
   - Established semantic visual tokens for themes, type, spacing, shape, controls, focus and motion.
   - Rebalanced display, statistic, section, body and caption typography with separate Simplified Chinese calibration.

### Verification completed

- TypeScript type checking passes across the workspace.
- All 37 automated tests pass: 17 core, 7 validator and 13 web tests.
- The Vite production build completes successfully.
- Browser checks covered first-run archive creation, demo ownership, guided flight facts, safe import preview, persistence, the world route map, desktop and 320 px layouts, search, detail navigation, Passport, settings and hash deep links.
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

### Deliberately deferred

Backend accounts and sync, live flight services, third-party booking integrations, advanced importers, third-party interactive basemaps, payments and native apps are outside the 0.1 milestone. See [docs/not-implemented.md](docs/not-implemented.md) for the complete list.

## 简体中文

### 已完成工作

1. **项目基础与品牌名称**
   - 建立 pnpm workspace、TypeScript 配置和 Vite Web 应用。
   - 将产品名统一为 Keepraw Fly，机器格式标识统一为 `keepraw-fly`。
   - 添加 MIT 许可证、商标说明、适合 PWA 的 manifest 和应用图标。

2. **可迁移数据格式**
   - 定义 Keepraw Fly 0.1 类型和 JSON Schema。
   - 使用 Ajv 完成校验，并提供易读的问题路径。
   - 经过校验的导入与导出可以保留未知扩展字段。

3. **演示数据与领域逻辑**
   - 添加一份覆盖多个国家和时区的 24 段虚构航班档案。
   - 添加机场、航空公司和机型参考数据。
   - 实现搜索、距离、时长、延误和飞行护照统计计算。

4. **航班档案页**
   - 构建紧凑、响应式并支持多语言标签的航班列表。
   - 将移动端档案重构为紧凑列表，并让机场代码与各自当地时间清晰对齐。
   - 支持按航班号、机场、城市和航空公司搜索。
   - 搜索逻辑保持在 core 层，并覆盖航司/机场本地化名称、年份、机型信息与全角输入规范化。
   - 添加无需 JSON 文件即可创建空白档案的首次使用流程。
   - 添加引导式航班新增、编辑和删除表单，并自动计算机场时区偏移。
   - 添加实际当地时间以及可选的航站楼、登机口、机型、注册号、座位和舱位事实。
   - 将航司代码与航班序号分开录入，支持已知航司建议、未收录代码和完整航班号粘贴。
   - 明确区分会持续保存的虚构演示档案与用户自己的个人档案。
   - 添加空状态以及前往单条航班记录的导航。
   - 对失效的详情与编辑选择增加保护，删除当前航班后会安全返回档案列表。

5. **航班详情页**
   - 构建从出发地到目的地的响应式时间线。
   - 展示计划/实际时间、时长、距离、延误和按条件出现的运行信息。
   - 为桌面端和窄屏移动端添加可访问的语义结构。

6. **Flight Passport（飞行护照）**
   - 添加终身汇总和按年份汇总。
   - 统计航班、距离、时间、机场、航空公司、国家和航线总数。
   - 支持使用原文姓名和罗马字姓名展示个人资料。
   - 添加可识别的内置世界地图，支持真实机场投影、大圆航线、日期变更线处理和飞行频次表达。

7. **本地数据与偏好设置**
   - 在 `StorageAdapter` 和 `BrowserStorageAdapter` 抽象后实现 IndexedDB 持久化。
   - 添加经过校验的 JSON 文件导入、拖放导入和导出。
   - 添加导入摘要、明确的档案替换确认和流程内备份入口。
   - 添加语言、主题、距离单位、时间格式和主要姓名设置。
   - 将查看器偏好与可迁移的飞行档案分开保存。

8. **发布准备与文档**
   - 添加英文和简体中文界面。
   - 添加适用于静态托管的相对路径生产构建。
   - 添加根目录生产预览命令，并记录本地 HTTP 查看流程。
   - 记录架构、数据格式行为、部署方式和明确推迟的范围。
   - 添加双语仓库入口和本交付记录。
   - 建立覆盖主题、字体、间距、形状、控件、焦点和动效的语义化视觉 token。
   - 重新平衡展示标题、统计数字、章节、正文和说明文字，并单独校准简体中文字体表现。

### 已完成验证

- 整个 workspace 的 TypeScript 类型检查通过。
- 37 项自动化测试全部通过：核心逻辑 17 项、校验器 7 项、Web 端 13 项。
- Vite 生产构建成功完成。
- 浏览器检查覆盖首次建档、演示档案归属、引导式航班事实、安全导入预览、持久化、世界航线图、桌面及 320 px 窄屏布局、搜索、详情导航、飞行护照、设置以及 hash 深链接。
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

### 明确推迟的范围

后端账户与同步、实时航班服务、第三方预订集成、高级导入器、第三方交互式底图、支付和原生应用不属于 0.1 里程碑。完整清单见 [docs/not-implemented.md](docs/not-implemented.md)。
