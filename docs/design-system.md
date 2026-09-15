# Keepraw Fly visual system / 视觉系统

[English](#english) | [简体中文](#简体中文)

## English

Keepraw Fly uses a small, dependency-free visual foundation so later page work can become more refined without each screen inventing its own language. Tokens define the atmosphere and shared primitives define recurring aviation information; page CSS remains responsible for composition.

### Principles

1. **Facts first.** Flight numbers, airport codes, times and route relationships carry the strongest visual hierarchy.
2. **Quiet depth.** Warm neutral surfaces, restrained color, fine borders and layered elevation should feel precise rather than decorative.
3. **Operational color has meaning.** Green is positive, amber needs attention, red is critical, blue is informational and neutral is scheduled or unknown.
4. **Local ownership is visible.** Demo, replacement and destructive states must be explicit before the user acts.
5. **One system, two languages.** Layouts must tolerate longer English labels and dense Chinese labels without fixed text widths.
6. **Accessible by default.** Semantic controls, visible keyboard focus, sufficient contrast and reduced-motion support are system rules.

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

### Shared page layout

`PageShell` owns the semantic main-content landmark and applies one content width,
responsive gutter and vertical rhythm to every page. The sticky application header
uses the same inner bounds while its surface remains full width. Layout tokens define
the 1,120 px content maximum, 20–40 px fluid gutters, desktop page spacing and the
single 760 px mobile transition. Mobile keeps the same top-navigation structure,
hides only the wordmark text and allows the link row to scroll internally at unusually
narrow widths instead of widening the document. Viewport and container insets include
device safe areas.

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

Step 28 established the foundation, Step 29 applied it to the archive and detail experience, and Step 31 completes the shared visual pass with restrained interaction feedback. Further page changes should reuse these roles instead of creating parallel motion rules.

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

1. **事实优先。** 航班号、机场代码、时间和航线关系拥有最强的信息层级。
2. **克制的纵深。** 暖色中性背景、节制配色、细边框和分层阴影应体现精确感，而不是装饰感。
3. **运行颜色必须有含义。** 绿色表示正向，琥珀色表示需要关注，红色表示严重，蓝色表示信息，灰色表示计划中或未知。
4. **明确数据归属。** 演示、替换和破坏性状态都必须在用户操作前明确说明。
5. **同一系统，双语适配。** 布局需要同时容纳更长的英文标签和密集的中文标签，不能依赖固定文本宽度。
6. **默认可访问。** 语义化控件、可见的键盘焦点、足够对比度和减少动效支持都属于系统规则。

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

### 共享页面布局

`PageShell` 统一负责语义化主内容区域，并为所有页面应用相同的内容最大宽度、响应式
左右留白和纵向节奏。粘滞应用导航使用相同的内容边界，同时让导航表面保持全宽。
布局 token 统一定义 1120 px 内容最大宽度、20–40 px 流动 gutter、桌面页面间距和
760 px 这一处移动端切换点。移动端继续沿用同一套顶部导航结构，只隐藏 wordmark
文字；在异常窄的屏幕上，链接行会在自身内部滚动，不会撑宽整个页面。Viewport 与
容器间距均包含设备 safe area。

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

第 28 步建立基础系统，第 29 步将其应用到档案和详情体验，第 31 步用克制的交互反馈完成共享视觉升级。后续页面修改应继续复用这些角色，避免产生平行的动效规则。

### 可访问性验证

第 38 步为浅色欢迎页、深色设置/档案页和航班编辑器加入 Axe 检查。次要文字 token
在实际画布与抬升表面上满足 WCAG AA。编辑器会约束键盘焦点、支持 Escape 关闭、
将焦点还给触发控件，并避免嵌套 banner landmark。审计在减少动效条件下运行，防止
入场透明度产生瞬时的伪对比度结果。
