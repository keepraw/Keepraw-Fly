# Keepraw Fly visual system / 视觉系统

[English](#english) | [简体中文](#简体中文)

## English

Keepraw Fly uses a small, dependency-free visual foundation so later page work can become more refined without each screen inventing its own language. Tokens define the atmosphere and shared primitives define recurring aviation information; page CSS remains responsible for composition.

### Principles

1. **One dominant idea per page.** The first glance must land on the user's most important flight object, not on navigation, decoration or a generic page title.
2. **Facts first.** Flight numbers, airport codes, times and route relationships carry the strongest visual hierarchy when they are the page's subject.
3. **Hierarchy before decoration.** Scale, whitespace, alignment, order and restrained contrast establish importance before borders, shadows, gradients, icons or motion are considered.
4. **Quiet depth.** Warm neutral surfaces, restrained color, fine borders and layered elevation should feel precise rather than decorative.
5. **Operational color has meaning.** Green is positive, amber needs attention, red is critical, blue is informational and neutral is scheduled or unknown.
6. **Local ownership is visible.** Demo, replacement and destructive states must be explicit before the user acts.
7. **One system, two languages.** Layouts must tolerate longer English labels and dense Chinese labels without fixed text widths.
8. **Accessible by default.** Semantic controls, visible keyboard focus, sufficient contrast and reduced-motion support are system rules.

### Token layers

`apps/web/src/design-system.css` is loaded before page styles. New UI should use its semantic roles instead of one-off hex values.

- **Surfaces:** canvas, base, raised, sunken and translucent glass roles, plus regular and strong borders.
- **Operational color:** accent/positive, warning, danger and informational pairs each include a foreground and soft surface.
- **Inverted aviation surface:** shared foreground, muted text, gradient and highlight roles for dark route panels.
- **Typography:** separate UI and data families, calibrated Simplified Chinese display weight, tabular-number features and airport-code tracking.
- **Depth and shape:** control, card, icon, panel, hero, modal and pill radii with raised, floating and modal shadows.
- **Map and motion:** the Passport atlas palette and existing reduced-motion-safe timing remain independent layers.

Compatibility aliases such as `--ink` and `--green` remain for first-stage screens. New components should prefer the semantic `--color-*`, `--font-*`, `--radius-*` and `--shadow-*` roles.

The bilingual type system uses three roles without downloading fonts: the UI family
for prose and controls, the display family for page hierarchy, and the data family
for flight numbers, airport codes, local times and statistics. Size, leading,
weight and tracking are defined by `--type-*`, `--font-weight-*` and `--tracking-*`
tokens. Simplified Chinese overrides only the roles that need optical correction:
display sizes are slightly smaller, line heights are more open, and display
tracking returns to zero. Data roles retain tabular numerals so columns and time
comparisons remain stable in both languages.

### Archival precision layer

Core archive screens use a precise, document-like visual language: graphite dark
surfaces, one-pixel rules, low semantic radii and a restrained mint accent. The
flight record is composed as one owned object; airport codes and local times share
a baseline, while labels and provenance use the local monospace fallback stack.
This layer does not download fonts: it prefers Cascadia Mono, SFMono, Consolas and
system CJK fallbacks already available on the device.
New local archives start in the dark archival theme; users can still select Light
or System explicitly, and all semantic tokens remain shared across those modes.

The archive treatment is structural, not theatrical. A bordered surface may group
one complete record or one map, but must not split its internal fields into cards.
Green, amber and red remain semantic. Demo concepts must never contribute invented
verification, cryptographic, operational or identity claims to product UI.

### Shared page layout

`PageShell` owns the semantic main-content landmark and applies one content width,
responsive gutter and vertical rhythm to every page. The sticky application header
uses the same inner bounds while its surface remains full width. Layout tokens define
the 1,120 px content maximum, 20–40 px fluid gutters, desktop page spacing and the
single 760 px mobile transition. Mobile keeps the same top-navigation structure,
hides only the wordmark text and allows the link row to scroll internally at unusually
narrow widths instead of widening the document. Viewport and container insets include
device safe areas.

### Responsive UI acceptance

Responsive work is reviewed at three representative widths. They are inspection
baselines, not three layouts to hard-code:

| Baseline | Approximate width | What it must prove |
| --- | ---: | --- |
| Desktop | 1440 px | The content maximum and deliberate whitespace hold; information does not expand merely to fill the screen. |
| Narrow desktop / tablet | 1024 px | Grids reallocate space without losing the primary flight facts or leaking outside their containers. |
| Mobile | 390 px | The composition changes where needed, preserves the content priority and remains usable without hover. |

Tests that cover the shared 760 px transition should also exercise 760 px and 761 px.
Unusual widths such as 320 px are useful overflow guards, but they do not replace the
three design baselines.

Every page and shared component must satisfy these invariants:

- The document has no horizontal overflow. A deliberately scrollable local region, such as a data table or navigation strip, must contain its own overflow.
- Airport codes, flight numbers and critical times remain atomic and readable. They do not split across lines or solve pressure by shrinking without a lower bound.
- Buttons stay inside the viewport and their owning container. Labels may wrap when the control remains clear and usable.
- Modals fit the dynamic viewport and device safe area. Long forms scroll inside the modal or its backdrop; essential actions remain keyboard reachable.
- Sticky and fixed elements reserve or account for their occupied space, do not cover the main content, and do not trap focus behind them.
- Desktop grids are replaced, reordered or progressively disclosed on mobile rather than simply compressed until their contents collide.
- Core navigation and actions remain visible to touch, keyboard and pointer users. Hover may reinforce an affordance but cannot reveal the only route to a core function.
- Long airport, airline and localized names wrap in supporting regions or use a clear ellipsis where the full text is non-primary; they never widen the page or displace route identity.

When space becomes constrained, preserve information in this order:

1. Origin and destination.
2. The key local times.
3. Flight identity.
4. Primary truthful status.
5. Supporting names, dates, counts and optional facts.

Supporting information may wrap, move below the primary row, enter a secondary region
or use progressive disclosure on mobile. Do not keep the desktop order by reducing all
type indefinitely. The dominant idea defined by the composition contract must survive
the transition.

Chinese and English are separate acceptance cases. Chinese copy often has greater
visual density; English airport and action names often require more horizontal space.
Components must use the language-aware type tokens, allow prose to reflow and keep
numeric/data roles stable. Do not introduce fixed widths that work only for one locale.

Light and dark implementations must consume the shared theme roles: canvas/background,
base and raised surfaces, regular/strong borders, primary/muted/faint text, operational
status pairs and the focus ring. Business-page CSS must not add a parallel light/dark
palette. A self-contained semantic subtheme, such as the existing Passport map, remains
tokenized and must still meet contrast requirements.

Motion cannot carry layout meaning or be required to discover an action. New animation
belongs behind `prefers-reduced-motion: no-preference`; the global reduced-motion rule
must leave content immediately present, focused elements stable and controls usable.

The automated acceptance floor is intentionally lightweight:

- Typecheck, unit tests and production build must pass.
- Headless browser tests assert whole-document overflow, shared-shell alignment and the three baseline widths.
- Representative archive and detail data assert atomic airport codes, flight identity and times plus the mobile compression order.
- Representative desktop/mobile modal bounds, sticky-header clearance, visible button bounds, theme accessibility and reduced-motion duration are checked.
- Screenshot-diff infrastructure is not required. Add it only if a later task establishes a stable, maintainable need.

### Composition contract

Before changing a core page, complete this sentence in the implementation notes:
“The first glance should land on **[one object]**, because **[product reason]**.”
If the answer names a collection of unrelated modules, the composition does not yet
have a dominant idea. A page title names the place; it is not automatically the hero.

Use four levels of visual weight:

| Level | Role | Appropriate tools | Must not compete with |
| --- | --- | --- | --- |
| 1. Dominant | The one page-defining object or relationship | Largest relevant data/display type, spatial isolation, deliberate whitespace, one high-contrast field or meaningful route/map geometry | Another hero, equally large controls, decorative illustration |
| 2. Supporting | Context needed to understand or operate on the dominant object | Section type, normal surface contrast, compact controls, restrained semantic color | The dominant scale or contrast |
| 3. Detail | Facts consulted after the main story is understood | Body/data type, aligned rows or definition lists, dividers, muted labels | Separate cards for every fact |
| 4. Meta/action | Counts, helper text, tertiary actions and provenance | Label/caption type, muted or faint text, text/secondary controls | Persistent accent, large pills or elevation |

Only the dominant level may routinely combine several emphasis tools at once—for
example large type, an inverted surface and generous isolation. Supporting content
must step down in scale or contrast, and detail/meta content must step down again.
Do not solve an unclear hierarchy by making every heading larger.

The core-page contracts for later work are:

| Page | Dominant visual idea | Supporting content | Content that should recede |
| --- | --- | --- | --- |
| Flights | The chronological flight records themselves | Search, year grouping and the add action | Page title, total count and secondary status detail |
| Flight Detail | Origin → destination and the relationship between local times | Date, flight identity, duration and truthful operational status | Aircraft, seat, terminal, gate and notes |
| Passport | The user's geographic flight footprint, led by the route map | Lifetime/year context and a small number of derived totals | Ranking details, counts and period controls |
| Settings | Data ownership and the settings content itself | Clear section labels, preference controls and import/export actions | Decorative route art, icons and promotional hero treatment |

Desktop and mobile must preserve the same dominant idea. Mobile may change the
composition, disclosure and order; it must not become a uniformly shrunken desktop
screen or promote controls above the page's subject.

### Grouping, surfaces and anti-SaaS rules

Choose the lightest grouping device that communicates the relationship:

1. Start with proximity, alignment and whitespace.
2. Add a divider when repeated facts need scanning structure.
3. Add a surface only when content has an independent interaction, state, containment or ownership boundary.
4. Add elevation only for overlap, a modal/floating layer or the single dominant surface—not merely to make a section feel finished.
5. Reserve inverted, gradient or illustrated treatment for at most one meaningful focal region on a page. It must reinforce real flight information.

A container must not exist only to hold a heading and another container. Avoid card
mosaics, nested cards, one-field cards and rows of equally elevated rounded rectangles.
Prefer editorial sequences, aligned lists, definition lists and open sections. A
repeated component may use a card when each item is genuinely actionable as a whole,
but its internal facts should remain one composition rather than smaller cards.

Badges are for compact state, category or selection—not for every value. Icons must
improve recognition, direction or control affordance; section-by-section decorative
icons are not a default. Shadows express actual depth. Accent color communicates a
route, selection, status or action and must not be spread across unrelated labels.
Never add a module, metric or placeholder fact to fill empty space.

### Applying the existing tokens

The current foundation is sufficient for this hierarchy and should stay small:

- `--type-size-record`, `--type-size-time-hero` and `--type-size-airport-display` are available for dominant real-world data. Use `--type-size-page` for page identity, not as a competing data hero.
- `--type-size-section` and `--type-size-data-heading` establish supporting structure; body, label and caption roles carry detail and meta information.
- `--color-text`, muted and faint roles create deliberate recession. Accent and operational colors retain semantic meaning and are not general emphasis colors.
- `--space-8` through `--space-10` separate major narrative regions; `--space-5` through `--space-7` separate sections; smaller steps group related facts and controls.
- Canvas or open layout is the default. Surface, raised and inverted roles are progressively stronger boundaries. Radius and shadow size must follow that boundary strength.

The audit for Step 45 found no shared card utility forcing page composition, and the
existing typography, spacing, color and elevation tokens already cover the needed
roles. Therefore this step deliberately adds no new visual primitive or page-level CSS.
Later page tasks should first remove unnecessary containers and reassign existing
roles; extend the token set only when a recurring semantic need is demonstrated.

### Composition review checklist

Before a later page redesign is accepted, verify:

1. Can a reviewer name the first visual focus in one short phrase?
2. Is that focus a truthful flight record, relationship or user-owned capability?
3. Would the hierarchy still read clearly without gradients, shadows and icons?
4. Does each border, radius, surface and shadow communicate a real boundary or depth?
5. Can any card be replaced by whitespace, alignment or a divider?
6. Are status badges and accent colors limited to semantic uses?
7. Do secondary facts visibly recede without becoming inaccessible?
8. Does mobile preserve the same priority while changing composition where needed?
9. Do Chinese, English and numeric content retain the intended hierarchy?
10. Was anything added only to fill space or make the page feel like a dashboard?

### Shared aviation primitives

`apps/web/src/components/AviationPrimitives.tsx` provides three dependency-free building blocks:

- `AirportCode` applies one consistent data face, tracking and compact/display sizing to IATA codes.
- `FlightStatusBadge` maps domain statuses to semantic positive, critical or neutral treatments; CSS also reserves attention and informational tones for later live-data work.
- `AviationIcon` contains a small stroke-based icon vocabulary for flights, routes, airports, clocks, distance, gates and settings sections.

These primitives are already used by the flight archive, flight detail and settings pages. They are intentionally presentational: flight calculations and status decisions remain in the core package.

### Component rules

- Primary buttons are filled; secondary buttons are outlined or transparent. Destructive actions use the danger role and explicit language.
- Inputs and selects use shared control heights and radii. Keyboard focus uses `--focus-ring` and is never removed.
- Repeated information should use a shared primitive before adding page-specific styling.
- Airport codes and operational values use data typography and tabular-number features.
- Cards use card or panel elevation; modal surfaces use modal elevation. Shadows express hierarchy, not decoration.
- Animations use shared durations and are effectively disabled when the operating system requests reduced motion.

### Motion language

Step 31 adds a lightweight, CSS-only motion layer. Content enters with short opacity-and-position transitions, archive rows use a small data-order stagger, controls respond with restrained elevation, and Passport routes draw from origin to destination before airport points appear. Period changes remount only the derived Passport content, so the selected control and keyboard focus remain stable. All motion is gated behind `prefers-reduced-motion: no-preference`; the reduced-motion rule also clamps any legacy animation or transition to an effectively immediate duration.

### Scope

Step 45 defines composition rules and page-level hierarchy contracts; it does not
redesign a business page. Steps 47–54 should apply these contracts to one page or
bounded experience at a time while preserving product facts and behavior. Existing
visual tokens and motion rules should be reused instead of creating parallel systems.

### Accessibility verification

Step 38 adds Axe checks for the light welcome screen, dark settings/archive views
and the flight editor. Secondary text tokens meet WCAG AA against their actual
canvas and raised surfaces. The editor contains keyboard focus, closes with
Escape, restores focus to its opener and avoids nested banner landmarks. The
audit runs with reduced motion so entrance opacity cannot create a transient
false contrast result.

## 简体中文

Keepraw Fly 使用一套小型、零依赖的视觉基础，让后续页面可以持续精修，而不必各自发明一套语言。Token 负责定义整体氛围，共享组件负责反复出现的航空信息，页面 CSS 仍负责具体构图。

### 设计原则

1. **每页只有一个主导构图。** 第一眼必须落在用户最重要的飞行对象上，而不是导航、装饰或通用页面标题。
2. **事实优先。** 当航班号、机场代码、时间和航线关系是页面主题时，它们拥有最强的信息层级。
3. **先建立层级，再考虑装饰。** 先用尺度、留白、对齐、顺序和克制的对比表达重要性，再考虑边框、阴影、渐变、图标或动效。
4. **克制的纵深。** 暖色中性背景、节制配色、细边框和分层阴影应体现精确感，而不是装饰感。
5. **运行颜色必须有含义。** 绿色表示正向，琥珀色表示需要关注，红色表示严重，蓝色表示信息，灰色表示计划中或未知。
6. **明确数据归属。** 演示、替换和破坏性状态都必须在用户操作前明确说明。
7. **同一系统，双语适配。** 布局需要同时容纳更长的英文标签和密集的中文标签，不能依赖固定文本宽度。
8. **默认可访问。** 语义化控件、可见的键盘焦点、足够对比度和减少动效支持都属于系统规则。

### Token 层级

`apps/web/src/design-system.css` 会先于页面样式加载。新增界面应使用其中的语义角色，避免继续加入孤立的十六进制颜色。

- **表面：** 画布、基础、抬升、下沉和半透明玻璃表面，以及普通和强调边框。
- **运行状态颜色：** 正向、关注、危险和信息颜色均有前景色与柔和背景色。
- **深色航空表面：** 为深色航线面板共享前景、弱化文字、渐变和高光角色。
- **字体：** 分离界面字体和数据字体，单独校准简体中文展示字重，并统一等宽数字特性与机场代码字距。
- **纵深与形状：** 控件、卡片、图标、面板、主视觉、弹窗和胶囊圆角，以及抬升、悬浮和弹窗阴影。
- **地图与动效：** Flight Passport 的地图配色和现有减少动效安全时序保持独立层级。

`--ink`、`--green` 等兼容别名继续服务第一阶段页面。新组件应优先使用语义化的 `--color-*`、`--font-*`、`--radius-*` 和 `--shadow-*` 角色。

双语字体体系不下载字体文件，而是明确分为三类：界面字体用于正文与控件，展示字体用于
页面层级，数据字体用于航班号、机场代码、当地时间和统计数字。字号、行高、字重和字距
分别由 `--type-*`、`--font-weight-*` 与 `--tracking-*` token 管理。简体中文只覆盖需要
视觉校准的角色：展示字号略小、行高更宽松、展示字距归零；数据角色在两种语言中都保留
等宽数字特性，使列对齐和时间比较保持稳定。

### 档案式精确视觉层

核心档案页面采用精确、接近文档的视觉语言：石墨色深色表面、1px 线条、低语义圆角和
克制的薄荷绿色强调。整趟航班作为一个完整的用户档案对象构图；机场代码与当地时间共享
基线，标签和档案元信息使用本机等宽字体 fallback。该层不下载网络字体，优先使用设备
已有的 Cascadia Mono、SFMono、Consolas 与系统中文字体。
新的本地档案默认使用深色档案主题；用户仍可明确选择 Light 或 System，三种模式继续共享
同一套语义 token。

档案感来自结构，而不是戏剧化装饰。一个有边框的表面可以组织一条完整记录或一张地图，
但不能继续把内部字段拆成卡片。绿色、琥珀色与红色继续只表达语义。任何概念稿中的虚构
认证、加密、运行状态或身份声明都不得进入产品界面。

### 共享页面布局

`PageShell` 统一负责语义化主内容区域，并为所有页面应用相同的内容最大宽度、响应式
左右留白和纵向节奏。粘滞应用导航使用相同的内容边界，同时让导航表面保持全宽。
布局 token 统一定义 1120 px 内容最大宽度、20–40 px 流动 gutter、桌面页面间距和
760 px 这一处移动端切换点。移动端继续沿用同一套顶部导航结构，只隐藏 wordmark
文字；在异常窄的屏幕上，链接行会在自身内部滚动，不会撑宽整个页面。Viewport 与
容器间距均包含设备 safe area。

### 响应式 UI 验收

响应式设计以三个代表性宽度验收。它们是检查基准，不是需要硬编码的三套布局：

| 基准 | 参考宽度 | 必须证明的内容 |
| --- | ---: | --- |
| Desktop | 1440 px | 内容最大宽度和有意留白保持稳定；信息不会只为了填满屏幕而拉伸。 |
| 窄桌面 / Tablet | 1024 px | Grid 能重新分配空间，不丢失主要航班事实，也不会越出容器。 |
| Mobile | 390 px | 必要时真正改变构图，保留内容优先级，并且不依赖 hover 仍可使用。 |

覆盖共享 760 px 切换点的测试还应检查 760 px 与 761 px。320 px 等异常窄宽度适合用作
overflow 防线，但不能代替三个设计基准。

每个页面和共享组件都必须满足以下不变量：

- 整个 document 不得出现横向溢出。数据表或导航条等有意横向滚动的局部区域必须在自身内部约束 overflow。
- 机场代码、航班号和关键时间必须保持完整、稳定、可读；不得被拆行，也不能通过无下限缩小字号来吸收压力。
- 按钮必须留在 viewport 及其所属容器内；只要控件仍清楚可用，按钮文字可以合理换行。
- Modal 必须适应动态 viewport 和设备 safe area；长表单在 modal 或 backdrop 内滚动，关键操作保持键盘可达。
- Sticky 与 fixed 元素必须预留或计算自身占用空间，不遮挡主内容，也不能把焦点留在遮挡层之后。
- Desktop grid 到 Mobile 时应被替换、重排或渐进披露，不能持续压缩到内容互相碰撞。
- 核心导航和操作对触屏、键盘和鼠标用户都应直接可见；hover 可以加强 affordance，但不能成为发现核心功能的唯一途径。
- 超长机场名、航司名和本地化名称应在辅助区域换行，或在全文不属于主信息时明确省略；不得撑宽页面或挤走航线身份。

空间不足时，按以下顺序保留信息：

1. Origin 与 destination。
2. 关键当地时间。
3. Flight identity。
4. 主要且真实的状态。
5. 辅助名称、日期、计数和可选事实。

辅助信息可以换行、移到主行下方、进入次级区域，或在 Mobile 使用渐进披露。不能为了
维持桌面顺序而无限缩小所有文字。构图契约定义的主导对象必须在响应式切换后继续成立。

中文和英文是两个独立验收场景。中文文案通常视觉密度更高，英文机场名和操作名称通常
需要更多横向空间。组件应使用语言感知字体 token，允许正文重新流动，并保持数字/数据
角色稳定；不能引入只适合一种语言的固定宽度。

Light 与 Dark 必须使用共享主题角色：canvas/background、基础与 raised surface、普通/
强调 border、primary/muted/faint text、运行状态颜色组和 focus ring。业务页面 CSS 不得
再创建一套平行的 Light/Dark 色板。Passport 地图等自包含语义子主题仍须 token 化，
并继续满足对比度要求。

动效不能承担布局含义，也不能成为发现操作的必要条件。新动画必须放在
`prefers-reduced-motion: no-preference` 后；全局 reduced-motion 规则必须保证内容立即
可见、焦点稳定且控件仍然可用。

自动化验收底线保持轻量：

- Typecheck、单元测试和 production build 必须通过。
- Headless browser 测试检查整页 overflow、共享骨架对齐和三个基准宽度。
- 代表性的档案与详情数据检查机场代码、航班身份、时间不可拆分，以及 Mobile 压缩顺序。
- 检查代表性 Desktop/Mobile modal 边界、sticky header 避让、可见按钮边界、主题可访问性和 reduced-motion 时长。
- 不要求 screenshot diff 基础设施；只有后续任务证明存在稳定且可维护的需求时才增加。

### 构图契约

修改核心页面前，先在实施说明中补完这句话：
“用户第一眼应该看到 **[唯一对象]**，因为 **[产品原因]**。”
如果答案包含一组互不相关的模块，说明构图仍没有明确主角。页面标题用于说明当前位置，
它不天然等于页面主视觉。

视觉权重分为四级：

| 层级 | 作用 | 可以使用的手段 | 不应与什么竞争 |
| --- | --- | --- | --- |
| 1. 主导层 | 唯一决定页面身份的对象或关系 | 最大的相关数据/展示字号、空间隔离、明确留白、一个高对比区域或有意义的航线/地图几何 | 另一个 hero、同样巨大的控件、装饰插画 |
| 2. 支撑层 | 理解或操作主导对象所需的上下文 | 章节字号、普通表面对比、紧凑控件、克制的语义颜色 | 主导层的尺度或对比度 |
| 3. 细节层 | 理解主线后才需要查阅的事实 | 正文/数据字号、对齐行或定义列表、分隔线、弱化标签 | 每个字段一个独立 card |
| 4. 元信息/操作层 | 数量、辅助说明、三级操作与来源 | 标签/说明字号、muted 或 faint 文字、文字型/次级控件 | 持续强调色、大型 pill 或抬升效果 |

只有主导层可以常态化叠加多种强调手段，例如大字号、反色表面和充分空间隔离。
支撑内容必须在尺度或对比度上退后一步，细节和元信息还要继续退后。不能通过把所有标题
一起放大来修复不清晰的层级。

后续核心页面遵守以下契约：

| 页面 | 主导视觉构图 | 支撑内容 | 应主动退后的内容 |
| --- | --- | --- | --- |
| Flights | 按时间组织的航班记录本身 | 搜索、年份分组和新增操作 | 页面标题、总数和次要状态细节 |
| Flight Detail | origin → destination 与两地当地时间的关系 | 日期、航班身份、时长和真实运行状态 | 机型、座位、航站楼、登机口和备注 |
| Passport | 以航线地图为核心的个人地理飞行足迹 | Lifetime/年度上下文和少量派生总数 | 排名细节、计数和周期控件 |
| Settings | 数据所有权与设置内容本身 | 清晰的章节标签、偏好控件以及导入/导出操作 | 装饰航线图、图标和宣传式 hero 表达 |

Desktop 与 Mobile 必须保留同一个主导构图。移动端可以改变构图、披露方式和信息顺序，
但不能只是把桌面页面等比压小，也不能让控件越过页面主题成为第一视觉重点。

### 分组、表面与 anti-SaaS 规则

始终选择能够说明关系的最轻分组方式：

1. 先使用邻近关系、对齐和留白。
2. 重复事实需要清晰扫描结构时，再加入分隔线。
3. 只有当内容具备独立交互、状态、内容约束或数据所有权边界时，才加入表面。
4. 只有重叠层、弹窗/浮层或页面唯一主导表面可以使用纵深；不能只为了让 section 看起来完整而加阴影。
5. 每个页面最多允许一个反色、渐变或插画区域，并且它必须强化真实的飞行信息。

容器不能仅仅为了包住标题和另一个容器而存在。避免 dashboard card mosaic、嵌套 card、
一字段一卡片，以及整排具有相同抬升和圆角的矩形。优先采用编辑式信息序列、对齐列表、
定义列表和开放 section。重复组件只有在每个项目确实作为整体可操作时才适合使用 card；
其内部事实仍应组成一个构图，而不是继续拆成更小的 card。

Badge 只用于紧凑表达状态、类别或选择，不能把每个值都变成 badge。图标必须帮助识别、
方向判断或控件理解，不能默认给每个 section 加装饰图标。阴影只表达真实纵深。强调色
用于航线、选择、状态或操作，不能散布在互不相关的标签上。绝不为了填满留白而增加模块、
指标或占位事实。

### 使用现有 token 建立层级

当前基础已经足以表达这些层级，应继续保持精简：

- `--type-size-record`、`--type-size-time-hero` 与 `--type-size-airport-display` 可用于主导层的真实数据；`--type-size-page` 只表达页面身份，不能与数据主视觉竞争。
- `--type-size-section` 与 `--type-size-data-heading` 建立支撑结构；正文、标签和说明字号承担细节与元信息。
- `--color-text`、muted 与 faint 角色形成明确的后退层级；强调色和运行状态色继续保持语义，不能作为通用强调色。
- `--space-8` 至 `--space-10` 分隔主要叙事区域，`--space-5` 至 `--space-7` 分隔 section，更小的间距用于组织相关事实与控件。
- 默认使用 canvas 或开放布局。surface、raised 与 inverted 代表逐步增强的边界；圆角和阴影大小必须服从边界强度。

任务 45 的审查没有发现会强制页面构图的共享 card 工具类，现有字体、间距、颜色和纵深
token 也已经覆盖所需角色。因此本任务刻意不增加视觉 primitive 或页面级 CSS。后续页面
任务应先移除不必要容器并重新分配现有角色；只有反复出现的语义需求确实无法表达时，
才扩展 token。

### 构图验收清单

后续页面重设计通过验收前，需要确认：

1. 审查者能否用一个短语说出第一视觉重点？
2. 这个重点是否属于真实航班记录、真实关系或用户拥有的能力？
3. 移除渐变、阴影和图标后，信息层级是否仍然清晰？
4. 每个边框、圆角、表面和阴影是否都表达真实边界或纵深？
5. 是否有 card 可以用留白、对齐或分隔线替代？
6. 状态 badge 和强调色是否只用于语义场景？
7. 次要事实是否明显退后，同时仍保持可访问和可读？
8. Mobile 是否在必要时改变构图，同时保留相同优先级？
9. 中文、英文和数字内容是否保持预期层级？
10. 是否存在只为了填满空间或让页面更像 dashboard 而添加的内容？

### 共享航空组件

`apps/web/src/components/AviationPrimitives.tsx` 提供三个不依赖外部库的基础组件：

- `AirportCode` 为 IATA 代码统一数据字体、字距以及紧凑/展示两种尺寸。
- `FlightStatusBadge` 将领域状态映射为正向、严重或中性样式；CSS 还为未来实时数据预留了关注与信息两种语义。
- `AviationIcon` 提供一套小型线性图标语言，覆盖飞机、航线、机场、时钟、距离、登机口和设置分区。

航班档案、航班详情和设置页已经实际使用这些组件。它们只负责展示；航班计算和状态判断仍保留在 core 包中。

### 组件规则

- 主按钮使用填充样式，次按钮使用描边或透明样式；破坏性操作必须使用危险色和明确文案。
- 输入框与下拉框使用共享控件高度和圆角；键盘焦点统一使用 `--focus-ring`，不得移除。
- 重复信息应先考虑共享组件，再增加页面专属样式。
- 机场代码和运行数据使用数据字体与等宽数字特性。
- 卡片使用卡片或面板纵深，弹窗使用弹窗纵深；阴影用来表达层级，而不是单纯装饰。
- 动效使用共享时长，并在系统要求“减少动态效果”时基本停用。

### 动效语言

第 31 步加入轻量、纯 CSS 的动效层。内容使用短促的透明度与位移进入，档案行按数据顺序轻微错开，控件用克制的抬升反馈交互，Flight Passport 航线则从起点绘制到终点，随后显示机场点。切换统计期间时只重新挂载派生出的护照内容，因此选中控件和键盘焦点保持稳定。所有动效都受 `prefers-reduced-motion: no-preference` 约束；减少动效规则还会把任何旧动画或过渡压缩为几乎即时完成。

### 范围

任务 45 定义构图规则和页面级层级契约，不重设计任何业务页面。任务 47–54 应按页面或
边界明确的体验逐项应用这些契约，同时保留产品事实与现有行为。后续应继续复用现有视觉
token 和动效规则，避免建立平行系统。

### 可访问性验证

第 38 步为浅色欢迎页、深色设置/档案页和航班编辑器加入 Axe 检查。次要文字 token
在实际画布与抬升表面上满足 WCAG AA。编辑器会约束键盘焦点、支持 Escape 关闭、
将焦点还给触发控件，并避免嵌套 banner landmark。审计在减少动效条件下运行，防止
入场透明度产生瞬时的伪对比度结果。
