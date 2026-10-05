# CSS dead code / legacy selector audit

当前基线：PR #10 合并后的 `c690075`；本轮仅修复两个 undefined CSS token，修改 `passport.css` 与本报告，详见下方 resolved 记录。PR #9 的原始调查基线是 PR #8 合并后的 `15db4b6`；PR #10 confirmed-dead removal 的基线是 `222b3c9`。下文 selector occurrence/source 行号、删除统计及调查细节保留各自历史基线，避免抹掉发现和删除依据。PR #10 只修改7个 feature CSS及本报告；本轮未修改 React markup、breakpoint、import order、design-system、测试或两个审计脚本。

## 口径与结果（当前统计，重新运行脚本）

扫描全部 12 个 feature stylesheet，以及 `pages/`、`components/`、`App.tsx`、`main.tsx`、helpers、core/status 类型、测试、示例和 public HTML/SVG。以下文件名均指 `apps/web/src/styles/`；组件和页面分别指 `apps/web/src/components/`、`apps/web/src/pages/`。行号对应上述基线。

| 指标 | 结果 / 口径 |
|---|---|
| Selector 分支 | 1,018 次出现，706 个不同 selector 文本（PR #9：1,247 / 866）；逗号列表拆分，排除 keyframe steps，保留 media context |
| Class identifier | 321 个不同名称（PR #9：390）；以下 B/C/D 数量按名称计，**不是可删除的整条 rule 数量** |
| B — 原70个候选 | 69个名称完全删除；1个仅删除正向规则、保留实际有效的否定分支，见下方更正 |
| C — Likely legacy | 7；有现存测试引用，因此不满足用户要求的严格 B 标准 |
| D — Dynamic / unsafe | 32 个状态或变体名称；生成路径见下表，不凭完整字符串搜索删除 |
| 其余 source-backed class | 281；找到组件/入口字面量，仍须按完整组合 selector 判断是否匹配 |
| E — Cascade dependency | 与 A/D 正交；同文件重复 selector 文本193组，Detail 59、Passport 57（PR #9：253 / 108 / 66）；减少来自删除dead分支，未合并规则 |
| Runtime | Chromium、38 个状态、273 个不同 class；无 page error，无横向溢出 |

字面量搜索仅提供线索。本次另外检查 JSX `className` 的字符串、条件、template、变量 initializer 和 prop 调用点，逐一对照有限 enum/status 返回值。没有外部字符串直接写入 class、HTML 注入或第三方 UI 容器；public airline SVG 的内部 class 与候选不相交。地图 DOM 来自已检查的 React SVG 组件，lazy loading 不改变其 class 来源。`timeline` 只在 locale JSON 中作为翻译 key 出现，不是 DOM class。

## B：Confirmed dead candidates（70，PR #9 历史记录）

**批次状态：removed in PR #10**。下表保留原始70名称及证据；69个已完全移除，`detail-flight-icon` 的正向规则已删，但否定分支必须保留。本轮没有其他未删除候选。

表中每个逗号分隔项都表示 `.class`。原始共同证据：没有 JSX/HTML/SVG class 引用、没有测试 selector 依赖、没有 prop 调用点或动态构造可以生成该名称；运行时也未观察到。**更正：没有生成某个class，不代表引用它的 `:not()` 分支无效**；`detail-flight-icon` 的例外见下方运行时证据。置信度 High **限于本 repo 当前入口和数据构造**，不声称浏览器采样能穷尽所有状态。

| Selector 名称 | 文件 / 首次位置 | 数量 / 额外证据 | 删除批次 |
|---|---|---|---|
| `detail-toolbar`, `back-button`, `detail-action`, `detail-action-primary`, `detail-action-secondary` | flight-detail.css:1–28 | 5；当前动作在 `AppHeader.tsx:31–68`，使用 `detail-header-*` | removed in PR #10 |
| `airport-role`, `airport-code`, `detail-airport-city`, `route-hero`, `route-origin-role`, `route-arrival-role`, `route-origin-code`, `route-arrival-code`, `route-origin-time`, `route-arrival-time`, `route-time`, `route-airport-name`, `route-track`, `route-track-line` | flight-detail.css:98–137 | 14；`AirportStop` 使用 `detail-stop-*`；**保留**当前仍使用的 `route-origin/arrival-city` 和 `route-origin/arrival-airport` | removed in PR #10 |
| `timeline`, `timeline-grid`, `timeline-event`, `timeline-dot`, `timeline-place`, `timeline-stem` | flight-detail.css:139–154；motion.css:44 | 6；当前时间在 stop timing 和 segment metadata，locale key 不是引用 | removed in PR #10 |
| `delay-summary`, `delay-positive`, `flight-facilities`, `flight-facts`, `fact-groups`, `fact-group`, `facility-grid`, `facility-grid--single`, `facility-stop`, `facility-stop-heading`, `facility-values`, `facility-terminal`, `gate-sign`, `facts-grid`, `detail-item` | flight-detail.css:156–205；motion.css:50 | 15；当前 facts、metadata 使用 `detail-stop-facts`、`detail-metadata-*`、`detail-record-item` | removed in PR #10 |
| `detail-airline-line`, `detail-heading-meta`, `detail-duration`, `detail-flight-icon`, `detail-route-map-heading`, `operation-badge-group`, `operation-badge`, `mobile-gate-signage`, `detail-mobile-baggage`, `detail-desktop-only`, `mobile-gate-sign`, `mobile-gate-terminal` | flight-detail.css:68,71,82,190,351,419,420,429,586,589,592 | 12；当前 heading summary、stop facts 和 responsive metadata 均有不同 class | PR #10：11个完全删除；icon仅正向规则删除 |
| `flight-record-meta`, `flight-airport`, `flight-airport-arrival`, `passport-holder-name`, `passport-exploration-heading`, `passport-exploration-summary`, `passport-related-flights`, `year-list`, `year-history`, `passport-mobile-period` | passport.css:1,90,98,100,117,138,142,146,154,177 | 10；当前 archive row 及探索条已使用不同子结构；exploration 本身仍活跃 | removed in PR #10 |
| `edit-flight-button`, `wordmark-context`, `page-placeholder`, `page-heading` | controls.css:35；shell.css:91；welcome.css:1；motion.css:38 | 4；当前按钮、wordmark、welcome、heading 来源均已核对 | removed in PR #10 |
| `map-land`, `is-secondary` | route-map.css:7,28 | 2；`MapWorld.tsx:18–32` 生成 countries/coastline；`PassportRouteMap.tsx:223` label 不产生 secondary modifier | removed in PR #10 |
| `is-completed`, `is-on-time` | flight-detail.css:78,449；passport.css:399 | 2；core `FlightOperationalStatus` 没有 completed；`delayDirection()` 返回 `onTime`，不是 `on-time` | removed in PR #10 |

本轮按 selector 分支处理：motion 的 `.search-field, .primary-stats, .timeline` 只删除 `.timeline`；`.search-field` 仍active，`.primary-stats` 属C类，两者均保留。所有与B名称相邻的active规则均保留。

### 本批删除记录 / hidden dependency

- **69个 class identifiers 完全移除，229个 selector branches 删除，CSS净减325行（全部12个feature文件：2,204→1,879行）**。删除210个完整rule，另9个grouped rule仅去掉dead分支；没有media block变空，没有合并或移动任何media/rule。
- 文件净减：flight-detail **225行**（672→447）、passport **60行**（701→641）、shell **32行**（226→194）、motion **3行**（56→53）、welcome **3行**（35→32）、route-map **2行**（74→72）、controls **0行**（82→82，删除group分支）。
- 唯一更正：`.detail-heading-eyebrow > span:not(.detail-flight-icon)` 实际匹配 `FlightDetailPage.tsx` 的 `.detail-airline-name`。当前CSS位置为 `flight-detail.css:161`。浏览器验证 `matches=true`，computed为 `max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap`。这个分支的现有效果依赖“class不存在”，所以保留原selector、声明及顺序；只删旧 `.detail-flight-icon` / `.detail-flight-icon svg` 两个正向分支。后续工具必须区分正向条件与 `:not()`，不能只按class集合删整条selector。
- PR #10 结构核对：保留的每个selector分支、declaration原文、顺序、media context与删除前一致；7个C名称和32个D名称的所有分支均保留。当时 `--color-ink` / `--line-strong` 未修复（本轮已 resolved，见下方）；duplicate/cascade/media cleanup未进行。
- 原报告中的B候选不再是待删清单；这个更正后的有效否定分支归入 **Keep**，不是后续dead removal候选。

## C：Likely legacy（7）

| Selector | 可疑原因 / 现存证据 | 删除前核对 |
|---|---|---|
| `.passport-heading`, `.route-map-heading`, `.route-map-legend`, `.section-heading` | 当前组件不生成；`e2e/keepraw-fly.pw.ts:444` 明确断言旧标题不存在 | 保留负断言，确认 lazy map、空 archive、桌面 highlights 均不依赖旧结构 |
| `.primary-stats`, `.passport-counts` | `PassportPage.test.tsx:50–51`、`e2e/passport-legend.pw.ts:30`、主 E2E:387 有负断言 | 核对新 legend/mobile summary；不要删除测试保护 |
| `.map-graticule` | `MapWorld` 不生成；主 E2E:1004 断言不存在 | 针对 outline、regional camera、Passport/Detail SVG 做回归 |

另有 **完整组合 selector** 的 legacy 风险：passport.css:106 的 `.flight-row .aviation-status--neutral/positive` 当前 row 不渲染 `FlightStatusBadge`，但 badge 是有测试的导出组件，tone 又是动态生成。归入 focused verification，不加入 70 个 B 名称，也不能删共享 tone。

## A / D：活跃入口与动态陷阱

| Selector / 构造 | 明确来源 → 行为 | 判断 |
|---|---|---|
| `.flight-row`, `.flight-route-cities`, `.flight-time-column`, `.flight-status` | `FlightRow.tsx:63–129` → archive 行、时刻、状态 | A；四种 Passport 尺寸均观察到 |
| `.passport-period`, `[aria-pressed="true"]`, `.passport-exploration`, `.passport-exploration-close` | `PassportPage.tsx:175–180,283–287` → 年份、探索筛选及关闭 | A；探索子结构变了，父规则不能当 dead |
| `is-cancelled`, `is-delayed`, `is-diverted`, `is-early`, `is-onTime`, `is-late`（6） | `FlightRow.tsx:120` + `calculations.ts:20–35`；`FlightTime.tsx:18` + `time-display.ts:26–28` | D；大小写必须原样保留；fixture 覆盖全部六种名称 |
| `detail-stop--departure/arrival`（2） | `FlightDetailPage.tsx:58`，kind union → 两个 stop | D；不是搜索不到就 dead；运行时两个方向均存在 |
| `import-control-primary/settings`（2）；`import-disposition-new/possible`（2） | `ImportControl.tsx:16,92`；`CsvImportControl.tsx:169` + `duplicate-detection.ts:3` | D；primary/settings 与 new/possible preview 均观察到；exact 是 enum 值但无对应 feature class rule |
| `aviation-status--neutral/positive`（2） | `AviationPrimitives.tsx:42–64`，status→tone；组件测试覆盖 positive | D；保留生成能力，另核对上面的 row 组合规则 |
| `is-low/medium/high`（3），`is-visited`, `is-outline-hidden`（2） | `MapWorld.tsx:17–27` → visits intensity、outline | D；low/medium 有生成路径，单一 fixture 未覆盖不算 dead |
| `is-selected`, `is-highlighted`, `has-highlight`, `is-unavailable`（4） | `FlightRow.tsx:63–65`、`PassportRouteMap.tsx:171–205`、`PassportPage.tsx:43` | D；map selection、hover/focus、spotlight 数据不足分支 |
| `demo-banner--compact`, `site-header--detail`, `detail-mobile-fact--wide`, `detail-record-item--wide`（4） | `DemoBanner.tsx:12`、`AppHeader.tsx:31`、`FlightDetailPage.tsx:94,225` | D；React state / prop / 字段长度条件 |
| `is-protected`（1），`import-stat-problem/possible/exact`（3），`confirmation-danger`（1） | `SettingsPage.tsx:324`、`ImportPreflightSummary.tsx:30–42`、`ConfirmationDialog.tsx:106` | D；storage、preview counts、dialog tone |
| `.detail-airport-time`, `.detail-scheduled-time`, `.route-origin/arrival-city`, `.route-origin/arrival-airport` | `FlightDetailPage.tsx:62–75` → kind 条件及 `FlightTime` 的 className prop | A；名字像 route hero 不代表它们属于 dead hero |
| `.map-country`, `.map-airport`, `.map-tooltip-*`, `.detail-map-route` | lazy `PassportRouteMap` / `FlightRouteMap`、`MapWorld`、`MapViewport` | A；SVG 非 HTML 搜索、异步挂载、hover tooltip 都要纳入 |
| `.csv-import-control:has(> input:focus-visible)`，`.app-shell:has(.settings-page/.recovery-page)`，`[aria-current]`、`[aria-selected]`、`:disabled`、`::before` | 文件 input focus、Settings/Recovery PageShell、AppHeader、AirlineMultiSelect、原生 form state | A；需匹配祖先/状态，不能用是否有完整 className 字符串判断 |

D 合计 32 个 feature CSS 中存在的 modifier/variant 名称。`is-expanded`、`is-origin/is-destination`、`airport-code-display--compact/display` 虽也动态生成，但没有本次 feature selector 对应项，不计入 32；其组件不能因此被判 dead。className passthrough（PageShell、FlightTime、AviationIcon、AirportCode、MapViewport）均已检查调用点。

## E：Duplicate / cascade hotspots

所有重复分支、media context、每次 occurrence 的 properties/values 均可由静态脚本 JSON 重建；这里只记录影响后续决策的热点。同一 selector 文本的 specificity 相同，但 media 条件和不同组合 selector 的 specificity 必须另算。

| Selector / occurrence 行 | Properties：覆盖与保留 | 结论 |
|---|---|---|
| `.passport-layout`：225 base；494 desktop；562 mobile；665 desktop | 225 的 display/grid、columns、gap、align-items；494 增加 height/min-height/margin；665 改 columns/gap、加 rows，**仍依赖**225 display 和494高度；mobile 改 flex/direction/gap | **KEEP BOTH**；不能只留665 |
| `.passport-archive .flight-row`：308 base；582 mobile；671 desktop | base grid、min-height、columns、gap、align、padding、border/border-bottom/radius/background；582改 columns/gap；671改 width/columns/gap/align/padding；基础 border、背景等继续生效 | **KEEP BOTH**；且 `.flight-row` specificity 0,1,0，archive 0,2,0 |
| `.flight-route-cities`：359 base；361 base；632 mobile；642 narrow；679 desktop | 359 display/min-width/align-items 与361 gap/color/font-size/font-weight/line-height 不冲突；679改 gap/color/font-size/weight，仍依赖 display/min-width/align/line-height；632/642 同一 font-size 值 | 359+361 **SAFE TO CONSOLIDATE LATER**（相邻同 scope）；其余 **KEEP BOTH**，narrow 重复值可单独验证 |
| `.passport-exploration`：137；`.passport-archive .passport-exploration`：465、621 mobile、661 base | 137 grid placement/template 仍保留，但布局从 grid→block→flex；465 margin/padding/border-top 和621的 top override 被661 margin/padding/border shorthand 覆盖 | **NEEDS RUNTIME VERIFICATION**（本次证实8px/10px）；后续整理仍需保留早期未重写的 grid 属性 |
| `.passport-exploration-close`：140、662 base | 140 flex/padding/border/border-bottom/color/background/font；662只重复同值 flex；字体、padding、hover仍来自140 | **SAFE TO CONSOLIDATE LATER**（仅662冗余 flex）；140不是 dead；本轮仅修复底边 token 并作1px局部尺寸补偿，未合并规则 |
| `.year-list` 等旧子树的重复规则 | B 表对应名称及它们的 mobile、pressed、hover 分支 | 原判断为 **LIKELY LEGACY**（重复规则性质），使用证明达到B；这些dead分支已在PR #10删除，未合并规则 |
| `.detail-flight-card`：35 base、209 motion、223 mobile、321 base | 35 overflow/margin-top/border-top/bottom/radius/color/background/shadow；321 overflow visible、margin0、border0、透明background，重写基础box属性；209 animation独立保留 | **SAFE TO CONSOLIDATE LATER**（仅base box两组，保留motion/media及shorthand次序） |
| `.detail-heading`：46、210 motion、224 mobile、331、561 mobile | 46 flex/align/justify/gap/padding/border-bottom/background；331改 display/block、padding/border/background；align/justify/gap仍有computed值，motion独立；561重复padding0 | **NEEDS RUNTIME VERIFICATION**；将base挪过224会改变mobile gap |
| `.detail-airport-time`：125、240 mobile、434、597 mobile、642 | 125 margin0保留；434改font-size/weight/tracking/leading，字体/features/nowrap仍相同；597再改mobile字号/weight/tracking；642加display flex/align/gap | **KEEP BOTH**；当前desktop44px/700（1440）、40px/700（1024），mobile24px/600 |
| `.detail-route-map`：188、266 mobile、453、525 desktop、603 mobile、657 desktop | 188 overflow/padding/border-top/color/background；453重写padding/border、加height/radius/shadow；657再改height/radius/shadow；603隐藏；canvas/world规则独立 | **KEEP BOTH**；desktop 900px高时432px，mobile不挂载map |
| `.detail-stop-meta .is-early`：448；`.flight-deviation.is-early`：passport.css:653 | 两者 specificity 0,2,0；passport 后导入，color 从 positive 覆盖为 muted；其他 stop-meta 布局仍在 | **KEEP BOTH**；早到 Detail 实测 `rgb(98,103,98)`；不能把 Passport 样式理解为只作用 Passport |

跨文件还要保留：controls 的 `.view-switcher`/button 给 `.passport-period.view-switcher` 基础行为；Settings 的 `.settings-membership-add` mobile display 覆盖 controls `.button-secondary`；motion 在 settings 后保证 hover transform 优先级。E 不是“后面出现，所以前面无用”。

## Media query inventory

| 文件 / breakpoint | 次数与 block 起始行 | 各 block 责任 / 后续可能性 |
|---|---|---|
| passport / max760 | 3：185、550、695 | 旧 row/card 与空archive；新 mobile panels/summary/rows；最终 period/status/time补丁。先删除 B 子树，再评估合并；不可直接挪到一起 |
| passport / min761 | 2：472、664 | viewport 高度、sticky/archive滚动；最后 ledger columns/map/legend/highlights编排。KEEP，跨越mobile和unconditional规则 |
| passport / max420 | 1：637 | 更窄 row 内容与文字尺寸；非重复 block，部分属性同max760值，可 focused verification |
| detail / max760 | 4：216、537、543、664 | 旧 hero/facilities；过渡grid/metadata；新 mobile header/stops/facts；最终隐藏adjacent和stop spacing。537/543相邻，同query，可未来原序拼接；其余先审顺序 |
| detail / min761 | 2：520、653 | 旧 operational grid/map/metadata；最后网格比例、map高度、metadata间距。KEEP；第二块覆盖第一块部分属性 |
| detail / max420 | 1：629 | narrow stop-place/time typography；非重复 block |
| controls、welcome、import、settings、flight-editor、shell / max760 | 各1：78、32、59、126、64、195 | 各自 mobile controls/页面/form/header；无同feature重复 |

其它 query：settings:95 为 min761 且 max1024 的独立 tablet 设置宽度；shell:223 max370。motion/reduced-motion 条件独立，不混入宽度重复计数。

重点链条实证：passport:465 的 base margin/padding → :621 的 mobile `margin-top:24px; padding-top:24px` → :661 unconditional `margin:8px 0; padding:10px 12px`。后两者 specificity 同为0,2,0。390×844 的 computed top 确为8px/10px；1440、1024、768亦相同。并非此次拆分引入的问题，本 PR 保留。

## Custom properties

扫描 feature + design-system 的全部 `var()`，当前共151个不同引用名称：137个有 design-system 定义，9个 feature-local，5个由TSX inline style定义，**0个 unresolved undefined token**。历史统计：PR #9 为156 / 140 / 9 / 5 / 2，PR #10 为153 / 137 / 9 / 5 / 2。PR #10 删除旧规则减少了引用名称，没有改token定义或任何保留声明；本轮删除错误的 `--color-ink` 引用，并将 `--line-strong` 改为已存在的 `--color-line-strong`，未新增 alias。跨 theme、media 与继承 scope 已核对；“有定义”不等同于“任意元素都在定义 scope 内”。

| 分类 / 变量 | 定义、fallback 与运行时结果 | 影响 |
|---|---|---|
| defined | `design-system.css` 的 root、light/dark、system dark media 定义与 aliases | 保留；theme 切换实际检查 light/dark |
| feature-local（9） | `--detail-inline`（detail:31,222,315,560）；`--settings-control-width`（settings:2,96）；7个 `--passport-mobile-panel-*` / `--passport-mobile-card-*-size`（passport:554–560） | scope为对应page，mobile tokens在同media消费；不是缺失全局token |
| runtime-defined（5） | `--flight-row-index`（FlightRow:73）；`--map-item-index`, `--map-route-opacity/strength/width`（PassportRouteMap:101–104,131,238–239） | map path从所属g继承；frequency sample也提供所需width/strength；保留 |
| **Resolved：`--color-ink`** | 原 passport:361 `color:var(--color-ink)` 没有定义/fallback；desktop:679 `var(--muted)`胜出，mobile颜色继承row。现已删除该无效 color declaration，保留 desktop 覆盖 | 修复前后均为 desktop light `rgb(98,103,98)`、dark `rgb(164,171,182)`；390 mobile light `rgb(32,35,31)`、dark `rgb(244,246,248)`。mobile应继承父级正文色，desktop城市名应低于机场码层级；无需绑定全局token或新增alias |
| **Resolved：`--line-strong`** | 原 passport:140 `border-bottom:1px solid var(--line-strong)` 没有定义/fallback；两主题、desktop/mobile变量均空，computed为 `0px / none / currentColor`。现改为 `var(--color-line-strong)` | 两主题、四尺寸均为 `1px / solid`；light `rgba(32,35,31,0.18)`、dark `rgb(55,65,81)`。这是现有 neutral control boundary token；close文字、hover和focus颜色保持原样 |

未解析的 `var()` 是 **invalid at computed-value time**：属性使用 inherited/initial（unset）结果，**不会回退到更早的同属性声明**。因此这里的“被忽略”不能理解为从cascade重新挑一个旧值；`--color-ink` 在desktop则是另一个valid声明先赢得cascade。

### Undefined token 独立修复记录（resolved）

- 原因：`c0ae049`（2026-09-18）首次新增 exploration close 时写入 `--line-strong`，当时已有 `--color-line-strong`；`9e40b3b`（2026-09-24）首次新增 cities 时写入 `--color-ink`，当时已有 `--ink:var(--color-text)`。历史未发现这两个错误名称的定义，属于 semantic `--color-*` 与兼容别名混用，并非 token rename 后漏改；PR #8 仅搬移保留原问题。
- 底边依据：design-system 在 root、system dark media、显式 light/dark 均定义 `--color-line-strong`；Passport 搜索hover、flight row边界、探索separator、mobile import control和controls confirmation边界也使用此token。close是muted文字的次级动作，底边应沿用neutral边界，hover文字变ink不应连带改变底边色。
- 城市文字依据：`FlightRow` 中cities是row的子div；row明确 `color:inherit`，body使用 `--color-text`。mobile以城市名为主文字，应继承父级颜色；≥761px以机场码为主、城市为次，后续 `var(--muted)` 继续生效。删除无效声明完整保留这条继承链，而显式绑定ink/text没有必要。
- 必要尺寸补偿（用户已确认）：仅替换底边token会让close的auto高度从28.796875px增至29.796875px，使desktop探索条增高1px、后续内容下移1px，mobile close上移0.5px。将close的底部padding从4px减为3px，新增1px边框占用原padding预算，保持控件、文字、探索条及后续内容的尺寸和位置；其余spacing/typography/layout均未改。

实测 computed values（before → after；border列为 width / style / color，normal状态）：

| Viewport / theme | Exploration close border-bottom | Flight route cities color |
|---|---|---|
| 1440×900 light | `0px / none / rgb(98,103,98)` → `1px / solid / rgba(32,35,31,0.18)` | `rgb(98,103,98)` → 同值 |
| 1440×900 dark | `0px / none / rgb(164,171,182)` → `1px / solid / rgb(55,65,81)` | `rgb(164,171,182)` → 同值 |
| 390×844 light | `0px / none / rgb(98,103,98)` → `1px / solid / rgba(32,35,31,0.18)` | `rgb(32,35,31)` → 同值 |
| 390×844 dark | `0px / none / rgb(164,171,182)` → `1px / solid / rgb(55,65,81)` | `rgb(244,246,248)` → 同值 |

1024×900、768×1024使用同样的desktop muted层级。四尺寸×light/dark覆盖default archive、search、selected flight、exploration active及close hover/keyboard focus，共48状态；原Playwright responsive/visual测试只生成审阅截图，没有自动pixel baseline，因此另用本地临时probe采集before/after的computed、geometry与full-page截图，未修改现有测试。

最终逐像素配对结果：48组中24组（default/search/selected）完全一致，另24组（exploration/hover/focus）仅close底边的1px像素行改变。配对在同一稳定页面恢复原声明/原padding后，再应用最终声明，以消除独立browser context的SVG边缘栅格化噪声；另已实际保存修改source前后的整套截图。所有采样HTML元素的geometry完全一致，page尺寸与overflow不变；computed差异仅close的border-bottom width/style/color以及获授权的padding-bottom `4px→3px`，城市文字和其他元素均无差异。hover文字仍为ink，keyboard focus ring位置/尺寸/颜色不变；48状态均无page error或横向溢出。

本轮验证：`pnpm check:docs`、`pnpm typecheck`、`pnpm test`（275）、`pnpm test:e2e`（60）、`pnpm build`、`git diff --check`、`node scripts/audit-css-selectors.mjs`、`node scripts/audit-css-runtime.mjs` 全部通过。静态selector/重复media统计不变，只有上述两个未定义引用消失；报告剩余5个无CSS定义的变量均有既有TSX inline style来源。原runtime audit的38状态、273个class、零page error/overflow保持；其两帧等待在主题切换/resize的瞬时采样中仍出现跨run时序差异，因此before/after computed结论采用上述稳定页面专项probe。build仍有已有的大chunk提示；GitHub CI结果见本修复PR检查。

## Runtime evidence / repeat

先启动 `pnpm dev`，另一个终端运行：

```sh
node scripts/audit-css-selectors.mjs
node scripts/audit-css-selectors.mjs --json
node scripts/audit-css-runtime.mjs
node scripts/audit-css-runtime.mjs --json
```

静态脚本复用 Vite 的 PostCSS，读取tracked source；JSON给出每个class的source/test字面量行、全部重复selector declarations、重复media blocks、token定义/引用/fallback。两次JSON逐字节一致。无自动unused判定，无source写入，无额外dependency。运行时脚本使用现有Playwright，在隔离browser context导入本地example派生的6条fixture；只输出结果，关闭context，不保存真实用户archive。

| 页面 / 尺寸 | 本次检查 |
|---|---|
| Passport：1440×900、1024×900、768×1024、390×844 | 6条archive，2025年份切换到1条，UA123搜索到1条，clear，打开/返回selected row；desktop hover/map highlight、spotlight探索及关闭；mobile探索由desktop选择后缩放，验证保留state而非假设mobile有map控件 |
| 状态 | row同时含 delayed/cancelled/diverted/early/onTime/scheduled；FlightDeviation包含late/early/onTime；scheduled没有专属feature rule |
| Detail：1440×900、1024×900、390×844 | departure/arrival、delay、gate、aircraft/seat/ticket/long booking metadata、desktop route map、previous/next及mobile隐藏策略、Edit modal（mobile More入口） |
| Settings / Import / Editor | expanded membership，settings import variant，CSV new/possible disposition、mobile设置，三个尺寸的editor；完整E2E另覆盖storage protection、confirmation、duplicate/invalid imports和demo |
| Theme / CSS | light/dark在1440与390实际切换；每次resize等两帧后读computed值并记录innerWidth、matchMedia，避免读到刚resize前的状态 |

PR #9 的38个状态观察到273个class；原B表70个均未作为DOM class出现。PR #10删除前后再次运行同一38状态，class和全部采样computed value报告完全一致，均为273个class、零page error、零横向溢出。38组full-page截图中37组逐像素一致；1440 Passport搜索的map路线边缘有12个像素差异，最大RGB通道差仅1/255，人工核对未见可见变化。专项probe确认上述否定分支仍匹配当前航空公司名称并保留原截断样式。未观察到的类不自动判dead：例如 low/medium、badge tone、error/recovery、加载fallback仍有明确生成路径。本次是针对高风险候选的运行时审计，没有建立所有selector、所有伪类或所有fixture的穷尽coverage。

验证：`pnpm check:docs`、`pnpm typecheck`、`pnpm test`（275）、`pnpm test:e2e`（60）、`pnpm build`、`git diff --check` 全部通过；两个audit脚本通过。本轮同样全部通过；build仍提示已有的大chunk。PR #10的diff仅7个CSS和本报告，两个audit脚本原样运行，GitHub CI结果见PR检查。

## Cleanup roadmap

| 风险档 | 后续独立 PR 范围 / 顺序 |
|---|---|
| **Safe removal（PR #10已完成）** | ① controls/shell/welcome的孤立 `edit-flight-button`、`wordmark-context`、`page-placeholder`；② 无生成路径的 `is-completed`/`is-on-time`、`map-land`/`is-secondary`；③旧toolbar/actions；④旧timeline/facility/facts子树；⑤旧Passport heading children、year-list/mobile-period/related-flights及旧row子树。已删除上述B正向dead分支，保留group中的active/C分支；唯一有效否定分支例外见删除记录 |
| **Needs focused verification** | C的7个名称（保留负断言）；badge-in-row组合规则；Passport exploration mobile→unconditional链；Detail heading/base box consolidation；max420重复值及重复media拼接。undefined token已在本轮独立修复。删除前在对应尺寸/主题复测，保留原computed结果 |
| **Keep** | 当前Passport period/rows/exploration父条、Detail stops/timing/metadata/map、route-city/airport props、32个动态状态/变体、lazy SVG、state/aria/pseudo/:has规则、runtime tokens、依赖早期未覆盖属性的重复规则、有效的icon否定分支和现有import顺序 |

PR #10已删除旧Passport探索**子结构**、year-list、旧row子结构及Detail toolbar、timeline、facility/facts；探索条/close、map/legend、route-city/airport/time、metadata/stop及icon否定分支均保留。本轮仅完成上述两个undefined token修复；C针对性验证和cascade/media整理仍留在各自独立PR。
