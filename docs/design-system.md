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

### Scope

This foundation is Step 28, not the page-by-page redesign. The flight archive/detail work in Step 29 and the motion pass in Step 31 remain separate so each can be reviewed and committed independently.

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

### 范围

这次只完成第 28 步的基础系统，不等同于逐页重做。第 29 步的航班档案/详情升级和第 31 步的动效精修仍保持独立，方便分别检查和 commit。
